import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, request, test as setup } from "@playwright/test";

import { authFile, BASE_URL, signIn, USERS, type UserKey } from "./helpers";

setup("sign in every demo account once", async () => {
  setup.setTimeout(180_000);
  mkdirSync(path.dirname(authFile("admin")), { recursive: true });
  for (const key of Object.keys(USERS) as UserKey[]) {
    const context = await request.newContext({ baseURL: BASE_URL });
    const response = await signIn(context, USERS[key].email, USERS[key].password);
    expect(response.ok(), `sign-in ${key}`).toBeTruthy();
    await context.storageState({ path: authFile(key) });
    await context.dispose();
  }
});
