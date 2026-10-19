import { expect, request, test } from "@playwright/test";

import { apiAs, BASE_URL, callAction, signIn, signInWithForm, sql, USERS } from "./helpers";

test("chưa đăng nhập thì về trang đăng nhập kèm callbackURL", async ({ page }) => {
  await page.goto("/workspace/requests?status=PENDING");
  await expect(page).toHaveURL(/\/authentication\/sign-in\?callbackURL=%2Fworkspace%2Frequests%3Fstatus%3DPENDING/);
});

test("callbackURL chứa ký tự điều khiển không đưa người dùng ra trang ngoài", async ({ page }) => {
  await page.goto("/authentication/sign-in?callbackURL=%2F%09%2Fevil.example");
  await signInWithForm(page, USERS.employee.email, USERS.employee.password);
  await expect(page).toHaveURL(`${BASE_URL}/workspace/dashboard`);
});

test("callbackURL hợp lệ vẫn được giữ sau khi đăng nhập", async ({ page }) => {
  await page.goto("/workspace/notifications");
  await signInWithForm(page, USERS.employee.email, USERS.employee.password);
  await expect(page).toHaveURL(`${BASE_URL}/workspace/notifications`);
});

test("chưa cấu hình SMTP thì trang quên mật khẩu hướng dẫn liên hệ quản trị viên", async ({ page }) => {
  test.skip(!!process.env.DEFEAT_SMTP_CONNECTION_URL, "SMTP đang được cấu hình");
  await page.goto("/authentication/forgot-password");
  await expect(page.getByText("Liên hệ quản trị viên", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi liên kết" })).toHaveCount(0);
});

test("admin đặt mật khẩu mới thì các phiên cũ của người dùng bị đăng xuất", async () => {
  const admin = await apiAs("admin");
  const [department] = await sql`select id from departments where code = 'PB_IT'`;
  const email = `e2e.${Date.now()}@omniflow.local`;
  const [, createError] = await callAction(admin, "createUser", {
    email,
    password: "Matkhau@123",
    name: "Người dùng E2E",
    employeeCode: `E2E${Date.now() % 1_000_000}`,
    departmentId: department.id,
    managerId: null,
    roles: [],
  });
  expect(createError).toBeNull();
  const [created] = await sql`select id from "user" where email = ${email}`;
  try {

    const victim = await request.newContext({ baseURL: BASE_URL });
    expect((await signIn(victim, email, "Matkhau@123")).ok()).toBeTruthy();
    expect((await callAction(victim, "getMyPendingApprovalCount"))[1]).toBeNull();

    const [, resetError] = await callAction(admin, "setUserPassword", { userId: created.id, newPassword: "Matkhau@456" });
    expect(resetError).toBeNull();

    const [, afterError] = await callAction(victim, "getMyPendingApprovalCount");
    expect(afterError?.code).toBe("NOT_AUTHORIZED");
    await victim.dispose();
  } finally {
    await sql`delete from "user" where id = ${created.id}`;
    await admin.dispose();
  }
});

test("không có luồng đăng ký: API sign-up bị chặn, không có trang hay liên kết đăng ký", async ({ page, request }) => {
  const email = `signup.${Date.now()}@omniflow.local`;
  const response = await request.post("/api/auth/sign-up/email", {
    data: { email, password: "Matkhau@123", name: "Tự đăng ký" },
    headers: { origin: BASE_URL },
  });
  expect(response.ok()).toBe(false);
  expect(await sql`select id from "user" where email = ${email}`).toHaveLength(0);

  await page.goto("/authentication/sign-up");
  await expect(page.getByText(/404|could not be found/i).first()).toBeVisible();

  await page.goto("/authentication/sign-in");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByText(/đăng ký|sign up/i)).toHaveCount(0);
});
