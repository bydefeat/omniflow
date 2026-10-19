"use server";

import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { after } from "next/server";

import { getActiveDelegates } from "@/modules/delegations/delegations.query";
import { notifications } from "@/modules/notifications/notifications.schema";
import { approvalSteps, requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator } from "@/modules/request-types/request-types.validation";
import { requestCounters, requestItems, requests, type RequestSnapshot } from "@/modules/requests/requests.schema";
import { formatRequestCode } from "@/modules/requests/requests.service";
import { user } from "@/modules/users/users.schema";
import { FUNCTIONAL_ROLES, ROLES } from "@/shared/constants/role.constant";
import { ActionError, authedProcedure, roleProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";
import { flushMailOutbox, isMailConfigured, queueMail } from "@/shared/libs/mail.lib";

import { countPendingApprovals, getActorContext } from "./approvals.query";
import { approvals } from "./approvals.schema";
import { type Assignee, computeDueAt, decideAct, nextStep, resolveAssignee, type StepConfig } from "./approvals.service";
import {
  approveInput,
  cancelInput,
  reassignInput,
  rejectInput,
  returnInput,
  submitInput,
} from "./approvals.validation";

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
    throw new ActionError(
      "PRECONDITION_FAILED",
      `Bước "${step.name}" cần quản lý trực tiếp nhưng người làm đơn chưa được gán quản lý. Vui lòng liên hệ quản trị viên.`,
    );
  }
  const recipients =
    assignee.approverRole === null
      ? [assignee.approverId]
      : await findRoleHolders(tx, assignee.approverRole, requester.id);
  if (recipients.length === 0) {
    throw new ActionError(
      "PRECONDITION_FAILED",
      `Bước "${step.name}" chưa có ai giữ vai trò ${roleLabel(step.approverRole ?? "")}. Vui lòng liên hệ quản trị viên.`,
    );
  }
  if (assignee.approverId) {
    const [manager] = await tx
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, assignee.approverId));
    if (manager?.banned) {
      throw new ActionError(
        "PRECONDITION_FAILED",
        `Quản lý trực tiếp cho bước "${step.name}" đang bị khóa tài khoản. Vui lòng liên hệ quản trị viên.`,
      );
    }
  }
  return { assignee, recipients };
}

type Outbox = { userIds: string[]; title: string; href: string }[];

async function notify(
  tx: Tx,
  outbox: Outbox,
  userIds: string[],
  payload: { type: NotificationType; title: string; href: string },
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.insert(notifications).values(unique.map((userId) => ({ userId, ...payload })));
  outbox.push({ userIds: unique, title: payload.title, href: payload.href });
}

async function queueNotificationMails(tx: Tx, outbox: Outbox) {
  if (!isMailConfigured || outbox.length === 0) return;
  const recipients = await tx
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(and(inArray(user.id, [...new Set(outbox.flatMap((m) => m.userIds))]), sql`${user.banned} is not true`));
  await queueMail(
    tx,
    outbox.flatMap((message) =>
      recipients
        .filter((r) => message.userIds.includes(r.id))
        .map((recipient) => ({
          to: recipient.email,
          subject: message.title,
          text: `Chào ${recipient.name},\n\n${message.title}\n\nXem chi tiết: ${new URL(message.href, env.DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL)}`,
        })),
    ),
  );
}

async function inTransaction<T>(work: (tx: Tx, outbox: Outbox) => Promise<T>) {
  const result = await db.transaction(async (tx) => {
    const outbox: Outbox = [];
    const value = await work(tx, outbox);
    await queueNotificationMails(tx, outbox);
    return value;
  });
  if (isMailConfigured) after(() => flushMailOutbox().catch((error) => console.error("[mail] flush thất bại", error)));
  return result;
}

async function withDelegates(userIds: string[], requesterId: string) {
  const delegates = await getActiveDelegates(userIds);
  return [...userIds, ...delegates.map((d) => d.delegateId)].filter((id) => id !== requesterId);
}

