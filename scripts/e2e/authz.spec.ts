import { expect, test } from "@playwright/test";

import { apiAs, callAction, pageAs, USERS } from "./helpers";

const adminPages = [
  { path: "/administrator", link: null },
  { path: "/administrator/users", link: "Người dùng" },
  { path: "/administrator/departments", link: "Phòng ban" },
  { path: "/administrator/requests", link: "Đơn yêu cầu" },
  { path: "/administrator/reports", link: "Báo cáo" },
  { path: "/administrator/request-types", link: "Loại đơn" },
  { path: "/administrator/audit-log", link: "Nhật ký quản trị" },
];

test("nhân viên mở trực tiếp trang quản trị thì bị chặn", async ({ browser }) => {
  const page = await pageAs(browser, "employee");
  for (const { path } of adminPages) {
    await page.goto(path);
    await expect(page.getByText("Không có quyền truy cập"), path).toBeVisible();
    await expect(page.getByText(USERS.accountant.email)).toHaveCount(0);
  }
  await page.context().close();
});

test("phát lại request điều hướng của admin bằng phiên nhân viên không lộ dữ liệu quản trị", async ({ browser }) => {
  const admin = await pageAs(browser, "admin");
  await admin.goto("/administrator");
  await admin.waitForLoadState("networkidle");
  const captured: { url: string; headers: Record<string, string> }[] = [];
  for (const { path, link } of adminPages.filter((p) => p.link)) {
    const request = admin.waitForRequest((r) => r.url().includes(path) && !!r.headers()["rsc"]);
    await admin.getByRole("link", { name: link! }).first().click();
    const r = await request;
    captured.push({ url: r.url(), headers: r.headers() });
    await admin.waitForURL((url) => url.pathname === path);
    await admin.goto("/administrator");
    await admin.waitForLoadState("networkidle");
  }
  await admin.context().close();

  const employee = await apiAs("employee");
  for (const { url, headers } of captured) {
    const response = await employee.get(url, {
      headers: {
        rsc: headers["rsc"],
        "next-router-state-tree": headers["next-router-state-tree"],
        "next-url": headers["next-url"] ?? "/administrator",
      },
      maxRedirects: 0,
    });
    const body = await response.text();
    expect(body, url).not.toContain(USERS.accountant.email);
    expect(body, url).not.toContain("REQ-");
    expect(body, url).not.toContain("Ban Giám đốc");
  }
});

test("nhân viên gọi action quản trị đều bị từ chối", async () => {
  const employee = await apiAs("employee");
  const calls: [string, unknown][] = [
    ["createDepartment", { code: "PB_HACK", name: "Hack", phone: null }],
    ["updateDepartment", { id: "x", code: "PB_HACK", name: "Hack", phone: null }],
    ["deleteDepartment", { id: "x" }],
    ["createUser", { email: "hack@omniflow.local", password: "Matkhau@123", name: "Hack", employeeCode: "HACK", departmentId: "x", managerId: null, roles: ["admin"] }],
    ["updateUser", { id: "x", name: "Hack", employeeCode: "HACK", departmentId: "x", managerId: null, roles: ["admin"] }],
    ["setUserBanned", { userId: "x", banned: true }],
    ["setUserPassword", { userId: "x", newPassword: "Matkhau@123" }],
    ["createRequestType", { code: "HACK", name: "Hack", description: null, slaHours: 1, hasLineItems: false }],
    ["setRequestTypeActive", { id: "x", isActive: false }],
    ["saveFormSchema", { requestTypeId: "x", fields: [] }],
    ["saveApprovalSteps", { requestTypeId: "x", steps: [{ name: "Hack", approverType: "MANAGER", approverRole: null }] }],
    ["reassignApproval", { approvalId: "x", approverId: "x" }],
  ];
  for (const [name, input] of calls) {
    const [, error] = await callAction(employee, name, input);
    expect(error?.code, name).toBe("FORBIDDEN");
  }
});

test("trang có header bảo mật chống nhúng khung và lộ thông tin", async ({ request }) => {
  const response = await request.get("/authentication/sign-in");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("trang không tồn tại hiện thông báo tiếng Việt và vẫn giữ khung portal", async ({ browser }) => {
  const page = await pageAs(browser, "employee");
  await page.goto("/workspace/requests/khong-ton-tai");
  await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
  await expect(page.getByRole("link", { name: "Về trang chính" })).toBeVisible();
  await page.goto("/khong-co-trang-nay");
  await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
  await page.context().close();
});

test("health check báo database sẵn sàng, không cần đăng nhập và không bị cache", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toContain("no-store");
});
