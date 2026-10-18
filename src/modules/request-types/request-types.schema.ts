import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "@/shared/libs/schema.lib";

export type FormField = Record<string, unknown>;

export const requestTypes = pgTable(
  "request_types",
  {
    id: id(),
    code: varchar({ length: 30 }).notNull().unique(),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 500 }),
    slaHours: integer().notNull(),
    hasLineItems: boolean().notNull().default(false),
    formSchema: jsonb().$type<FormField[]>().notNull().default([]),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [check("request_types_sla_hours_positive", sql`${t.slaHours} > 0`)],
);

export const approverType = pgEnum("approver_type", ["MANAGER", "ROLE"]);

export const approvalSteps = pgTable(
  "approval_steps",
  {
    id: id(),
    requestTypeId: text()
      .notNull()
      .references(() => requestTypes.id, { onDelete: "cascade" }),
    stepOrder: integer().notNull(),
    name: varchar({ length: 100 }).notNull(),
    approverType: approverType().notNull(),
    approverRole: varchar({ length: 30 }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.requestTypeId, t.stepOrder),
    check("approval_steps_step_order_positive", sql`${t.stepOrder} > 0`),
    check(
      "approval_steps_role_matches_type",
      sql`(${t.approverType} = 'ROLE') = (${t.approverRole} is not null)`,
    ),
  ],
);
