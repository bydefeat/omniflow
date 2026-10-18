import { pgTable, varchar } from "drizzle-orm/pg-core";

import { id, timestamps } from "@/shared/libs/schema.lib";

// PHONG_BAN
export const departments = pgTable("departments", {
  id: id(),
  code: varchar({ length: 20 }).notNull().unique(), // MaPB
  name: varchar({ length: 100 }).notNull(), // TenPB
  phone: varchar({ length: 15 }), // SoDienThoai
  ...timestamps,
});
