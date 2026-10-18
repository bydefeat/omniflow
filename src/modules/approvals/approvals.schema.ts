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

// LUOT_PHE_DUYET — also the audit trail: decided rows are never updated or deleted.
export const approvals = pgTable(
  "approvals",
  {
    id: id(), // MaLuotDuyet
    requestId: text()
      .notNull()
      .references(() => requests.id), // Sinh Ra Lượt Duyệt
    stepOrder: integer().notNull(), // ThuTuDuyet
    stepName: varchar({ length: 100 }).notNull(), // snapshot of TenBuoc
    approverId: text().references(() => user.id), // MANAGER step
    approverRole: varchar({ length: 30 }), // ROLE step (G2)
    actedById: text().references(() => user.id), // who clicked
    onBehalfOfId: text().references(() => user.id), // delegation (G5)
    result: approvalResult().notNull().default("WAITING"), // KetQua
    comment: varchar({ length: 500 }), // YKienPhanHoi
    dueAt: timestamp({ withTimezone: true }).notNull(), // created + slaHours
    decidedAt: timestamp({ withTimezone: true }), // NgayQuyetDinh
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
