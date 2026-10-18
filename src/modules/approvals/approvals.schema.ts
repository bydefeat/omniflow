import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { requests } from "@/modules/requests/requests.schema";
import { user } from "@/modules/users/users.schema";
import { id, timestamps } from "@/shared/libs/schema.lib";

export const approvalResult = pgEnum("approval_result", [
  "WAITING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    requestId: text()
      .notNull()
      .references(() => requests.id),
    stepOrder: integer().notNull(),
    stepName: varchar({ length: 100 }).notNull(),
    approverId: text().references(() => user.id),
    approverRole: varchar({ length: 30 }),
    actedById: text().references(() => user.id),
    onBehalfOfId: text().references(() => user.id),
    result: approvalResult().notNull().default("WAITING"),
    comment: varchar({ length: 500 }),
    dueAt: timestamp({ withTimezone: true }).notNull(),
    decidedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique().on(t.requestId, t.stepOrder),
    index().on(t.approverId, t.result),
    index().on(t.approverRole, t.result),
    check(
      "approvals_single_assignee",
      sql`num_nonnulls(${t.approverId}, ${t.approverRole}) = 1`,
    ),
    check(
      "approvals_reject_needs_comment",
      sql`${t.result} <> 'REJECTED' or ${t.comment} is not null`,
    ),
    check(
      "approvals_decided_fields",
      sql`(${t.result} in ('APPROVED', 'REJECTED')) = (${t.actedById} is not null and ${t.decidedAt} is not null)`,
    ),
  ],
);
