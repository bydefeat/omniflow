import { headers } from "next/headers";

import { env } from "@/shared/libs/env.lib";

export async function clientIp() {
  const requestHeaders = await headers();
  for (const name of env.DEFEAT_CLIENT_IP_HEADERS ?? ["x-real-ip"]) {
    const value = requestHeaders.get(name)?.split(",")[0]?.trim();
    if (value) return value.slice(0, 64);
  }
  return null;
}
