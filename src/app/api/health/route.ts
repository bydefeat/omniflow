import { connection } from "next/server";

import { pingDatabase } from "@/shared/libs/db.lib";
import { logger } from "@/shared/libs/logger.lib";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  try {
    await Promise.race([
      pingDatabase(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database ping timed out")), 3_000)),
    ]);
    return Response.json({ status: "ok" }, { headers: NO_STORE });
  } catch (error) {
    logger.error("health.database_unreachable", { error });
    return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers: NO_STORE });
  }
}
