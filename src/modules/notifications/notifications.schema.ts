import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "@/modules/users/users.schema";
import { id, timestamps } from "@/shared/libs/schema.lib";

export const notificationType = pgEnum("notification_type", [
  "APPROVAL_NEEDED",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  "REQUEST_CANCELLED",
  "REQUEST_RETURNED",
  "APPROVAL_OVERDUE",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    title: varchar({ length: 200 }).notNull(),
    href: varchar({ length: 300 }),
    readAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.userId, t.readAt), index().on(t.userId, t.createdAt)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    recipient: varchar({ length: 320 }).notNull(),
    subject: varchar({ length: 300 }).notNull(),
    body: text().notNull(),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
    lastError: text(),
    ...timestamps,
  },
  (t) => [index().on(t.sentAt, t.nextAttemptAt)],
);