async function openRound(
  tx: Tx,
  outbox: Outbox,
  args: {
    request: { id: string; code: string; title: string; requesterId: string };
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
  await notify(tx, outbox, await withDelegates(args.recipients, args.request.requesterId), {
    type: "APPROVAL_NEEDED",
    title: `${args.request.code} chờ bạn duyệt (${args.step.name}): ${args.request.title}`.slice(0, 200),
    href: `/workspace/approvals/${args.request.id}`,
  });
}

async function snapshotFlow(tx: Tx, requestTypeId: string) {
  const [type] = await tx
    .select({
      isActive: requestTypes.isActive,
      slaHours: requestTypes.slaHours,
      formSchema: requestTypes.formSchema,
      hasLineItems: requestTypes.hasLineItems,
    })
    .from(requestTypes)
    .where(eq(requestTypes.id, requestTypeId))
    .for("share");
  if (!type?.isActive) throw new ActionError("PRECONDITION_FAILED", "Loại đơn đã ngừng sử dụng");
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
  const snapshot: RequestSnapshot = {
    formSchema: type.formSchema,
    hasLineItems: type.hasLineItems,
    slaHours: type.slaHours,
    steps,
  };
  return snapshot;
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
    return inTransaction(async (tx, outbox) => {
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
        throw new ActionError("NOT_FOUND", "Không tìm thấy đơn của bạn");
      }
      if (request.status !== "DRAFT") throw new ActionError("CONFLICT", "Đơn này đã được gửi");

      const flow = await snapshotFlow(tx, request.requestTypeId);
      const { steps } = flow;
      if (steps.length === 0) {
        throw new ActionError("PRECONDITION_FAILED", "Loại đơn chưa được cấu hình bước duyệt");
      }
      const form = buildFormValidator(flow.formSchema).safeParse(request.formData);
      if (!form.success) {
        const field = flow.formSchema.find((f) => f.key === form.error.issues[0]?.path[0]);
        throw new ActionError(
          "UNPROCESSABLE_CONTENT",
          field ? `Biểu mẫu chưa hợp lệ ở trường "${field.label}"` : "Biểu mẫu còn thiếu thông tin bắt buộc",
        );
      }
      if (flow.hasLineItems) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(requestItems)
          .where(eq(requestItems.requestId, request.id));
        if (total === 0) throw new ActionError("UNPROCESSABLE_CONTENT", "Cần ít nhất một hạng mục chi tiết");
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
        .set({ status: "PENDING", code, submittedAt: new Date(), departmentId: requester.departmentId, snapshot: flow })
        .where(eq(requests.id, request.id));
      await openRound(tx, outbox, {
        request: { id: request.id, code, title: request.title, requesterId: request.requesterId },
        step: first,
        assignee,
        recipients,
        slaHours: flow.slaHours,
      });
      return { id: request.id, code };
    });
  });

async function lockRequestAndRound(tx: Tx, approvalId: string) {
  const [target] = await tx
    .select({ requestId: approvals.requestId })
    .from(approvals)
    .where(eq(approvals.id, approvalId));
  if (!target) throw new ActionError("NOT_FOUND", "Không tìm thấy lượt duyệt");
  const [request] = await tx
    .select({
      requestId: requests.id,
      requesterId: requests.requesterId,
      requestStatus: requests.status,
      snapshot: requests.snapshot,
      code: requests.code,
      title: requests.title,
    })
    .from(requests)
    .where(eq(requests.id, target.requestId))
    .for("update");
  const [round] = await tx
    .select({
      id: approvals.id,
      stepOrder: approvals.stepOrder,
      stepName: approvals.stepName,
      result: approvals.result,
      approverId: approvals.approverId,
      approverRole: approvals.approverRole,
    })
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .for("update");
  const row = request && round ? { ...request, ...round } : null;
  if (!row) throw new ActionError("NOT_FOUND", "Không tìm thấy lượt duyệt");
  return row;
}

async function lockRound(tx: Tx, approvalId: string, actorId: string) {
  const row = await lockRequestAndRound(tx, approvalId);
  if (row.requestStatus !== "PENDING") throw new ActionError("CONFLICT", "Đơn không còn ở trạng thái chờ duyệt");

  const actor = await getActorContext(actorId);
  const decision = decideAct(row, actor, actor.delegators);
  if (!decision.allowed) {
    if (decision.reason === "NOT_WAITING") throw new ActionError("CONFLICT", "Lượt duyệt này đã được xử lý");
    if (decision.reason === "OWN_REQUEST") throw new ActionError("FORBIDDEN", "Bạn không thể tự duyệt đơn của mình");
    throw new ActionError("FORBIDDEN", "Bạn không phải người duyệt của bước này");
  }
  return { row, onBehalfOfId: decision.onBehalfOfId };
}

