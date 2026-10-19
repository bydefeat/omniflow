import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/shared/libs/db.lib";
import { escapeLike, PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { auditLogs } from "./audit.schema";

export type AuditFilters = { q?: string; action?: string; page: number };

export async function searchAuditLogs(filters: AuditFilters) {
  const q = filters.q && `%${escapeLike(filters.q)}%`;
  const where = and(
    q ? or(ilike(auditLogs.actorName, q), ilike(auditLogs.summary, q)) : undefined,
    filters.action ? eq(auditLogs.action, filters.action) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total };
}

export type AuditLogRow = Awaited<ReturnType<typeof searchAuditLogs>>["rows"][number];
