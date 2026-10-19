import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { type Role, SIGN_IN_PATH } from "@/shared/constants/role.constant";
import { auth } from "@/shared/libs/auth.lib";
import { hasRole } from "@/shared/libs/role.lib";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}

export async function requireRole(role: Role) {
  const session = await requireSession();
  if (!hasRole(session.user.role, role)) forbidden();
  return session;
}
