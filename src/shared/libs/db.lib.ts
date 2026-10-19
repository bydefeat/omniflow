import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/modules/schema";
import { env } from "@/shared/libs/env.lib";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };
const sql =
  globalForDb.sql ??
  postgres(env.DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL, {
    max: env.DEFEAT_POSTGRES_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });

export async function pingDatabase() {
  await sql`select 1`;
}
