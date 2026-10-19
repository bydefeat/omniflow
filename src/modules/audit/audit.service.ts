import type { db } from "@/shared/libs/db.lib";
import { clientIp } from "@/shared/libs/request-ip.lib";

import type { AuditAction } from "./audit.constant";
import { auditLogs } from "./audit.schema";

type Executor = Pick<typeof db, "insert">;

export type AuditActor = { id: string; name: string; email: string };

export async function recordAudit(
  executor: Executor,
  actor: AuditActor,
  entry: {
    action: AuditAction;
    targetType: "user" | "department" | "request_type" | "approval";
    targetId?: string | null;
    summary: string;
    changes?: Record<string, unknown>;
  },
) {
  await executor.insert(auditLogs).values({
    actorId: actor.id,
    actorName: `${actor.name} <${actor.email}>`.slice(0, 200),
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    summary: entry.summary.slice(0, 500),
    changes: entry.changes,
    ipAddress: await clientIp(),
  });
}

export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}
