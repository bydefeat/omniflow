import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { getActiveDelegates } from "@/modules/delegations/delegations.query";
import { notifications } from "@/modules/notifications/notifications.schema";
import { requests } from "@/modules/requests/requests.schema";
import { user } from "@/modules/users/users.schema";
import { FUNCTIONAL_ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";
import { isMailConfigured, queueMail } from "@/shared/libs/mail.lib";

import { approvals } from "./approvals.schema";

// Server-only helpers shared by approvals.action.ts and the overdue reminder job. Kept out of the
// "use server" file because every export there becomes a callable server action.

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationType = (typeof notifications.$inferInsert)["type"];

export const roleLabel = (role: string) => FUNCTIONAL_ROLES.find((r) => r.value === role)?.label ?? role;

export async function findRoleHolders(tx: Tx, role: string, excludeId: string) {
  const rows = await tx
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        sql`(',' || coalesce(${user.role}, '') || ',') like ${`%,${role},%`}`,
        sql`${user.banned} is not true`,
        ne(user.id, excludeId),
      ),
    );
  return rows.map((r) => r.id);
}

export type Outbox = { userIds: string[]; title: string; href: string }[];

export async function notify(
  tx: Tx,
  outbox: Outbox,
  userIds: string[],
  payload: { type: NotificationType; title: string; href: string },
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.insert(notifications).values(unique.map((userId) => ({ userId, ...payload })));
  outbox.push({ userIds: unique, title: payload.title, href: payload.href });
}

export async function queueNotificationMails(tx: Tx, outbox: Outbox) {
  if (!isMailConfigured || outbox.length === 0) return;
  const recipients = await tx
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(and(inArray(user.id, [...new Set(outbox.flatMap((m) => m.userIds))]), sql`${user.banned} is not true`));
  await queueMail(
    tx,
    outbox.flatMap((message) =>
      recipients
        .filter((r) => message.userIds.includes(r.id))
        .map((recipient) => ({
          to: recipient.email,
          subject: message.title,
          text: `Chào ${recipient.name},\n\n${message.title}\n\nXem chi tiết: ${new URL(message.href, env.DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL)}`,
        })),
    ),
  );
}

export async function withDelegates(userIds: string[], requesterId: string) {
  const delegates = await getActiveDelegates(userIds);
  return [...userIds, ...delegates.map((d) => d.delegateId)].filter((id) => id !== requesterId);
}

const REMINDER_BATCH = 50;

/**
 * Sends one "overdue" notification (and email when SMTP is set) per waiting round whose SLA has passed.
 * Rows are claimed with SKIP LOCKED so overlapping runs never remind twice.
 */
export async function sendOverdueReminders() {
  let reminded = 0;
  for (;;) {
    const batch = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: approvals.id,
          approverId: approvals.approverId,
          approverRole: approvals.approverRole,
          stepName: approvals.stepName,
          requestId: requests.id,
          requesterId: requests.requesterId,
          code: requests.code,
          title: requests.title,
        })
        .from(approvals)
        .innerJoin(requests, eq(requests.id, approvals.requestId))
        .where(
          and(
            eq(approvals.result, "WAITING"),
            eq(requests.status, "PENDING"),
            isNull(approvals.remindedAt),
            sql`${approvals.dueAt} < now()`,
          ),
        )
        .orderBy(asc(approvals.dueAt))
        .limit(REMINDER_BATCH)
        .for("update", { of: approvals, skipLocked: true });
      if (rows.length === 0) return 0;

      const outbox: Outbox = [];
      for (const row of rows) {
        const assignees = row.approverId
          ? [row.approverId]
          : await findRoleHolders(tx, row.approverRole!, row.requesterId);
        await notify(tx, outbox, await withDelegates(assignees, row.requesterId), {
          type: "APPROVAL_OVERDUE",
          title: `${row.code} đã quá hạn xử lý ở bước ${row.stepName}: ${row.title}`.slice(0, 200),
          href: `/workspace/approvals/${row.requestId}`,
        });
      }
      await tx
        .update(approvals)
        .set({ remindedAt: new Date() })
        .where(inArray(approvals.id, rows.map((r) => r.id)));
      await queueNotificationMails(tx, outbox);
      return rows.length;
    });
    reminded += batch;
    if (batch < REMINDER_BATCH) return reminded;
  }
}
