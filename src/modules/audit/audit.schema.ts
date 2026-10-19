import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { id } from "@/shared/libs/schema.lib";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text().notNull(),
    actorName: varchar({ length: 200 }).notNull(),
    action: varchar({ length: 50 }).notNull(),
    targetType: varchar({ length: 30 }).notNull(),
    targetId: text(),
    summary: varchar({ length: 500 }).notNull(),
    changes: jsonb().$type<Record<string, unknown>>(),
    ipAddress: varchar({ length: 64 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt), index().on(t.actorId), index().on(t.targetType, t.targetId)],
);
