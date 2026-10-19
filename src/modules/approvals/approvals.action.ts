"use server";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { ZSAError } from "zsa";

import { getActiveDelegates } from "@/modules/delegations/delegations.query";
import { notifications } from "@/modules/notifications/notifications.schema";
import { approvalSteps, requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator } from "@/modules/request-types/request-types.validation";
import { requestCounters, requestItems, requests } from "@/modules/requests/requests.schema";
import { formatRequestCode } from "@/modules/requests/requests.service";
import { user } from "@/modules/users/users.schema";
import { FUNCTIONAL_ROLES } from "@/shared/constants/role.constant";
import { authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";

import { countPendingApprovals, getActorContext } from "./approvals.query";
import { approvals } from "./approvals.schema";
import { type Assignee, computeDueAt, decideAct, nextStep, resolveAssignee, type StepConfig } from "./approvals.service";
import { approveInput, cancelInput, rejectInput, submitInput } from "./approvals.validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationType = (typeof notifications.$inferInsert)["type"];

const roleLabel = (role: string) => FUNCTIONAL_ROLES.find((r) => r.value === role)?.label ?? role;

async function findRoleHolders(tx: Tx, role: string, excludeId: string) {
  const rows = await tx
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        sql`(',' || coalesce(${user.role}, '') || ',') like ${`%,${role},%`}`,
        sql`${user.banned} is not true`,
        ne(user.id, excludeId),
      ),
    );
  return rows.map((r) => r.id);
}

async function assign(tx: Tx, step: StepConfig, requester: { id: string; managerId: string | null }) {
  const assignee = resolveAssignee(step, requester);
  if (!assignee) {
    throw new ZSAError(
      "PRECONDITION_FAILED",
      `Bước "${step.name}" cần quản lý trực tiếp nhưng người làm đơn chưa được gán quản lý. Vui lòng liên hệ quản trị viên.`,
    );
  }
  const recipients = assignee.approverId
    ? [assignee.approverId]
    : await findRoleHolders(tx, assignee.approverRole, requester.id);
  if (recipients.length === 0) {
    throw new ZSAError(
      "PRECONDITION_FAILED",
      `Bước "${step.name}" chưa có ai giữ vai trò ${roleLabel(assignee.approverRole ?? "")}. Vui lòng liên hệ quản trị viên.`,
    );
  }
  if (assignee.approverId) {
    const [manager] = await tx
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, assignee.approverId));
    if (manager?.banned) {
      throw new ZSAError(
        "PRECONDITION_FAILED",
        `Quản lý trực tiếp cho bước "${step.name}" đang bị khóa tài khoản. Vui lòng liên hệ quản trị viên.`,
      );
    }
  }
  return { assignee, recipients };
}

async function notify(
  tx: Tx,
  userIds: string[],
  payload: { type: NotificationType; title: string; href: string },
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.insert(notifications).values(unique.map((userId) => ({ userId, ...payload })));
}

async function openRound(
  tx: Tx,
  args: {
    request: { id: string; code: string; title: string };
    step: StepConfig;
    assignee: Assignee;
    recipients: string[];
    slaHours: number;
  },
) {
  const now = new Date();
  await tx.insert(approvals).values({
    requestId: args.request.id,
    stepOrder: args.step.stepOrder,
    stepName: args.step.name,
    approverId: args.assignee.approverId,
    approverRole: args.assignee.approverRole,
    dueAt: computeDueAt(now, args.slaHours),
  });
  const delegates = await getActiveDelegates(args.recipients);
  await notify(tx, [...args.recipients, ...delegates.map((d) => d.delegateId)], {
    type: "APPROVAL_NEEDED",
    title: `${args.request.code} chờ bạn duyệt (${args.step.name}): ${args.request.title}`.slice(0, 200),
    href: `/workspace/approvals/${args.request.id}`,
  });
}

