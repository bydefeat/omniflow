import { and, asc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";

import { emailOutbox } from "@/modules/schema";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";

type Executor = Pick<typeof db, "insert">;
export type MailMessage = { to: string; subject: string; text: string };

const MAX_ATTEMPTS = 8;
const LEASE_MINUTES = 5;
const BATCH_SIZE = 20;

const transport = env.DEFEAT_SMTP_CONNECTION_URL ? nodemailer.createTransport(env.DEFEAT_SMTP_CONNECTION_URL) : null;

export const isMailConfigured = transport !== null;

async function sendMail(message: MailMessage) {
  if (!transport) throw new Error("SMTP is not configured");
  await transport.sendMail({ from: env.DEFEAT_MAIL_SENDER_ADDRESS ?? "OmniFlow <no-reply@omniflow.local>", ...message });
}

export async function queueMail(executor: Executor, messages: MailMessage[]) {
  if (!isMailConfigured || messages.length === 0) return;
  await executor.insert(emailOutbox).values(
    messages.map((m) => ({ recipient: m.to, subject: m.subject.slice(0, 300), body: m.text })),
  );
}

export async function flushMailOutbox() {
  if (!isMailConfigured) return { sent: 0, failed: 0 };
  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(
        and(
          isNull(emailOutbox.sentAt),
          lte(emailOutbox.nextAttemptAt, sql`now()`),
          lt(emailOutbox.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(emailOutbox.createdAt))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    return tx
      .update(emailOutbox)
      .set({ nextAttemptAt: sql`now() + make_interval(mins => ${LEASE_MINUTES})` })
      .where(inArray(emailOutbox.id, due.map((d) => d.id)))
      .returning();
  });

  let sent = 0;
  let failed = 0;
  for (const mail of claimed) {
    try {
      await sendMail({ to: mail.recipient, subject: mail.subject, text: mail.body });
      await db.update(emailOutbox).set({ sentAt: new Date(), lastError: null }).where(eq(emailOutbox.id, mail.id));
      sent++;
    } catch (error) {
      const attempts = mail.attempts + 1;
      await db
        .update(emailOutbox)
        .set({
          attempts,
          lastError: String(error instanceof Error ? error.message : error).slice(0, 1000),
          nextAttemptAt: sql`now() + make_interval(mins => ${2 ** attempts})`,
        })
        .where(eq(emailOutbox.id, mail.id));
      failed++;
    }
  }
  await db.delete(emailOutbox).where(lt(emailOutbox.sentAt, sql`now() - interval '30 days'`));
  return { sent, failed };
}
