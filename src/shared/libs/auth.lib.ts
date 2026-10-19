import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";

import * as schema from "@/modules/schema";
import { ROLES } from "@/shared/constants/role.constant";
import { db } from "@/shared/libs/db.lib";
import { env } from "@/shared/libs/env.lib";

export const auth = betterAuth({
  secret: env.DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY,
  baseURL: env.DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: { database: { generateId: () => uuidv7() } },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      console.info(`[reset-password] ${user.email}: ${url}`);
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
