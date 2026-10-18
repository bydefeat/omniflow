import { pgTable, varchar } from "drizzle-orm/pg-core";

import { id, timestamps } from "@/shared/libs/schema.lib";

export const departments = pgTable("departments", {
  id: id(),
  code: varchar({ length: 20 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  phone: varchar({ length: 15 }),
  ...timestamps,
});
