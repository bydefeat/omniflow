import nodemailer from "nodemailer";

import { env } from "@/shared/libs/env.lib";

const transport = env.DEFEAT_SMTP_CONNECTION_URL ? nodemailer.createTransport(env.DEFEAT_SMTP_CONNECTION_URL) : null;

export const isMailConfigured = transport !== null;

export async function sendMail(message: { to: string; subject: string; text: string }) {
  if (!transport) throw new Error("SMTP is not configured");
  await transport.sendMail({ from: env.DEFEAT_MAIL_SENDER_ADDRESS ?? "OmniFlow <no-reply@omniflow.local>", ...message });
}
