import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, request, test } from "@playwright/test";
import { uuidv7 } from "uuidv7";

import {
  apiAs,
  BASE_URL,
  callAction,
  createSubmittedExpense,
  decodeMailBody,
  signIn,
  sql,
  USERS,
  waitForMail,
} from "./helpers";

test.skip(!process.env.DEFEAT_SMTP_CONNECTION_URL, "Cần DEFEAT_SMTP_CONNECTION_URL trỏ tới SMTP sink của e2e");

test("quên mật khẩu gửi email thật, mở liên kết để đặt lại và đăng nhập bằng mật khẩu mới", async ({ page }) => {
  const admin = await apiAs("admin");
  const [department] = await sql`select id from departments where code = 'PB_IT'`;
  const email = `reset.${Date.now()}@omniflow.local`;
  expect(
    (
      await callAction(admin, "createUser", {
        email,
        password: "Matkhau@123",
        name: "Người quên mật khẩu",
        employeeCode: `RS${Date.now() % 1_000_000}`,
        departmentId: department.id,
        managerId: null,
        roles: [],
      })
    )[1],
  ).toBeNull();

  try {
    await page.goto("/authentication/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Gửi liên kết" }).click();
    await expect(page.getByText("Kiểm tra hộp thư")).toBeVisible();

    const mail = await waitForMail((m) => m.to.includes(email));
    const link = decodeMailBody(mail).match(/https?:\/\/\S+reset-password\S+/)?.[0];
    expect(link).toBeTruthy();

    await page.goto(link!);
    await page.getByLabel("Mật khẩu mới").fill("Matkhau@789");
    await page.getByLabel("Nhập lại mật khẩu").fill("Matkhau@789");
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    await expect(page.getByText("Đã đặt lại mật khẩu")).toBeVisible();

    const context = await request.newContext({ baseURL: BASE_URL });
    expect((await signIn(context, email, "Matkhau@789")).ok()).toBeTruthy();
    await context.dispose();
  } finally {
    await sql`delete from "user" where email = ${email}`;
    await admin.dispose();
  }
});

test("người duyệt nhận email khi có đơn chờ duyệt", async () => {
  const employee = await apiAs("employee");
  const title = `Email duyệt ${Date.now()}`;
  const requestId = await createSubmittedExpense(employee, title);
  try {
    const mail = await waitForMail((m) => m.to.includes(USERS.itLead.email) && decodeMailBody(m).includes(requestId));
    expect(decodeMailBody(mail)).toContain(`/workspace/approvals/${requestId}`);
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});

test("lệnh mail:flush gửi email tồn trong hàng đợi, lỗi SMTP thì hẹn gửi lại", async () => {
  const root = path.resolve(__dirname, "../..");
  const flush = (smtp: string) =>
    execFileSync("npx", ["tsx", "scripts/flush-mail.ts"], {
      cwd: root,
      env: { ...process.env, DEFEAT_SMTP_CONNECTION_URL: smtp },
      encoding: "utf8",
    });

  const ok = `outbox.ok.${Date.now()}@omniflow.local`;
  await sql`insert into email_outbox (id, recipient, subject, body) values (${uuidv7()}, ${ok}, 'Kiểm tra outbox', 'Nội dung')`;
  expect(flush(process.env.DEFEAT_SMTP_CONNECTION_URL!)).toContain("Đã gửi");
  await waitForMail((m) => m.to.includes(ok));
  const [sent] = await sql`select sent_at from email_outbox where recipient = ${ok}`;
  expect(sent.sent_at).not.toBeNull();

  const failing = `outbox.fail.${Date.now()}@omniflow.local`;
  await sql`insert into email_outbox (id, recipient, subject, body) values (${uuidv7()}, ${failing}, 'Sẽ lỗi', 'Nội dung')`;
  flush("smtp://127.0.0.1:1");
  const [row] = await sql`
    select attempts, last_error, sent_at, next_attempt_at > now() as later from email_outbox where recipient = ${failing}`;
  expect(row.attempts).toBe(1);
  expect(row.last_error).toBeTruthy();
  expect(row.sent_at).toBeNull();
  expect(row.later).toBe(true);
  await sql`delete from email_outbox where recipient = ${failing}`;
});
