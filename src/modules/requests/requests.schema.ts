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
import { user } from "@/modules/users/users.schema";
import { id, timestamps } from "@/shared/libs/schema.lib";

export const requestStatus = pgEnum("request_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

// DON_YEU_CAU
export const requests = pgTable(
  "requests",
  {
    id: id(),
    code: varchar({ length: 30 }).unique(), // MaDon, set on submit
    requesterId: text()
      .notNull()
      .references(() => user.id), // Tạo Đơn
    requestTypeId: text()
      .notNull()
      .references(() => requestTypes.id), // Phân Loại
    departmentId: text().references(() => departments.id), // snapshot on submit
    title: varchar({ length: 200 }).notNull(), // TieuDe
    reason: text().notNull(), // LyDo
    formData: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    totalAmount: numeric({ precision: 18, scale: 2 }), // TongTien
    status: requestStatus().notNull().default("DRAFT"), // TrangThai
    submittedAt: timestamp({ withTimezone: true }), // NgayTao
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
  ],
);

// HANG_MUC_CHI_TIET
export const requestItems = pgTable(
  "request_items",
  {
    id: id(), // MaHangMuc
    requestId: text()
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }), // Chứa Hạng Mục
    sortOrder: integer().notNull(),
    name: varchar({ length: 200 }).notNull(), // TenHangMuc
    unit: varchar({ length: 20 }).notNull(), // DonViTinh
    quantity: numeric({ precision: 10, scale: 2 }).notNull(), // SoLuong
    unitPrice: numeric({ precision: 18, scale: 2 }).notNull(), // DonGia
    amount: numeric({ precision: 18, scale: 2 }).generatedAlwaysAs(
      sql`quantity * unit_price`,
    ), // ThanhTien
    ...timestamps,
  },
  (t) => [
    index().on(t.requestId),
    check("request_items_quantity_positive", sql`${t.quantity} > 0`),
    check("request_items_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
  ],
);

// TEP_DINH_KEM
export const attachments = pgTable(
  "attachments",
  {
    id: id(), // MaTep
    requestId: text()
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }), // Có Đính Kèm
    fileName: varchar({ length: 255 }).notNull(), // TenTep
    storageKey: varchar({ length: 500 }).notNull(), // DuongDan (internal key, never a public URL)
    mimeType: varchar({ length: 100 }).notNull(),
    sizeBytes: integer().notNull(),
    uploadedById: text()
      .notNull()
      .references(() => user.id),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(), // NgayTaiLen
  },
  (t) => [
    index().on(t.requestId),
    check("attachments_size_positive", sql`${t.sizeBytes} > 0`),
  ],
);

// Yearly counter for REQ-<year>-<number>; bumped with
// INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING inside the submit transaction.
export const requestCounters = pgTable("request_counters", {
  year: integer().primaryKey(),
  lastNumber: integer().notNull(),
});
