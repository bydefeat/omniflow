import { type NextRequest, NextResponse } from "next/server";

import { authenticationProxy } from "@/proxies/authentication.proxy";

export function proxy(request: NextRequest) {
  return authenticationProxy(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
