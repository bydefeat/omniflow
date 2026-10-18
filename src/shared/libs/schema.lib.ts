import { text, timestamp } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Column helpers shared by every module's *.schema.ts.
// Kept apart from db.lib.ts, which imports the schemas (would be circular).

export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
