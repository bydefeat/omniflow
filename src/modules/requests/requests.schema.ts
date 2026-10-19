import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { departments } from "@/modules/departments/departments.schema";
import { requestTypes } from "@/modules/request-types/request-types.schema";
import type { FormField } from "@/modules/request-types/request-types.validation";
import { user } from "@/modules/users/users.schema";
import { id, timestamps } from "@/shared/libs/schema.lib";

export const requestStatus = pgEnum("request_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export type RequestSnapshot = {
  formSchema: FormField[];
  hasLineItems: boolean;
  slaHours: number;
  steps: { stepOrder: number; name: string; approverType: "MANAGER" | "ROLE"; approverRole: string | null }[];
};

export const requests = pgTable(
  "requests",
  {
    id: id(),
    code: varchar({ length: 30 }).unique(),
    requesterId: text()
      .notNull()
      .references(() => user.id),
    requestTypeId: text()
      .notNull()
      .references(() => requestTypes.id),
    departmentId: text().references(() => departments.id),
    title: varchar({ length: 200 }).notNull(),
    reason: text().notNull(),
    formData: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    totalAmount: numeric({ precision: 18, scale: 2 }),
    snapshot: jsonb().$type<RequestSnapshot>(),
    status: requestStatus().notNull().default("DRAFT"),
    submittedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.requesterId, t.status),
    index().on(t.status, t.submittedAt),
    check(
      "requests_code_after_submit",
      sql`(${t.status} = 'DRAFT') or (${t.code} is not null and ${t.submittedAt} is not null)`,
    ),
    check("requests_snapshot_after_submit", sql`(${t.status} = 'DRAFT') = (${t.snapshot} is null)`),
  ],
);

export const requestItems = pgTable(
  "request_items",
  {
    id: id(),
    requestId: text()
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    sortOrder: integer().notNull(),
    name: varchar({ length: 200 }).notNull(),
    unit: varchar({ length: 20 }).notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric({ precision: 18, scale: 2 }).notNull(),
    amount: numeric({ precision: 18, scale: 2 }).generatedAlwaysAs(
      sql`quantity * unit_price`,
    ),
    ...timestamps,
  },
  (t) => [
    index().on(t.requestId),
    check("request_items_quantity_positive", sql`${t.quantity} > 0`),
    check("request_items_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    requestId: text()
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    fileName: varchar({ length: 255 }).notNull(),
    storageKey: varchar({ length: 500 }).notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    sizeBytes: integer().notNull(),
    uploadedById: text()
      .notNull()
      .references(() => user.id),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.requestId),
    check("attachments_size_positive", sql`${t.sizeBytes} > 0`),
  ],
);

export const requestCounters = pgTable("request_counters", {
  year: integer().primaryKey(),
  lastNumber: integer().notNull(),
});
