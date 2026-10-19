import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  type APIRequestContext,
  type Browser,
  expect,
  type Locator,
  type Page,
  request as playwrightRequest,
} from "@playwright/test";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import postgres from "postgres";

import { MAILBOX } from "./mail-sink";

const root = path.resolve(__dirname, "../..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {}

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const demoPassword = process.env.DEFEAT_SEED_DEMO_PASSWORD || "Omniflow@123";

export const USERS = {
  admin: { email: process.env.DEFEAT_SEED_ADMIN_EMAIL!, password: process.env.DEFEAT_SEED_ADMIN_PASSWORD!, name: "Quản trị viên" },
  employee: { email: "nhanvien.it@omniflow.local", password: demoPassword, name: "Võ Hoàng Nam" },
  itLead: { email: "truongphong.it@omniflow.local", password: demoPassword, name: "Phạm Đức Anh" },
  accountant: { email: "ketoan@omniflow.local", password: demoPassword, name: "Ngô Thị Lan" },
  cfo: { email: "cfo@omniflow.local", password: demoPassword, name: "Lê Thu Hà" },
  ceo: { email: "ceo@omniflow.local", password: demoPassword, name: "Trần Minh Quân" },
} as const;

export type UserKey = keyof typeof USERS;

export const authFile = (user: UserKey) => path.join(__dirname, ".auth", `${user}.json`);

export const sql = postgres(process.env.DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL!, { max: 4, onnotice: () => {} });

export async function signIn(context: APIRequestContext, email: string, password: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await context.post("/api/auth/sign-in/email", {
      data: { email, password },
      headers: { origin: BASE_URL },
    });
    if (response.status() !== 429) return response;
    await new Promise((resolve) => setTimeout(resolve, 11_000));
  }
  throw new Error(`Sign-in for ${email} kept hitting the rate limit`);
}

export async function signInWithForm(page: Page, email: string, password: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    const failed = page.getByText("Không thể đăng nhập");
    const outcome = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.startsWith("/authentication"), { timeout: 15_000 })
        .then(() => "ok", () => "timeout"),
      failed.waitFor({ timeout: 15_000 }).then(() => "limited", () => "timeout"),
    ]);
    if (outcome === "ok") return;
    await page.waitForTimeout(11_000);
  }
  throw new Error(`Sign-in form for ${email} kept failing`);
}

export async function apiAs(user: UserKey) {
  return playwrightRequest.newContext({ baseURL: BASE_URL, storageState: authFile(user) });
}

export async function pageAs(browser: Browser, user: UserKey, options: { viewport?: { width: number; height: number } } = {}) {
  const context = await browser.newContext({
    storageState: authFile(user),
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    ...options,
  });
  return context.newPage();
}

type ManifestEntry = { exportedName: string; workers: Record<string, unknown> };
let manifest: Record<string, ManifestEntry> | null = null;

function findAction(name: string) {
  manifest ??= JSON.parse(readFileSync(path.join(root, ".next/server/server-reference-manifest.json"), "utf8")).node;
  const entry = Object.entries(manifest!).find(([, value]) => value.exportedName === name);
  if (!entry) throw new Error(`Server action ${name} not found in the build manifest`);
  const workers = Object.keys(entry[1].workers);
  const worker = workers.find((w) => !w.includes("[")) ?? workers[0];
  const pagePath =
    worker
      .replace(/^app/, "")
      .replace(/\/page$/, "")
      .replace(/\/\([^)]+\)/g, "")
      .replace(/\[[^\]]+\]/g, "x") || "/";
  return { id: entry[0], pagePath };
}

export type ActionError = { code: string; message: string };

