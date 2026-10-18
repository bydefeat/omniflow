import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/modules/schema";
import { env } from "@/shared/libs/env.lib";

// One connection pool per process; dev hot reload would otherwise open a new one per edit.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };
const sql =
  globalForDb.sql ?? postgres(env.DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL);
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });
