import { expect, request, test } from "@playwright/test";

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
