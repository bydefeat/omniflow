import { asc, sql } from "drizzle-orm";

import { db } from "@/shared/libs/db.lib";

import { departments } from "./departments.schema";

export async function listDepartments() {
  return db
    .select({
      id: departments.id,
      code: departments.code,
      name: departments.name,
      phone: departments.phone,
      userCount: sql<number>`(select count(*) from "user" u where u.department_id = ${departments.id})`.mapWith(
        Number,
      ),
    })
    .from(departments)
    .orderBy(asc(departments.code));
}

export type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

export async function listDepartmentOptions() {
  return db
    .select({ id: departments.id, code: departments.code, name: departments.name })
    .from(departments)
    .orderBy(asc(departments.name));
}

export type DepartmentOption = Awaited<ReturnType<typeof listDepartmentOptions>>[number];
