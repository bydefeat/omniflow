import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { departments } from "@/modules/departments/departments.schema";

// Tables owned by better-auth (core + admin plugin). Keep field names in sync with
// node_modules/@better-auth/core/dist/db/get-tables.mjs; only the fields marked
// "OmniFlow" are ours (declared as user.additionalFields in auth.lib.ts).

// NGUOI_DUNG + VAI_TRO (role) + TrangThai (banned)
export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(), // HoTen
    email: text().notNull().unique(), // Email
    emailVerified: boolean().notNull().default(false),
    image: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // admin plugin: comma-separated roles, ban = TrangThai LOCKED
    role: text(),
    banned: boolean().default(false),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true }),
    // OmniFlow
    employeeCode: varchar({ length: 20 }).notNull().unique(), // MaNguoiDung
    departmentId: text()
      .notNull()
      .references(() => departments.id), // Thuộc Về (1,1)
    managerId: text().references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index().on(t.departmentId), index().on(t.managerId)],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text(), // admin plugin
  },
  (t) => [index().on(t.userId)],
);

// MatKhau lives here (password), not on user.
export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.identifier)],
);
