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
  await expect(page.getByText("Không tìm thấy trang")).toBeVisible();

  await page.goto("/authentication/sign-in");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByText(/đăng ký|sign up/i)).toHaveCount(0);
});

test("đăng nhập sai 5 lần thì tài khoản bị khóa tạm, admin đặt lại mật khẩu thì mở khóa, đổi vai trò thì phiên cũ bị đăng xuất", async () => {
  const admin = await apiAs("admin");
  const [department] = await sql`select id from departments where code = 'PB_IT'`;
  const email = `lockout.${Date.now()}@omniflow.local`;
  const [, createError] = await callAction(admin, "createUser", {
    email,
    password: "Matkhau@123",
    name: "Thử khóa tạm",
    employeeCode: `LCK${Date.now() % 1_000_000}`,
    departmentId: department.id,
    managerId: null,
    roles: [],
  });
  expect(createError).toBeNull();
  const [created] = await sql`select id from "user" where email = ${email}`;
  const client = await request.newContext({ baseURL: BASE_URL });
  try {
    const [, weakError] = await callAction(admin, "setUserPassword", { userId: created.id, newPassword: "12345678901" });
    expect(weakError?.code).toBe("INPUT_PARSE_ERROR");

    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await signIn(client, email, `Sai${attempt}@matkhau`)).status()).toBe(401);
    }
    const locked = await signIn(client, email, "Matkhau@123");
    expect(locked.status()).toBe(429);
    expect(await locked.json()).toMatchObject({ code: "ACCOUNT_TEMPORARILY_LOCKED" });

    const [lockedRow] = await sql`select failures from sign_in_failures where email = ${email}`;
    expect(lockedRow.failures).toBeGreaterThan(5);
    expect((await callAction(admin, "clearUserSignInLock", { userId: created.id }))[1]).toBeNull();
    expect((await signIn(client, email, "Matkhau@123")).status()).toBe(200);
    for (let attempt = 0; attempt < 5; attempt++) await signIn(client, email, `Lai${attempt}@matkhau`);

    expect((await callAction(admin, "setUserPassword", { userId: created.id, newPassword: "Matkhau@456" }))[1]).toBeNull();
    expect(await sql`select email from sign_in_failures where email = ${email}`).toHaveLength(0);
    expect((await signIn(client, email, "Matkhau@456")).status()).toBe(200);
    expect((await callAction(client, "getMyPendingApprovalCount"))[1]).toBeNull();

    const [, roleError] = await callAction(admin, "updateUser", {
      id: created.id,
      name: "Thử khóa tạm",
      employeeCode: `LCK${Date.now() % 1_000_000}`,
      departmentId: department.id,
      managerId: null,
      roles: ["accountant"],
    });
    expect(roleError).toBeNull();
    expect((await callAction(client, "getMyPendingApprovalCount"))[1]?.code).toBe("NOT_AUTHORIZED");
  } finally {
    await client.dispose();
    await sql`delete from "user" where id = ${created.id}`;
    await sql`delete from sign_in_failures where email = ${email}`;
  }
});

test("form đăng nhập báo khóa tạm bằng tiếng Việt", async ({ page }) => {
  const email = USERS.ceo.email;
  await sql`
    insert into sign_in_failures (email, ip_address, failures, first_failed_at)
    select ${email}, ip, 6, now() from unnest(array['', '127.0.0.1', '::1']) as ip
    on conflict (email, ip_address) do update set failures = 6, first_failed_at = now()`;
  try {
    await page.goto("/authentication/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(USERS.ceo.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText(/Đăng nhập sai quá 5 lần\. Vui lòng thử lại sau \d+ phút\./)).toBeVisible();
  } finally {
    await sql`delete from sign_in_failures where email = ${email}`;
  }
});
