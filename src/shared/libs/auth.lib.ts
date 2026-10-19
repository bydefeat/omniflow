import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { admin } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import * as schema from "@/modules/schema";
import { ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";
import { flushMailOutbox, isMailConfigured, queueMail } from "@/shared/libs/mail.lib";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from "@/shared/libs/password.lib";
import { logger } from "@/shared/libs/logger.lib";

const LOCKOUT_MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;
const SIGN_IN_PATH = "/sign-in/email";
const PASSWORD_PATHS = new Set(["/change-password", "/reset-password"]);

const { signInFailures } = schema;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 255) : null;
}

async function assertNotLocked(email: string) {
  const [row] = await db
    .select({ minutes: sql<number>`ceil(extract(epoch from ${signInFailures.lockedUntil} - now()) / 60)::int` })
    .from(signInFailures)
    .where(sql`${signInFailures.email} = ${email} and ${signInFailures.lockedUntil} > now()`);
  if (row) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      message: `Đăng nhập sai quá ${LOCKOUT_MAX_FAILURES} lần. Vui lòng thử lại sau ${row.minutes} phút.`,
    });
  }
}

async function recordSignInFailure(email: string) {
  const window = sql`now() - make_interval(mins => ${LOCKOUT_MINUTES})`;
  await db
    .insert(signInFailures)
    .values({ email, failures: 1, firstFailedAt: sql`now()` })
    .onConflictDoUpdate({
      target: signInFailures.email,
      set: {
        failures: sql`case when ${signInFailures.firstFailedAt} < ${window} then 1 else ${signInFailures.failures} + 1 end`,
        firstFailedAt: sql`case when ${signInFailures.firstFailedAt} < ${window} then now() else ${signInFailures.firstFailedAt} end`,
        lockedUntil: sql`case
          when ${signInFailures.firstFailedAt} >= ${window} and ${signInFailures.failures} + 1 >= ${LOCKOUT_MAX_FAILURES}
            then now() + make_interval(mins => ${LOCKOUT_MINUTES})
          else ${signInFailures.lockedUntil} end`,
      },
    });
  await db.delete(signInFailures).where(sql`${signInFailures.firstFailedAt} < now() - interval '1 day'`);
}

export async function clearSignInFailures(email: string) {
  await db.delete(signInFailures).where(eq(signInFailures.email, email.toLowerCase()));
}

export const auth = betterAuth({
  secret: env.DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY,
  baseURL: env.DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: {
    database: { generateId: () => uuidv7() },
    ipAddress: {
      ipAddressHeaders: env.DEFEAT_CLIENT_IP_HEADERS,
      trustedProxies: env.DEFEAT_TRUSTED_PROXIES,
    },
  },
  rateLimit: { storage: "database" },
  session: {
    expiresIn: 60 * 60 * 24 * 3,
    updateAge: 60 * 60 * 12,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === SIGN_IN_PATH) {
        const email = normalizeEmail(ctx.body?.email);
        if (email) await assertNotLocked(email);
      }
      if (PASSWORD_PATHS.has(ctx.path)) {
        const problem = typeof ctx.body?.newPassword === "string" ? passwordProblem(ctx.body.newPassword) : null;
        if (problem) throw new APIError("BAD_REQUEST", { code: "WEAK_PASSWORD", message: problem });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const email = normalizeEmail(ctx.body?.email);
      if (!email) return;
      const returned = ctx.context.returned;
      if (isAPIError(returned)) {
        if (returned.statusCode === 401) await recordSignInFailure(email);
      } else {
        await clearSignInFailures(email);
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (isMailConfigured) {
        after(async () => {
          await queueMail(db, [
            {
              to: user.email,
              subject: "Đặt lại mật khẩu OmniFlow",
              text: `Chào ${user.name},\n\nMở liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
            },
          ]);
          await flushMailOutbox();
        });
      } else if (process.env.NODE_ENV !== "production") {
        logger.info("auth.reset_password_link", { email: user.email, url });
      } else {
        logger.warn("auth.reset_password_unsent", { reason: "SMTP chưa được cấu hình", email: user.email });
      }
    },
  },
  user: {
    additionalFields: {
      employeeCode: { type: "string", required: true, input: false },
      departmentId: { type: "string", required: true, input: false },
      managerId: { type: "string", required: false, input: false },
    },
  },
  plugins: [
    admin({ defaultRole: ROLES.EMPLOYEE, adminRoles: [ROLES.ADMIN] }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
