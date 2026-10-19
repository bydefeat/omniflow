import { expect, test } from "@playwright/test";

import { apiAs, callAction, pageAs, sql, USERS } from "./helpers";

test("thao tác quản trị được ghi nhật ký và hiển thị cho admin", async ({ browser }) => {
  const admin = await apiAs("admin");
  const code = `PB_AUDIT_${Date.now().toString(36).toUpperCase()}`;

  expect((await callAction(admin, "createDepartment", { code, name: "Phòng kiểm toán", phone: null }))[1]).toBeNull();
  const [department] = await sql<{ id: string }[]>`select id from departments where code = ${code}`;
  expect(
    (await callAction(admin, "updateDepartment", { id: department.id, code, name: "Phòng kiểm toán nội bộ", phone: null }))[1],
  ).toBeNull();
  expect((await callAction(admin, "deleteDepartment", { id: department.id }))[1]).toBeNull();

  const logs = await sql<{ action: string; actor_name: string; changes: Record<string, unknown> | null }[]>`
    select action, actor_name, changes from audit_logs
    where target_type = 'department' and target_id = ${department.id}
    order by created_at`;
  expect(logs.map((l) => l.action)).toEqual(["DEPARTMENT_CREATED", "DEPARTMENT_UPDATED", "DEPARTMENT_DELETED"]);
  expect(logs[0].actor_name).toContain(USERS.admin.email);
  expect(logs[1].changes).toEqual({ name: { from: "Phòng kiểm toán", to: "Phòng kiểm toán nội bộ" } });

  const page = await pageAs(browser, "admin");
  await page.goto(`/administrator/audit-log?q=${encodeURIComponent(code)}`);
  await expect(page.getByRole("heading", { name: "Nhật ký quản trị" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Xóa phòng ban" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Tạo phòng ban" })).toBeVisible();
  await page.context().close();
});
