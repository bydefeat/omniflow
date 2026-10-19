import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { admin } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import * as schema from "@/modules/schema";
import { SIGN_IN_MAX_ATTEMPTS, SIGN_IN_WINDOW_MINUTES } from "@/shared/constants/auth.constant";
import { ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";
import { flushMailOutbox, isMailConfigured, queueMail } from "@/shared/libs/mail.lib";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from "@/shared/libs/password.lib";
import { logger } from "@/shared/libs/logger.lib";

const SIGN_IN_PATH = "/sign-in/email";
const PASSWORD_PATHS = new Set(["/change-password", "/reset-password"]);

const { signInFailures } = schema;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 255) : null;
}

// Counts the attempt before the password is checked, in one statement, so parallel guesses cannot all slip
// through before the first failure is written. Keyed by email + IP so a stranger cannot lock someone out.
async function reserveSignInAttempt(email: string, ipAddress: string) {
  const windowStart = sql`now() - make_interval(mins => ${SIGN_IN_WINDOW_MINUTES})`;
  const [row] = await db
    .insert(signInFailures)
    .values({ email, ipAddress, failures: 1, firstFailedAt: sql`now()` })
    .onConflictDoUpdate({
      target: [signInFailures.email, signInFailures.ipAddress],
      set: {
        failures: sql`case when ${signInFailures.firstFailedAt} < ${windowStart} then 1 else ${signInFailures.failures} + 1 end`,
        firstFailedAt: sql`case when ${signInFailures.firstFailedAt} < ${windowStart} then now() else ${signInFailures.firstFailedAt} end`,
      },
    })
    .returning({
      attempts: signInFailures.failures,
      minutesLeft: sql<number>`greatest(1, ceil(extract(epoch from ${signInFailures.firstFailedAt} + make_interval(mins => ${SIGN_IN_WINDOW_MINUTES}) - now()) / 60))::int`,
    });
  if (row.attempts > SIGN_IN_MAX_ATTEMPTS) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      message: `Đăng nhập sai quá ${SIGN_IN_MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${row.minutesLeft} phút.`,
    });
  }
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
        const source = ctx.request ?? ctx.headers;
        if (email) await reserveSignInAttempt(email, (source && getIP(source, ctx.context.options)) || "");
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
      if (!isAPIError(ctx.context.returned)) await clearSignInFailures(email);
      await db.delete(signInFailures).where(sql`${signInFailures.firstFailedAt} < now() - interval '1 day'`);
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
