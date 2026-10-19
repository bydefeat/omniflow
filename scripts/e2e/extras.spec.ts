import { expect, request, test } from "@playwright/test";

import { apiAs, BASE_URL, callAction, clickUntilVisible, createSubmittedExpense, pageAs, signIn, sql, USERS } from "./helpers";

test("người dùng tự sửa họ tên ở hồ sơ; endpoint update-user của better-auth bị tắt", async ({ browser }) => {
  const admin = await apiAs("admin");
  const [department] = await sql`select id from departments where code = 'PB_IT'`;
  const email = `profile.${Date.now()}@omniflow.local`;
  expect(
    (await callAction(admin, "createUser", {
      email,
      password: "Matkhau@123",
      name: "Tên cũ",
      employeeCode: `PRF${Date.now() % 1_000_000}`,
      departmentId: department.id,
      managerId: null,
      roles: [],
    }))[1],
  ).toBeNull();
  const client = await request.newContext({ baseURL: BASE_URL });
  try {
    expect((await signIn(client, email, "Matkhau@123")).status()).toBe(200);
    const blocked = await client.post("/api/auth/update-user", {
      data: { name: "Hack", image: "https://evil.example/x.png" },
      headers: { origin: BASE_URL },
    });
    expect(blocked.ok()).toBe(false);

    expect((await callAction(client, "updateOwnName", { name: "   " }))[1]?.code).toBe("INPUT_PARSE_ERROR");
    expect((await callAction(client, "updateOwnName", { name: "  Tên mới  " }))[1]).toBeNull();
    const [row] = await sql`select name, image from "user" where email = ${email}`;
    expect(row).toEqual({ name: "Tên mới", image: null });
  } finally {
    await client.dispose();
    await sql`delete from "user" where email = ${email}`;
  }

  const page = await pageAs(browser, "employee");
  try {
    await page.goto("/workspace/profile");
    const box = page.locator("textarea").filter({ visible: true });
    await clickUntilVisible(page.locator(".ant-typography-edit").filter({ visible: true }).first(), box);
    await box.fill("Võ Hoàng Nam (sửa)");
    await box.press("Enter");
    await expect(page.getByText("Đã cập nhật họ tên")).toBeVisible();
    const [saved] = await sql`select name from "user" where email = ${USERS.employee.email}`;
    expect(saved.name).toBe("Võ Hoàng Nam (sửa)");
  } finally {
    await sql`update "user" set name = ${USERS.employee.name} where email = ${USERS.employee.email}`;
    await page.context().close();
  }
});

test("admin xuất CSV danh sách đơn theo bộ lọc; nhân viên bị chặn; trang chi tiết có nút in", async ({ browser }) => {
  const employee = await apiAs("employee");
  const title = `Xuất CSV "báo giá", ${Date.now()}`;
  const requestId = await createSubmittedExpense(employee, title);
  try {
    const admin = await apiAs("admin");
    const response = await admin.get(`/api/exports/requests?q=${encodeURIComponent(title)}&status=PENDING`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="don-yeu-cau-\d{8}\.csv"/);
    const body = await response.text();
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Mã đơn,Tiêu đề,Loại đơn,Mã NV,Người đề xuất,Phòng ban,Trạng thái,Tổng tiền,Ngày gửi,Hoàn tất");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"${title.replaceAll('"', '""')}"`);
    expect(lines[1]).toContain("Chờ duyệt");

    expect((await employee.get("/api/exports/requests")).status()).toBe(403);

    const page = await pageAs(browser, "admin");
    await page.goto(`/administrator/requests?q=${encodeURIComponent(title)}`);
    await expect(page.locator('a[href^="/api/exports/requests"]').filter({ visible: true })).toHaveAttribute("href", /\/api\/exports\/requests\?q=/);
    await page.goto(`/administrator/requests/${requestId}`);
    const print = page.getByRole("button", { name: "In đơn" }).filter({ visible: true });
    await expect(print).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".ant-layout-sider").filter({ visible: true })).toHaveCount(0);
    await expect(print).toHaveCount(0);
    await page.context().close();
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});

test("admin tạo và hủy ủy quyền thay người duyệt, có ghi nhật ký", async ({ browser }) => {
  const [[lead], [accountant]] = await Promise.all([
    sql`select id from "user" where email = ${USERS.itLead.email}`,
    sql`select id from "user" where email = ${USERS.accountant.email}`,
  ]);
  const admin = await apiAs("admin");
  const reason = `Nghỉ ốm đột xuất ${Date.now()}`;
  const input = {
    delegatorId: lead.id,
    delegateId: accountant.id,
    startsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 366 * 86_400_000).toISOString(),
    reason,
  };
  expect((await callAction(await apiAs("employee"), "adminCreateDelegation", input))[1]?.code).toBe("FORBIDDEN");
  expect((await callAction(admin, "adminCreateDelegation", input))[1]).toBeNull();
  const [delegation] = await sql`select id, status from delegations where reason = ${reason}`;
  try {
    expect(delegation.status).toBe("ACTIVE");
    expect((await callAction(admin, "adminCreateDelegation", { ...input, reason: `${reason} lần 2` }))[1]?.code).toBe(
      "CONFLICT",
    );

    const page = await pageAs(browser, "admin");
    await page.goto(`/administrator/delegations?q=${encodeURIComponent(reason)}`);
    await expect(page.getByRole("cell", { name: reason })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sắp hiệu lực" })).toBeVisible();
    await page.context().close();

    expect((await callAction(admin, "adminCancelDelegation", { id: delegation.id }))[1]).toBeNull();
    const [cancelled] = await sql`select status from delegations where id = ${delegation.id}`;
    expect(cancelled.status).toBe("CANCELLED");
    const logs = await sql`select action from audit_logs where target_id = ${delegation.id} order by created_at`;
    expect(logs.map((l) => l.action)).toEqual(["DELEGATION_CREATED", "DELEGATION_CANCELLED"]);
  } finally {
    await sql`delete from delegations where id = ${delegation.id}`;
  }
});
