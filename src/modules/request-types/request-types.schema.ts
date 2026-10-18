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

// Shape is defined and validated in request-types.validation.ts (phase 5).
export type FormField = Record<string, unknown>;

// LOAI_YEU_CAU
export const requestTypes = pgTable(
  "request_types",
  {
    id: id(),
    code: varchar({ length: 30 }).notNull().unique(), // MaLoaiYeuCau
    name: varchar({ length: 100 }).notNull(), // TenLoaiYeuCau
    description: varchar({ length: 500 }), // MoTa
    slaHours: integer().notNull(), // ThoiHanSLA
    hasLineItems: boolean().notNull().default(false), // UC-02 bước 6
    formSchema: jsonb().$type<FormField[]>().notNull().default([]), // UC-09
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [check("request_types_sla_hours_positive", sql`${t.slaHours} > 0`)],
);

export const approverType = pgEnum("approver_type", ["MANAGER", "ROLE"]);

// BUOC_DUYET
export const approvalSteps = pgTable(
  "approval_steps",
  {
    id: id(), // MaBuocDuyet
    requestTypeId: text()
      .notNull()
      .references(() => requestTypes.id, { onDelete: "cascade" }), // Gồm Các Bước
    stepOrder: integer().notNull(), // ThuTuBuoc
    name: varchar({ length: 100 }).notNull(), // TenBuoc
    approverType: approverType().notNull(), // KieuNguoiDuyet
    approverRole: varchar({ length: 30 }), // G2: functional role for ROLE steps
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
