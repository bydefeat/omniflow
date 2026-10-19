import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { SIGN_IN_PATH } from "@/shared/constants/role.constant";

export function authenticationProxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/authentication")) return;
  if (getSessionCookie(request)) return;

  const url = new URL(SIGN_IN_PATH, request.url);
  if (pathname !== "/") url.searchParams.set("callbackURL", pathname + search);
  return NextResponse.redirect(url);
}
