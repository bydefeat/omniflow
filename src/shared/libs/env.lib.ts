import { z } from "zod";

const schema = z.object({
  DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL: z.url(),
  DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY: z.string().min(32),
  DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL: z.url(),
  DEFEAT_UPLOAD_DIRECTORY: z.string().min(1),
});

// Fail fast at startup instead of at the first request that needs a variable.
export const env = schema.parse(process.env);
