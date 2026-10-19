import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { admin } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";

import * as schema from "@/modules/schema";
import { ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";
import { flushMailOutbox, isMailConfigured, queueMail } from "@/shared/libs/mail.lib";

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
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (isMailConfigured) {
        await queueMail(db, [
          {
            to: user.email,
            subject: "Đặt lại mật khẩu OmniFlow",
            text: `Chào ${user.name},\n\nMở liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
          },
        ]);
        after(() => flushMailOutbox().catch((error) => console.error("[mail] flush thất bại", error)));
      } else if (process.env.NODE_ENV !== "production") {
        console.info(`[reset-password] ${user.email}: ${url}`);
      } else {
        console.warn("[reset-password] SMTP chưa được cấu hình, không gửi được liên kết đặt lại mật khẩu");
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
