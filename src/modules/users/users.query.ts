import { and, asc, eq, not, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { departments } from "@/modules/departments/departments.schema";
import { db } from "@/shared/libs/db.lib";

import { user } from "./users.schema";

const manager = alias(user, "manager");

export async function listUsers() {
  return db
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
    .orderBy(asc(user.employeeCode));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

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