export async function callAction<T = unknown>(context: APIRequestContext, name: string, input?: unknown) {
  const { id, pagePath } = findAction(name);
  const response = await context.post(pagePath, {
    headers: { "Next-Action": id, "content-type": "text/plain;charset=UTF-8", origin: BASE_URL },
    data: JSON.stringify(input === undefined ? [] : [input]),
    timeout: 60_000,
  });
  const body = await response.text();
  const line = body.split("\n").find((l) => l.startsWith("1:"));
  if (!line || line.startsWith("1:E")) {
    throw new Error(`Action ${name} failed with ${response.status()}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(line.slice(2)) as [T, null] | [null, ActionError];
}

export async function waitForBlockedQuery(blockerPid: number, table: string) {
  await expect
    .poll(
      async () =>
        (
          await sql`
            select count(*)::int as n from pg_stat_activity
            where datname = current_database()
              and wait_event_type = 'Lock'
              and ${blockerPid} = any(pg_blocking_pids(pid))
              and query ilike ${`%"${table}"%`}`
        )[0].n,
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0);
}

export async function requestTypeId(code: string) {
  const [row] = await sql`select id from request_types where code = ${code}`;
  return row.id as string;
}

export const expenseDraft = (title: string) => ({
  title,
  reason: "Công tác Đà Nẵng gặp khách hàng",
  formData: { destination: "Đà Nẵng", tripDates: ["2026-10-20", "2026-10-22"] },
  items: [{ name: "Vé máy bay", unit: "Vé", quantity: 2, unitPrice: 1_500_000 }],
});

export async function createSubmittedExpense(employee: APIRequestContext, title: string) {
  const [draft, error] = await callAction<{ id: string }>(employee, "createDraft", {
    ...expenseDraft(title),
    requestTypeId: await requestTypeId("EXPENSE"),
  });
  expect(error).toBeNull();
  const [, submitError] = await callAction(employee, "submitRequest", { requestId: draft!.id });
  expect(submitError).toBeNull();
  return draft!.id;
}

export async function waitingApprovalId(requestId: string) {
  const [row] = await sql`select id from approvals where request_id = ${requestId} and result = 'WAITING'`;
  return row?.id as string | undefined;
}

export async function clickUntilVisible(trigger: Locator, expected: Locator) {
  await expect(async () => {
    await trigger.click();
    await expect(expected.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

export const openDialog = clickUntilVisible;

export async function refreshAuth(user: UserKey) {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });
  await signIn(context, USERS[user].email, USERS[user].password);
  await context.storageState({ path: authFile(user) });
  await context.dispose();
}

export function s3Credentials() {
  const accessKeyId = process.env.DEFEAT_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DEFEAT_S3_SECRET_ACCESS_KEY;
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
}

const bucket = process.env.DEFEAT_S3_BUCKET_NAME;
const s3 = bucket
  ? new S3Client({
      region: process.env.DEFEAT_S3_REGION || "auto",
      endpoint: process.env.DEFEAT_S3_ENDPOINT_URL || undefined,
      forcePathStyle: Boolean(process.env.DEFEAT_S3_ENDPOINT_URL),
      credentials: s3Credentials(),
    })
  : null;
const uploads = path.join(root, "uploads");

export async function putStoredObject(key: string, data: string) {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
    return;
  }
  mkdirSync(uploads, { recursive: true });
  writeFileSync(path.join(uploads, key), data);
}

export async function storedObjectExists(key: string) {
  if (s3) {
    return s3
      .send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      .then(() => true)
      .catch(() => false);
  }
  return existsSync(path.join(uploads, key));
}

export type SentMail = { from: string; to: string[]; data: string };

export async function waitForMail(match: (mail: SentMail) => boolean) {
  let found: SentMail | undefined;
  await expect
    .poll(
      () => {
        const lines = existsSync(MAILBOX) ? readFileSync(MAILBOX, "utf8").split("\n").filter(Boolean) : [];
        found = lines.map((l) => JSON.parse(l) as SentMail).find(match);
        return Boolean(found);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

export function decodeMailBody(mail: SentMail) {
  const split = mail.data.indexOf("\n\n");
  const headers = mail.data.slice(0, split).toLowerCase();
  const body = mail.data.slice(split + 2);
  if (headers.includes("content-transfer-encoding: base64")) {
    return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  if (headers.includes("content-transfer-encoding: quoted-printable")) {
    const bytes = body.replace(/=\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(bytes, "latin1").toString("utf8");
  }
  return body;
}