async function loadFlow(tx: Tx, requestTypeId: string) {
  const [type] = await tx
    .select({
      isActive: requestTypes.isActive,
      slaHours: requestTypes.slaHours,
      formSchema: requestTypes.formSchema,
      hasLineItems: requestTypes.hasLineItems,
    })
    .from(requestTypes)
    .where(eq(requestTypes.id, requestTypeId));
  const steps = await tx
    .select({
      stepOrder: approvalSteps.stepOrder,
      name: approvalSteps.name,
      approverType: approvalSteps.approverType,
      approverRole: approvalSteps.approverRole,
    })
    .from(approvalSteps)
    .where(eq(approvalSteps.requestTypeId, requestTypeId))
    .orderBy(asc(approvalSteps.stepOrder));
  return { type, steps };
}

async function loadRequester(tx: Tx, requesterId: string) {
  const [requester] = await tx
    .select({ id: user.id, managerId: user.managerId, departmentId: user.departmentId })
    .from(user)
    .where(eq(user.id, requesterId));
  return requester;
}

export const submitRequest = authedProcedure
  .createServerAction()
  .input(submitInput)
  .handler(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select({
          id: requests.id,
          requesterId: requests.requesterId,
          requestTypeId: requests.requestTypeId,
          status: requests.status,
          title: requests.title,
          formData: requests.formData,
        })
        .from(requests)
        .where(eq(requests.id, input.requestId))
        .for("update");
      if (!request || request.requesterId !== ctx.user.id) {
        throw new ZSAError("NOT_FOUND", "Không tìm thấy đơn của bạn");
      }
      if (request.status !== "DRAFT") throw new ZSAError("CONFLICT", "Đơn này đã được gửi");

      const { type, steps } = await loadFlow(tx, request.requestTypeId);
      if (!type?.isActive) throw new ZSAError("PRECONDITION_FAILED", "Loại đơn đã ngừng sử dụng");
      if (steps.length === 0) {
        throw new ZSAError("PRECONDITION_FAILED", "Loại đơn chưa được cấu hình bước duyệt");
      }
      if (!buildFormValidator(type.formSchema).safeParse(request.formData).success) {
        throw new ZSAError("UNPROCESSABLE_CONTENT", "Biểu mẫu còn thiếu thông tin bắt buộc");
      }
      if (type.hasLineItems) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(requestItems)
          .where(eq(requestItems.requestId, request.id));
        if (total === 0) throw new ZSAError("UNPROCESSABLE_CONTENT", "Cần ít nhất một hạng mục chi tiết");
      }

      const requester = await loadRequester(tx, ctx.user.id);
      const first = steps[0];
      const { assignee, recipients } = await assign(tx, first, requester);

      const year = new Date().getFullYear();
      const [counter] = await tx
        .insert(requestCounters)
        .values({ year, lastNumber: 1 })
        .onConflictDoUpdate({
          target: requestCounters.year,
          set: { lastNumber: sql`${requestCounters.lastNumber} + 1` },
        })
        .returning({ lastNumber: requestCounters.lastNumber });
      const code = formatRequestCode(year, counter.lastNumber);

      await tx
        .update(requests)
        .set({ status: "PENDING", code, submittedAt: new Date(), departmentId: requester.departmentId })
        .where(eq(requests.id, request.id));
      await openRound(tx, {
        request: { id: request.id, code, title: request.title },
        step: first,
        assignee,
        recipients,
        slaHours: type.slaHours,
      });
      return { id: request.id, code };
    });
  });

