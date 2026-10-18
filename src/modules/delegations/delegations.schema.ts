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

// EXPIRED is derived on read (ACTIVE and endsAt < now()), never stored.
export const delegationStatus = pgEnum("delegation_status", [
  "ACTIVE",
  "CANCELLED",
]);

// UY_QUYEN. No overlapping ACTIVE delegations per delegator: exclusion constraint
// in a custom migration (drizzle cannot declare EXCLUDE).
export const delegations = pgTable(
  "delegations",
  {
    id: id(), // MaUyQuyen
    delegatorId: text()
      .notNull()
      .references(() => user.id), // người ủy quyền
    delegateId: text()
      .notNull()
      .references(() => user.id), // người được ủy quyền (G5)
    startsAt: timestamp({ withTimezone: true }).notNull(), // NgayBatDau
    endsAt: timestamp({ withTimezone: true }).notNull(), // NgayKetThuc
    reason: varchar({ length: 255 }).notNull(), // LyDo
    status: delegationStatus().notNull().default("ACTIVE"), // TrangThai
    ...timestamps,
  },
  (t) => [
    index().on(t.delegateId, t.status),
    check("delegations_not_self", sql`${t.delegatorId} <> ${t.delegateId}`),
    check("delegations_valid_range", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
