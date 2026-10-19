import { and, asc, count, eq, ilike, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { departments } from "@/modules/departments/departments.schema";
import { db } from "@/shared/libs/db.lib";
import { escapeLike, PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { user } from "./users.schema";

const manager = alias(user, "manager");

export type UserFilters = { q?: string; departmentId?: string; role?: string; page: number };

export async function searchUsers(filters: UserFilters) {
  const q = filters.q && `%${escapeLike(filters.q)}%`;
  const where = and(
    q ? or(ilike(user.name, q), ilike(user.email, q), ilike(user.employeeCode, q)) : undefined,
    filters.departmentId ? eq(user.departmentId, filters.departmentId) : undefined,
    filters.role ? sql`(',' || coalesce(${user.role}, '') || ',') like ${`%,${filters.role},%`}` : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeCode: user.employeeCode,
        role: user.role,
        banned: user.banned,
        departmentId: user.departmentId,
        departmentName: departments.name,
        managerId: user.managerId,
        managerName: manager.name,
        createdAt: user.createdAt,
      })
      .from(user)
      .innerJoin(departments, eq(departments.id, user.departmentId))
      .leftJoin(manager, eq(manager.id, user.managerId))
      .where(where)
      .orderBy(asc(user.employeeCode))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(user).where(where),
  ]);
  return { rows, total };
}

export type UserRow = Awaited<ReturnType<typeof searchUsers>>["rows"][number];

export async function listUserOptions(options: { excludeId?: string } = {}) {
  return db
    .select({
      id: user.id,
      name: user.name,
      employeeCode: user.employeeCode,
      role: user.role,
    })
    .from(user)
    .where(
      and(
        sql`${user.banned} is not true`,
        options.excludeId ? not(eq(user.id, options.excludeId)) : undefined,
      ),
    )
    .orderBy(asc(user.name));
}

export async function countUsers() {
  const [row] = await db.select({ total: count() }).from(user);
  return row.total;
}

export type UserOption = Awaited<ReturnType<typeof listUserOptions>>[number];

export async function getUserProfile(id: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      role: user.role,
      departmentName: departments.name,
      managerName: manager.name,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(departments, eq(departments.id, user.departmentId))
    .leftJoin(manager, eq(manager.id, user.managerId))
    .where(eq(user.id, id));
  return row ?? null;
}

export type UserProfile = NonNullable<Awaited<ReturnType<typeof getUserProfile>>>;
