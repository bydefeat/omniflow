import { and, count, desc, eq, gt, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "@/modules/users/users.schema";
import { APPROVER_ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { escapeLike, PAGE_SIZE } from "@/shared/libs/list-params.lib";
import { parseRoles } from "@/shared/libs/role.lib";

import type { DelegationStatus } from "./delegations.constant";
import { delegations } from "./delegations.schema";

export async function getActiveDelegators(delegateId: string) {
  const rows = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(delegations)
    .innerJoin(user, eq(user.id, delegations.delegatorId))
    .where(
      and(
        eq(delegations.delegateId, delegateId),
        eq(delegations.status, "ACTIVE"),
        lte(delegations.startsAt, sql`now()`),
        gt(delegations.endsAt, sql`now()`),
        sql`${user.banned} is not true`,
      ),
    );
  return rows.map((r) => ({ id: r.id, name: r.name, roles: parseRoles(r.role) }));
}

export async function getActiveDelegates(delegatorIds: string[]) {
  if (delegatorIds.length === 0) return [];
  return db
    .select({ delegatorId: delegations.delegatorId, delegateId: delegations.delegateId })
    .from(delegations)
    .where(
      and(
        inArray(delegations.delegatorId, delegatorIds),
        eq(delegations.status, "ACTIVE"),
        lte(delegations.startsAt, sql`now()`),
        gt(delegations.endsAt, sql`now()`),
      ),
    );
}

export async function canDelegate(userId: string) {
  const [me] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId));
  if (parseRoles(me?.role).some((r) => APPROVER_ROLES.includes(r))) return true;
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.managerId, userId))
    .limit(1);
  return Boolean(row);
}

export async function hasReceivedDelegations(userId: string) {
  const [row] = await db
    .select({ id: delegations.id })
    .from(delegations)
    .where(eq(delegations.delegateId, userId))
    .limit(1);
  return Boolean(row);
}

const delegate = alias(user, "delegate");
const delegator = alias(user, "delegator");

const displayStatus = sql<"ACTIVE" | "UPCOMING" | "EXPIRED" | "CANCELLED">`case
  when ${delegations.status} = 'CANCELLED' then 'CANCELLED'
  when ${delegations.endsAt} <= now() then 'EXPIRED'
  when ${delegations.startsAt} > now() then 'UPCOMING'
  else 'ACTIVE' end`;

export async function listMyDelegations(userId: string) {
  const columns = {
    id: delegations.id,
    startsAt: delegations.startsAt,
    endsAt: delegations.endsAt,
    reason: delegations.reason,
    displayStatus,
  };
  const [given, received] = await Promise.all([
    db
      .select({ ...columns, otherName: delegate.name, otherCode: delegate.employeeCode })
      .from(delegations)
      .innerJoin(delegate, eq(delegate.id, delegations.delegateId))
      .where(eq(delegations.delegatorId, userId))
      .orderBy(desc(delegations.startsAt)),
    db
      .select({ ...columns, otherName: delegator.name, otherCode: delegator.employeeCode })
      .from(delegations)
      .innerJoin(delegator, eq(delegator.id, delegations.delegatorId))
      .where(eq(delegations.delegateId, userId))
      .orderBy(desc(delegations.startsAt)),
  ]);
  return { given, received };
}

export type DelegationRow = Awaited<ReturnType<typeof listMyDelegations>>["given"][number];

export type DelegationFilters = { q?: string; status?: DelegationStatus; page: number };

export async function searchDelegations(filters: DelegationFilters) {
  const q = filters.q && `%${escapeLike(filters.q)}%`;
  const where = and(
    q ? or(ilike(delegator.name, q), ilike(delegate.name, q), ilike(delegations.reason, q)) : undefined,
    filters.status ? sql`${displayStatus} = ${filters.status}` : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: delegations.id,
        startsAt: delegations.startsAt,
        endsAt: delegations.endsAt,
        reason: delegations.reason,
        displayStatus,
        delegatorName: delegator.name,
        delegatorCode: delegator.employeeCode,
        delegateName: delegate.name,
        delegateCode: delegate.employeeCode,
      })
      .from(delegations)
      .innerJoin(delegator, eq(delegator.id, delegations.delegatorId))
      .innerJoin(delegate, eq(delegate.id, delegations.delegateId))
      .where(where)
      .orderBy(desc(delegations.startsAt), desc(delegations.id))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(delegations)
      .innerJoin(delegator, eq(delegator.id, delegations.delegatorId))
      .innerJoin(delegate, eq(delegate.id, delegations.delegateId))
      .where(where),
  ]);
  return { rows, total };
}

export type AdminDelegationRow = Awaited<ReturnType<typeof searchDelegations>>["rows"][number];
