import { z } from "zod";

const schema = z.object({
  DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL: z.url(),
  DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY: z.string().min(32),
  DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL: z.url(),
  DEFEAT_SMTP_CONNECTION_URL: z.url().optional().or(z.literal("").transform(() => undefined)),
  DEFEAT_MAIL_SENDER_ADDRESS: z.string().optional(),
  DEFEAT_S3_BUCKET_NAME: z.string().optional(),
  DEFEAT_S3_REGION: z.string().optional(),
  DEFEAT_S3_ENDPOINT_URL: z.url().optional().or(z.literal("").transform(() => undefined)),
  DEFEAT_S3_ACCESS_KEY_ID: z.string().optional(),
  DEFEAT_S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export const env = schema
  .refine((e) => !e.DEFEAT_S3_BUCKET_NAME || e.DEFEAT_S3_ENDPOINT_URL || e.DEFEAT_S3_REGION, {
    message: "DEFEAT_S3_REGION là bắt buộc khi dùng AWS S3 (không đặt DEFEAT_S3_ENDPOINT_URL)",
    path: ["DEFEAT_S3_REGION"],
  })
  .parse(process.env);
