import { and, asc, count, desc, eq, inArray, isNotNull, ne, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getActiveDelegators, hasReceivedDelegations } from "@/modules/delegations/delegations.query";
import { departments } from "@/modules/departments/departments.schema";
import { getApprovalSteps } from "@/modules/request-types/request-types.query";
import { requestTypes } from "@/modules/request-types/request-types.schema";
import { requests } from "@/modules/requests/requests.schema";
import { user } from "@/modules/users/users.schema";
import { ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { parseRoles } from "@/shared/libs/role.lib";

import { approvals } from "./approvals.schema";
import { decideAct, hasApproverRole } from "./approvals.service";

export async function getActorContext(userId: string) {
  const [[me], delegators] = await Promise.all([
    db.select({ role: user.role }).from(user).where(eq(user.id, userId)),
    getActiveDelegators(userId),
  ]);
  return { id: userId, roles: parseRoles(me?.role), delegators };
}

export type ActorContext = Awaited<ReturnType<typeof getActorContext>>;

function assignedTo(actor: ActorContext): SQL {
  const ids = [actor.id, ...actor.delegators.map((d) => d.id)];
  const roles = [...new Set([...actor.roles, ...actor.delegators.flatMap((d) => d.roles)])];
  return or(inArray(approvals.approverId, ids), roles.length ? inArray(approvals.approverRole, roles) : undefined)!;
}

function pendingFor(actor: ActorContext) {
  return and(eq(approvals.result, "WAITING"), assignedTo(actor), ne(requests.requesterId, actor.id));
}

export async function canAccessApprovals(userId: string) {
  const actor = await getActorContext(userId);
  if (hasApproverRole(actor.roles) || actor.delegators.length > 0) return true;
  if (await hasReceivedDelegations(userId)) return true;
  const [subordinate] = await db.select({ id: user.id }).from(user).where(eq(user.managerId, userId)).limit(1);
  if (subordinate) return true;
  const [involved] = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(
      or(eq(approvals.approverId, userId), eq(approvals.actedById, userId), eq(approvals.onBehalfOfId, userId)),
    )
    .limit(1);
  return Boolean(involved);
}

const requester = alias(user, "requester");

export async function getPendingApprovals(userId: string) {
  const actor = await getActorContext(userId);
  const rows = await db
    .select({
      approvalId: approvals.id,
      requestId: requests.id,
      code: requests.code,
      title: requests.title,
      totalAmount: requests.totalAmount,
      submittedAt: requests.submittedAt,
      typeName: requestTypes.name,
      requesterId: requests.requesterId,
      requesterName: requester.name,
      departmentName: departments.name,
      stepOrder: approvals.stepOrder,
      stepName: approvals.stepName,
      approverId: approvals.approverId,
      approverRole: approvals.approverRole,
      result: approvals.result,
      dueAt: approvals.dueAt,
      overdue: sql<boolean>`${approvals.dueAt} < now()`,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .innerJoin(requester, eq(requester.id, requests.requesterId))
    .leftJoin(departments, eq(departments.id, requests.departmentId))
    .where(pendingFor(actor))
    .orderBy(asc(approvals.dueAt));

  return rows.flatMap((row) => {
    const decision = decideAct(row, actor, actor.delegators);
    if (!decision.allowed) return [];
    const onBehalfOf = actor.delegators.find((d) => d.id === decision.onBehalfOfId);
    return [{ ...row, onBehalfOfName: onBehalfOf?.name ?? null }];
  });
}

export type PendingApprovalRow = Awaited<ReturnType<typeof getPendingApprovals>>[number];

export async function countPendingApprovals(userId: string) {
  return (await getPendingApprovals(userId)).length;
}

const onBehalfOf = alias(user, "on_behalf_of");
const actedBy = alias(user, "acted_by");

export async function getApprovalHistory(userId: string) {
  return db
    .select({
      approvalId: approvals.id,
      requestId: requests.id,
      code: requests.code,
      title: requests.title,
      typeName: requestTypes.name,
      requesterName: requester.name,
      stepName: approvals.stepName,
      result: approvals.result,
      comment: approvals.comment,
      decidedAt: approvals.decidedAt,
      onBehalfOfName: onBehalfOf.name,
      actedByName: actedBy.name,
      actedByDelegate: sql<boolean>`${approvals.actedById} <> ${userId}`,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .innerJoin(requester, eq(requester.id, requests.requesterId))
    .leftJoin(onBehalfOf, eq(onBehalfOf.id, approvals.onBehalfOfId))
    .leftJoin(actedBy, eq(actedBy.id, approvals.actedById))
    .where(or(eq(approvals.actedById, userId), eq(approvals.onBehalfOfId, userId)))
    .orderBy(desc(approvals.decidedAt));
}

export type ApprovalHistoryRow = Awaited<ReturnType<typeof getApprovalHistory>>[number];

const approver = alias(user, "approver");
const reassignedBy = alias(user, "reassigned_by");

const hasNoActiveAssignee = sql<boolean>`(
  (${approvals.approverId} is not null and not exists (
    select 1 from "user" u where u.id = ${approvals.approverId} and u.banned is not true
  ))
  or (${approvals.approverRole} is not null and not exists (
    select 1 from "user" u
    where u.banned is not true
      and u.id <> ${requests.requesterId}
      and (',' || coalesce(u.role, '') || ',') like '%,' || ${approvals.approverRole} || ',%'
  ))
)`;

export async function getApprovalTimeline(requestId: string) {
  const [request] = await db
    .select({ status: requests.status, requestTypeId: requests.requestTypeId, snapshot: requests.snapshot })
    .from(requests)
    .where(eq(requests.id, requestId));
  if (!request) return { rounds: [], upcoming: [] };

  const rounds = await db
    .select({
      id: approvals.id,
      stepOrder: approvals.stepOrder,
      stepName: approvals.stepName,
      result: approvals.result,
      comment: approvals.comment,
      approverName: approver.name,
      approverRole: approvals.approverRole,
      actedByName: actedBy.name,
      onBehalfOfName: onBehalfOf.name,
      reassignedByName: reassignedBy.name,
      reassignedAt: approvals.reassignedAt,
      createdAt: approvals.createdAt,
      dueAt: approvals.dueAt,
      decidedAt: approvals.decidedAt,
      overdue: sql<boolean>`${approvals.result} = 'WAITING' and ${approvals.dueAt} < now()`,
    })
    .from(approvals)
    .leftJoin(approver, eq(approver.id, approvals.approverId))
    .leftJoin(actedBy, eq(actedBy.id, approvals.actedById))
    .leftJoin(onBehalfOf, eq(onBehalfOf.id, approvals.onBehalfOfId))
    .leftJoin(reassignedBy, eq(reassignedBy.id, approvals.reassignedById))
    .where(eq(approvals.requestId, requestId))
    .orderBy(asc(approvals.createdAt));

  const lastOrder = Math.max(
    0,
    ...rounds.filter((r) => r.result === "APPROVED" || r.result === "WAITING").map((r) => r.stepOrder),
  );
  const upcoming =
    request.status === "DRAFT" || request.status === "PENDING" || request.status === "NEEDS_INFO"
      ? (request.snapshot?.steps ?? (await getApprovalSteps(request.requestTypeId)))
          .filter((s) => s.stepOrder > lastOrder)
          .map((s) => ({ stepOrder: s.stepOrder, name: s.name, approverRole: s.approverRole }))
      : [];

  return { rounds, upcoming };
}

export type ApprovalTimeline = Awaited<ReturnType<typeof getApprovalTimeline>>;

export async function getActionableApproval(requestId: string, userId: string) {
  const actor = await getActorContext(userId);
  const [row] = await db
    .select({
      approvalId: approvals.id,
      stepName: approvals.stepName,
      result: approvals.result,
      approverId: approvals.approverId,
      approverRole: approvals.approverRole,
      requesterId: requests.requesterId,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .where(and(eq(approvals.requestId, requestId), eq(approvals.result, "WAITING")));
  if (!row) return null;
  const decision = decideAct(row, actor, actor.delegators);
  if (!decision.allowed) return null;
  return {
    approvalId: row.approvalId,
    stepName: row.stepName,
    onBehalfOfName: actor.delegators.find((d) => d.id === decision.onBehalfOfId)?.name ?? null,
  };
}

export async function canViewRequest(requestId: string, userId: string) {
  const actor = await getActorContext(userId);
  if (actor.roles.includes(ROLES.ADMIN)) return true;
  const [own] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.requesterId, userId)));
  if (own) return true;
  const [involved] = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(and(eq(approvals.requestId, requestId), or(assignedTo(actor), eq(approvals.actedById, userId))))
    .limit(1);
  return Boolean(involved);
}

export async function getLatestReturn(requestId: string) {
  const [row] = await db
    .select({ stepName: approvals.stepName, comment: approvals.comment, actedByName: actedBy.name, decidedAt: approvals.decidedAt })
    .from(approvals)
    .leftJoin(actedBy, eq(actedBy.id, approvals.actedById))
    .where(and(eq(approvals.requestId, requestId), eq(approvals.result, "RETURNED")))
    .orderBy(desc(approvals.decidedAt))
    .limit(1);
  return row ?? null;
}

export async function getWaitingRound(requestId: string) {
  const [row] = await db
    .select({
      approvalId: approvals.id,
      stepName: approvals.stepName,
      requesterId: requests.requesterId,
      unassignable: hasNoActiveAssignee,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .where(and(eq(approvals.requestId, requestId), eq(approvals.result, "WAITING"), eq(requests.status, "PENDING")));
  return row ?? null;
}

export type WaitingRound = NonNullable<Awaited<ReturnType<typeof getWaitingRound>>>;

export async function listUnassignableApprovals() {
  return db
    .select({
      approvalId: approvals.id,
      requestId: requests.id,
      code: requests.code,
      title: requests.title,
      stepName: approvals.stepName,
      approverName: approver.name,
      approverRole: approvals.approverRole,
      dueAt: approvals.dueAt,
    })
    .from(approvals)
    .innerJoin(requests, eq(requests.id, approvals.requestId))
    .leftJoin(approver, eq(approver.id, approvals.approverId))
    .where(and(eq(approvals.result, "WAITING"), eq(requests.status, "PENDING"), hasNoActiveAssignee))
    .orderBy(asc(approvals.dueAt));
}

export type UnassignableApprovalRow = Awaited<ReturnType<typeof listUnassignableApprovals>>[number];

export async function getAdminOverview() {
  const [[pending], [overdue], byApprover, byRole, unassignable] = await Promise.all([
    db.select({ total: count() }).from(requests).where(eq(requests.status, "PENDING")),
    db
      .select({ total: count() })
      .from(approvals)
      .where(and(eq(approvals.result, "WAITING"), sql`${approvals.dueAt} < now()`)),
    db
      .select({ id: approver.id, name: approver.name, code: approver.employeeCode, total: count() })
      .from(approvals)
      .innerJoin(approver, eq(approver.id, approvals.approverId))
      .where(eq(approvals.result, "WAITING"))
      .groupBy(approver.id, approver.name, approver.employeeCode)
      .orderBy(desc(count()))
      .limit(5),
    db
      .select({ role: approvals.approverRole, total: count() })
      .from(approvals)
      .where(and(eq(approvals.result, "WAITING"), isNotNull(approvals.approverRole)))
      .groupBy(approvals.approverRole)
      .orderBy(desc(count())),
    listUnassignableApprovals(),
  ]);
  return { pending: pending.total, overdue: overdue.total, byApprover, byRole, unassignable };
}

export async function getReportData() {
  const [byType, monthly, stepDurations, [sla]] = await Promise.all([
    db
      .select({ typeName: requestTypes.name, status: requests.status, total: count() })
      .from(requests)
      .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
      .where(ne(requests.status, "DRAFT"))
      .groupBy(requestTypes.name, requests.status)
      .orderBy(asc(requestTypes.name)),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${requests.submittedAt}), 'MM/YYYY')`,
        total: count(),
        approved: sql<number>`count(*) filter (where ${requests.status} = 'APPROVED')`.mapWith(Number),
        rejected: sql<number>`count(*) filter (where ${requests.status} = 'REJECTED')`.mapWith(Number),
      })
      .from(requests)
      .where(and(ne(requests.status, "DRAFT"), sql`${requests.submittedAt} >= date_trunc('month', now()) - interval '5 months'`))
      .groupBy(sql`date_trunc('month', ${requests.submittedAt})`)
      .orderBy(sql`date_trunc('month', ${requests.submittedAt})`),
    db
      .select({
        key: sql<string>`${requestTypes.id} || ':' || ${approvals.stepOrder} || ':' || ${approvals.stepName}`,
        typeName: requestTypes.name,
        stepOrder: approvals.stepOrder,
        stepName: approvals.stepName,
        decided: count(),
        avgHours: sql<number>`round(avg(extract(epoch from ${approvals.decidedAt} - ${approvals.createdAt}) / 3600)::numeric, 1)`.mapWith(
          Number,
        ),
        onTime: sql<number>`count(*) filter (where ${approvals.decidedAt} <= ${approvals.dueAt})`.mapWith(Number),
      })
      .from(approvals)
      .innerJoin(requests, eq(requests.id, approvals.requestId))
      .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
      .where(inArray(approvals.result, ["APPROVED", "REJECTED", "RETURNED"]))
      .groupBy(requestTypes.id, requestTypes.name, approvals.stepOrder, approvals.stepName)
      .orderBy(asc(requestTypes.name), asc(approvals.stepOrder)),
    db
      .select({
        decided: count(),
        onTime: sql<number>`count(*) filter (where ${approvals.decidedAt} <= ${approvals.dueAt})`.mapWith(Number),
      })
      .from(approvals)
      .where(inArray(approvals.result, ["APPROVED", "REJECTED", "RETURNED"])),
  ]);
  return { byType, monthly, stepDurations, sla };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
