"use server";

import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { after } from "next/server";

import { recordAudit } from "@/modules/audit/audit.service";
import { approvalSteps, requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator } from "@/modules/request-types/request-types.validation";
import {
  attachments,
  requestCounters,
  requestItems,
  requestRevisions,
  requests,
  type RequestSnapshot,
} from "@/modules/requests/requests.schema";
import { formatRequestCode } from "@/modules/requests/requests.service";
import { user } from "@/modules/users/users.schema";
import { ROLES } from "@/shared/constants/role.constant";
import { ActionError, authedProcedure, roleProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { flushMailOutbox, isMailConfigured } from "@/shared/libs/mail.lib";
import { logger } from "@/shared/libs/logger.lib";

import {
  findRoleHolders,
  type Outbox,
  notify,
  type Tx,
  queueNotificationMails,
  roleLabel,
  withDelegates,
} from "./approvals.notify";
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

async function inTransaction<T>(work: (tx: Tx, outbox: Outbox) => Promise<T>) {
  const result = await db.transaction(async (tx) => {
    const outbox: Outbox = [];
    const value = await work(tx, outbox);
    await queueNotificationMails(tx, outbox);
    return value;
  });
  if (isMailConfigured) after(() => flushMailOutbox().catch((error) => logger.error("mail.flush_failed", { error })));
  return result;
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

async function saveRevision(tx: Tx, requestId: string) {
  const [[content], items, files, [{ last }]] = await Promise.all([
    tx
      .select({ title: requests.title, reason: requests.reason, formData: requests.formData, totalAmount: requests.totalAmount })
      .from(requests)
      .where(eq(requests.id, requestId)),
    tx
      .select({
        name: requestItems.name,
        unit: requestItems.unit,
        quantity: requestItems.quantity,
        unitPrice: requestItems.unitPrice,
        amount: requestItems.amount,
      })
      .from(requestItems)
      .where(eq(requestItems.requestId, requestId))
      .orderBy(asc(requestItems.sortOrder)),
    tx
      .select({ id: attachments.id, fileName: attachments.fileName, sizeBytes: attachments.sizeBytes })
      .from(attachments)
      .where(and(eq(attachments.requestId, requestId), isNull(attachments.removedAt)))
      .orderBy(asc(attachments.uploadedAt)),
    tx
      .select({ last: sql<number>`coalesce(max(${requestRevisions.revision}), 0)::int` })
      .from(requestRevisions)
      .where(eq(requestRevisions.requestId, requestId)),
  ]);
  await tx.insert(requestRevisions).values({ requestId, revision: last + 1, ...content, items, attachments: files });
}

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
      await saveRevision(tx, row.requestId);
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

      const step = flow.steps[0];
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
      if (request.status === "NEEDS_INFO") {
        const [returned] = await tx
          .select({ actedById: approvals.actedById })
          .from(approvals)
          .where(and(eq(approvals.requestId, request.id), eq(approvals.result, "RETURNED")))
          .orderBy(desc(approvals.decidedAt))
          .limit(1);
        if (returned?.actedById) assignees.push(returned.actedById);
      }
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
      const [assignee] = await tx
        .select({ banned: user.banned, name: user.name })
        .from(user)
        .where(eq(user.id, input.approverId));
      if (!assignee || assignee.banned) {
        throw new ActionError("UNPROCESSABLE_CONTENT", "Người được chọn không tồn tại hoặc đã bị khóa");
      }
      await tx
        .update(approvals)
        .set({
          approverId: input.approverId,
          approverRole: null,
          reassignedById: ctx.user.id,
          reassignedAt: new Date(),
          remindedAt: null,
        })
        .where(eq(approvals.id, row.id));
      await recordAudit(tx, ctx.user, {
        action: "APPROVAL_REASSIGNED",
        targetType: "approval",
        targetId: row.id,
        summary: `${row.code} · ${row.stepName} → ${assignee.name}`,
        changes: {
          approverId: { from: row.approverId, to: input.approverId },
          approverRole: { from: row.approverRole, to: null },
        },
      });
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