async function lockRound(tx: Tx, approvalId: string, actorId: string) {
  const [row] = await tx
    .select({
      id: approvals.id,
      stepOrder: approvals.stepOrder,
      stepName: approvals.stepName,
      result: approvals.result,
      approverId: approvals.approverId,
      approverRole: approvals.approverRole,
      requestId: requests.id,
      requesterId: requests.requesterId,
      requestStatus: requests.status,
      requestTypeId: requests.requestTypeId,
      code: requests.code,
      title: requests.title,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .where(eq(approvals.id, approvalId))
    .for("update");
  if (!row) throw new ZSAError("NOT_FOUND", "Không tìm thấy lượt duyệt");
  if (row.requestStatus !== "PENDING") throw new ZSAError("CONFLICT", "Đơn không còn ở trạng thái chờ duyệt");

  const actor = await getActorContext(actorId);
  const decision = decideAct(row, actor, actor.delegators);
  if (!decision.allowed) {
    if (decision.reason === "NOT_WAITING") throw new ZSAError("CONFLICT", "Lượt duyệt này đã được xử lý");
    if (decision.reason === "OWN_REQUEST") throw new ZSAError("FORBIDDEN", "Bạn không thể tự duyệt đơn của mình");
    throw new ZSAError("FORBIDDEN", "Bạn không phải người duyệt của bước này");
  }
  return { row, onBehalfOfId: decision.onBehalfOfId };
}

export const approveRequest = authedProcedure
  .createServerAction()
  .input(approveInput)
  .handler(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const { row, onBehalfOfId } = await lockRound(tx, input.approvalId, ctx.user.id);
      const now = new Date();
      await tx
        .update(approvals)
        .set({ result: "APPROVED", actedById: ctx.user.id, onBehalfOfId, comment: input.comment, decidedAt: now })
        .where(and(eq(approvals.id, row.id), eq(approvals.result, "WAITING")));

      const { type, steps } = await loadFlow(tx, row.requestTypeId);
      const next = nextStep(steps, row.stepOrder);
      const request = { id: row.requestId, code: row.code ?? "", title: row.title };

      if (next) {
        const requester = await loadRequester(tx, row.requesterId);
        const { assignee, recipients } = await assign(tx, next, requester);
        await openRound(tx, { request, step: next, assignee, recipients, slaHours: type?.slaHours ?? 24 });
        return { completed: false };
      }

      await tx.update(requests).set({ status: "APPROVED", completedAt: now }).where(eq(requests.id, row.requestId));
      await notify(tx, [row.requesterId], {
        type: "REQUEST_APPROVED",
        title: `${request.code} đã được duyệt: ${request.title}`.slice(0, 200),
        href: `/workspace/requests/${row.requestId}`,
      });
      return { completed: true };
    });
  });

export const rejectRequest = authedProcedure
  .createServerAction()
  .input(rejectInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const { row, onBehalfOfId } = await lockRound(tx, input.approvalId, ctx.user.id);
      const now = new Date();
      await tx
        .update(approvals)
        .set({ result: "REJECTED", actedById: ctx.user.id, onBehalfOfId, comment: input.comment, decidedAt: now })
        .where(and(eq(approvals.id, row.id), eq(approvals.result, "WAITING")));
      await tx.update(requests).set({ status: "REJECTED", completedAt: now }).where(eq(requests.id, row.requestId));
      await notify(tx, [row.requesterId], {
        type: "REQUEST_REJECTED",
        title: `${row.code} bị từ chối ở bước ${row.stepName}: ${input.comment}`.slice(0, 200),
        href: `/workspace/requests/${row.requestId}`,
      });
    });
  });

export const cancelRequest = authedProcedure
  .createServerAction()
  .input(cancelInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const [request] = await tx
        .select({ id: requests.id, requesterId: requests.requesterId, status: requests.status, code: requests.code, title: requests.title })
        .from(requests)
        .where(eq(requests.id, input.requestId))
        .for("update");
      if (!request || request.requesterId !== ctx.user.id) {
        throw new ZSAError("NOT_FOUND", "Không tìm thấy đơn của bạn");
      }
      if (request.status !== "PENDING") {
        throw new ZSAError("CONFLICT", "Chỉ hủy được đơn đang chờ duyệt");
      }
      const now = new Date();
      const waiting = await tx
        .update(approvals)
        .set({ result: "CANCELLED", decidedAt: now })
        .where(and(eq(approvals.requestId, request.id), eq(approvals.result, "WAITING")))
        .returning({ approverId: approvals.approverId });
      await tx.update(requests).set({ status: "CANCELLED", completedAt: now }).where(eq(requests.id, request.id));
      await notify(
        tx,
        waiting.flatMap((w) => (w.approverId ? [w.approverId] : [])),
        {
          type: "REQUEST_CANCELLED",
          title: `${request.code} đã bị người đề xuất hủy: ${request.title}`.slice(0, 200),
          href: `/workspace/approvals/history`,
        },
      );
    });
  });

export const getMyPendingApprovalCount = authedProcedure
  .createServerAction()
  .handler(async ({ ctx }) => countPendingApprovals(ctx.user.id));
