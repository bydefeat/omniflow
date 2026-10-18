import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "@/modules/users/users.schema";
import { id, timestamps } from "@/shared/libs/schema.lib";

export const delegationStatus = pgEnum("delegation_status", [
  "ACTIVE",
  "CANCELLED",
]);

export const delegations = pgTable(
  "delegations",
  {
    id: id(),
    delegatorId: text()
      .notNull()
      .references(() => user.id),
    delegateId: text()
      .notNull()
      .references(() => user.id),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: varchar({ length: 255 }).notNull(),
    status: delegationStatus().notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [
    index().on(t.delegateId, t.status),
    check("delegations_not_self", sql`${t.delegatorId} <> ${t.delegateId}`),
    check("delegations_valid_range", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