export const approveRequest = authedProcedure
  .createServerAction()
  .input(approveInput)
  .handler(async ({ input, ctx }) => {
    return inTransaction(async (tx, outbox) => {
      const { row, onBehalfOfId } = await lockRound(tx, input.approvalId, ctx.user.id);
      const now = new Date();
      await tx
        .update(approvals)
        .set({ result: "APPROVED", actedById: ctx.user.id, onBehalfOfId, comment: input.comment, decidedAt: now })
        .where(and(eq(approvals.id, row.id), eq(approvals.result, "WAITING")));

      const flow = row.snapshot!;
      const next = nextStep(flow.steps, row.stepOrder);
      const request = { id: row.requestId, code: row.code ?? "", title: row.title, requesterId: row.requesterId };

      if (next) {
        const requester = await loadRequester(tx, row.requesterId);
        const { assignee, recipients } = await assign(tx, next, requester);
        await openRound(tx, outbox, { request, step: next, assignee, recipients, slaHours: flow.slaHours });
        return { completed: false };
      }

      await tx.update(requests).set({ status: "APPROVED", completedAt: now }).where(eq(requests.id, row.requestId));
      await notify(tx, outbox, [row.requesterId], {
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
    await inTransaction(async (tx, outbox) => {
      const { row, onBehalfOfId } = await lockRound(tx, input.approvalId, ctx.user.id);
      const now = new Date();
      await tx
        .update(approvals)
        .set({ result: "REJECTED", actedById: ctx.user.id, onBehalfOfId, comment: input.comment, decidedAt: now })
        .where(and(eq(approvals.id, row.id), eq(approvals.result, "WAITING")));
      await tx.update(requests).set({ status: "REJECTED", completedAt: now }).where(eq(requests.id, row.requestId));
      await notify(tx, outbox, [row.requesterId], {
        type: "REQUEST_REJECTED",
        title: `${row.code} bị từ chối ở bước ${row.stepName}: ${input.comment}`.slice(0, 200),
        href: `/workspace/requests/${row.requestId}`,
      });
    });
  });

export const returnRequest = authedProcedure
  .createServerAction()
  .input(returnInput)
  .handler(async ({ input, ctx }) => {
    await inTransaction(async (tx, outbox) => {
      const { row, onBehalfOfId } = await lockRound(tx, input.approvalId, ctx.user.id);
      await tx
        .update(approvals)
        .set({ result: "RETURNED", actedById: ctx.user.id, onBehalfOfId, comment: input.comment, decidedAt: new Date() })
        .where(and(eq(approvals.id, row.id), eq(approvals.result, "WAITING")));
      await tx.update(requests).set({ status: "NEEDS_INFO" }).where(eq(requests.id, row.requestId));
      await notify(tx, outbox, [row.requesterId], {
        type: "REQUEST_RETURNED",
        title: `${row.code} cần bổ sung ở bước ${row.stepName}: ${input.comment}`.slice(0, 200),
        href: `/workspace/requests/${row.requestId}`,
      });
    });
  });

export const resubmitRequest = authedProcedure
  .createServerAction()
  .input(submitInput)
  .handler(async ({ input, ctx }) => {
    return inTransaction(async (tx, outbox) => {
      const [request] = await tx
        .select({
          id: requests.id,
          requesterId: requests.requesterId,
          status: requests.status,
          code: requests.code,
          title: requests.title,
          formData: requests.formData,
          snapshot: requests.snapshot,
        })
        .from(requests)
        .where(eq(requests.id, input.requestId))
        .for("update");
      if (!request || request.requesterId !== ctx.user.id) {
        throw new ActionError("NOT_FOUND", "Không tìm thấy đơn của bạn");
      }
      if (request.status !== "NEEDS_INFO") throw new ActionError("CONFLICT", "Đơn này không ở trạng thái cần bổ sung");
      const flow = request.snapshot!;
      const form = buildFormValidator(flow.formSchema).safeParse(request.formData);
      if (!form.success) {
        const field = flow.formSchema.find((f) => f.key === form.error.issues[0]?.path[0]);
        throw new ActionError(
          "UNPROCESSABLE_CONTENT",
          field ? `Biểu mẫu chưa hợp lệ ở trường "${field.label}"` : "Biểu mẫu còn thiếu thông tin bắt buộc",
        );
      }
      if (flow.hasLineItems) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(requestItems)
          .where(eq(requestItems.requestId, request.id));
        if (total === 0) throw new ActionError("UNPROCESSABLE_CONTENT", "Cần ít nhất một hạng mục chi tiết");
      }

      const [returned] = await tx
        .select({ stepOrder: approvals.stepOrder })
        .from(approvals)
        .where(and(eq(approvals.requestId, request.id), eq(approvals.result, "RETURNED")))
        .orderBy(desc(approvals.decidedAt))
        .limit(1);
      const step = flow.steps.find((s) => s.stepOrder === returned?.stepOrder) ?? flow.steps[0];
      const requester = await loadRequester(tx, ctx.user.id);
      const { assignee, recipients } = await assign(tx, step, requester);

      await tx.update(requests).set({ status: "PENDING" }).where(eq(requests.id, request.id));
      await openRound(tx, outbox, {
        request: { id: request.id, code: request.code ?? "", title: request.title, requesterId: request.requesterId },
        step,
        assignee,
        recipients,
        slaHours: flow.slaHours,
      });
      return { id: request.id };
    });
  });

export const cancelRequest = authedProcedure
  .createServerAction()
  .input(cancelInput)
  .handler(async ({ input, ctx }) => {
    await inTransaction(async (tx, outbox) => {
      const [request] = await tx
        .select({ id: requests.id, requesterId: requests.requesterId, status: requests.status, code: requests.code, title: requests.title })
        .from(requests)
        .where(eq(requests.id, input.requestId))
        .for("update");
      if (!request || request.requesterId !== ctx.user.id) {
        throw new ActionError("NOT_FOUND", "Không tìm thấy đơn của bạn");
      }
      if (request.status !== "PENDING" && request.status !== "NEEDS_INFO") {
        throw new ActionError("CONFLICT", "Chỉ hủy được đơn đang chờ duyệt hoặc đang chờ bổ sung");
      }
      const now = new Date();
      const waiting = await tx
        .update(approvals)
        .set({ result: "CANCELLED", decidedAt: now })
        .where(and(eq(approvals.requestId, request.id), eq(approvals.result, "WAITING")))
        .returning({ approverId: approvals.approverId, approverRole: approvals.approverRole });
      await tx.update(requests).set({ status: "CANCELLED", completedAt: now }).where(eq(requests.id, request.id));
      const assignees = (
        await Promise.all(
          waiting.map((w) => (w.approverId ? [w.approverId] : findRoleHolders(tx, w.approverRole!, request.requesterId))),
        )
      ).flat();
      await notify(
        tx,
        outbox,
        await withDelegates(assignees, request.requesterId),
        {
          type: "REQUEST_CANCELLED",
          title: `${request.code} đã bị người đề xuất hủy: ${request.title}`.slice(0, 200),
          href: `/workspace/approvals/${request.id}`,
        },
      );
    });
  });

export const reassignApproval = roleProcedure(ROLES.ADMIN)
  .createServerAction()
  .input(reassignInput)
  .handler(async ({ input, ctx }) => {
    await inTransaction(async (tx, outbox) => {
      const row = await lockRequestAndRound(tx, input.approvalId);
      if (row.requestStatus !== "PENDING" || row.result !== "WAITING") {
        throw new ActionError("CONFLICT", "Lượt duyệt này đã được xử lý");
      }
      if (input.approverId === row.requesterId) {
        throw new ActionError("UNPROCESSABLE_CONTENT", "Không thể giao cho chính người làm đơn");
      }
      const [assignee] = await tx.select({ banned: user.banned }).from(user).where(eq(user.id, input.approverId));
      if (!assignee || assignee.banned) {
        throw new ActionError("UNPROCESSABLE_CONTENT", "Người được chọn không tồn tại hoặc đã bị khóa");
      }
      await tx
        .update(approvals)
        .set({ approverId: input.approverId, approverRole: null, reassignedById: ctx.user.id, reassignedAt: new Date() })
        .where(eq(approvals.id, row.id));
      await notify(tx, outbox, await withDelegates([input.approverId], row.requesterId), {
        type: "APPROVAL_NEEDED",
        title: `${row.code} được giao cho bạn duyệt (${row.stepName}): ${row.title}`.slice(0, 200),
        href: `/workspace/approvals/${row.requestId}`,
      });
    });
  });

export const getMyPendingApprovalCount = authedProcedure
  .createServerAction()
  .handler(async ({ ctx }) => countPendingApprovals(ctx.user.id));
