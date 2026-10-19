import { expect, test } from "@playwright/test";
import { uuidv7 } from "uuidv7";

import { apiAs, callAction, clickUntilVisible, expenseDraft, pageAs, requestTypeId, sql, USERS, waitingApprovalId } from "./helpers";

async function userId(email: string) {
  const [row] = await sql`select id from "user" where email = ${email}`;
  return row.id as string;
}

test("người chỉ được ủy quyền vào được trang ủy quyền, người ủy quyền thấy lượt được duyệt thay", async ({ browser }) => {
  const [cfo, employee] = await Promise.all([userId(USERS.cfo.email), userId(USERS.employee.email)]);
  const [delegation] = await sql`
    insert into delegations (id, delegator_id, delegate_id, starts_at, ends_at, reason)
    values (${uuidv7()}, ${cfo}, ${employee}, now() - interval '1 hour', now() + interval '1 day', 'E2E duyệt thay')
    returning id`;
  const accountant = await apiAs("accountant");
  let requestId: string | undefined;
  try {
    const page = await pageAs(browser, "employee");
    await page.goto("/workspace/approvals/delegations");
    await expect(page.getByText("Tôi được ủy quyền")).toBeVisible();
    await expect(page.getByText("Tạo ủy quyền mới")).toHaveCount(0);
    await page.context().close();

    const [draft] = await callAction<{ id: string }>(accountant, "createDraft", {
      title: `Duyệt thay CFO ${Date.now()}`,
      reason: "Mua máy tính cho kế toán",
      formData: { neededBy: "2026-12-01" },
      items: [{ name: "Laptop", unit: "Cái", quantity: 1, unitPrice: 20_000_000 }],
      requestTypeId: await requestTypeId("ASSET_BUY"),
    });
    requestId = draft!.id;
    expect((await callAction(accountant, "submitRequest", { requestId }))[1]).toBeNull();
    const employeeApi = await apiAs("employee");
    expect((await callAction(employeeApi, "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1]).toBeNull();
    const [round] = await sql`select acted_by_id, on_behalf_of_id from approvals where request_id = ${requestId} and step_order = 1`;
    expect(round).toEqual({ acted_by_id: employee, on_behalf_of_id: cfo });

    const cfoPage = await pageAs(browser, "cfo");
    await cfoPage.goto("/workspace/approvals/history");
    await expect(cfoPage.getByText(`${USERS.employee.name} duyệt thay bạn`).first()).toBeVisible();
    await cfoPage.context().close();
  } finally {
    await sql`delete from delegations where id = ${delegation.id}`;
    if (requestId) await callAction(accountant, "cancelRequest", { requestId });
  }
});

test("nháp cũ vẫn lưu được sau khi admin bỏ lựa chọn khỏi biểu mẫu", async ({ browser }) => {
  const employee = await apiAs("employee");
  const [type] = await sql`select id, form_schema from request_types where code = 'LEAVE'`;
  const [draft, error] = await callAction<{ id: string }>(employee, "createDraft", {
    title: `Nghỉ ốm ${Date.now()}`,
    reason: "Sốt",
    formData: { leaveKind: "Nghỉ ốm" },
    items: [],
    requestTypeId: type.id,
  });
  expect(error).toBeNull();
  const changed = type.form_schema.map((f: { key: string; options?: string[] }) =>
    f.key === "leaveKind" ? { ...f, options: ["Nghỉ phép năm", "Nghỉ việc riêng"] } : f,
  );
  await sql`update request_types set form_schema = ${sql.json(changed)} where id = ${type.id}`;
  try {
    const page = await pageAs(browser, "employee");
    await page.goto(`/workspace/requests/${draft!.id}/edit`);
    await clickUntilVisible(page.getByRole("button", { name: "Lưu nháp" }).filter({ visible: true }), page.getByText("Đã lưu nháp"));
    const [saved] = await sql`select form_data from requests where id = ${draft!.id}`;
    expect(saved.form_data.leaveKind).toBeUndefined();
    await page.context().close();
  } finally {
    await sql`update request_types set form_schema = ${sql.json(type.form_schema)} where id = ${type.id}`;
    await callAction(employee, "deleteDraft", { requestId: draft!.id });
  }
});

test("tệp có nội dung không khớp định dạng bị từ chối khi tải lên", async ({ browser }) => {
  const employee = await apiAs("employee");
  const [draft] = await callAction<{ id: string }>(employee, "createDraft", {
    ...expenseDraft(`Upload giả ${Date.now()}`),
    requestTypeId: await requestTypeId("EXPENSE"),
  });
  try {
    const page = await pageAs(browser, "employee");
    await page.goto(`/workspace/requests/${draft!.id}/edit`);
    await expect(async () => {
      await page.locator('input[type="file"]').setInputFiles({
        name: "hoa_don.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("<html><script>alert(1)</script></html>"),
      });
      await expect(page.getByText(/hoa_don\.pdf: Nội dung hoặc đuôi tệp không khớp/).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    expect(await sql`select id from attachments where request_id = ${draft!.id}`).toHaveLength(0);
    await page.context().close();
  } finally {
    await callAction(employee, "deleteDraft", { requestId: draft!.id });
  }
});

test("action quản trị báo lỗi rõ cho id không tồn tại và quản lý bị khóa", async () => {
  const admin = await apiAs("admin");
  const [, departmentError] = await callAction(admin, "updateDepartment", {
    id: "khong-ton-tai",
    code: "PB_X",
    name: "Không có",
    phone: null,
  });
  expect(departmentError?.code).toBe("NOT_FOUND");

  const [department] = await sql`select id from departments where code = 'PB_IT'`;
  const accountant = await userId(USERS.accountant.email);
  await sql`update "user" set banned = true where id = ${accountant}`;
  try {
    const [, createError] = await callAction(admin, "createUser", {
      email: `banned.manager.${Date.now()}@omniflow.local`,
      password: "Matkhau@123",
      name: "Quản lý bị khóa",
      employeeCode: `BM${Date.now() % 1_000_000}`,
      departmentId: department.id,
      managerId: accountant,
      roles: [],
    });
    expect(createError?.message).toContain("đang bị khóa");

    const [, deptError] = await callAction(admin, "createUser", {
      email: `bad.department.${Date.now()}@omniflow.local`,
      password: "Matkhau@123",
      name: "Sai phòng ban",
      employeeCode: `BD${Date.now() % 1_000_000}`,
      departmentId: "khong-ton-tai",
      managerId: null,
      roles: [],
    });
    expect(deptError?.message).toBe("Phòng ban được chọn không tồn tại");
  } finally {
    await sql`update "user" set banned = false where id = ${accountant}`;
  }
});

test("danh sách lọc và phân trang ở server theo tham số trên URL", async ({ browser }) => {
  const [employee] = await sql`select id from "user" where email = ${USERS.employee.email}`;
  const typeId = await requestTypeId("LEAVE");
  const marker = `Phân trang ${Date.now()}`;
  const ids = Array.from({ length: 23 }, () => uuidv7());
  await sql`
    insert into requests ${sql(
      ids.map((id, i) => ({
        id,
        requester_id: employee.id,
        request_type_id: typeId,
        title: `${marker} #${String(i + 1).padStart(2, "0")}`,
        reason: "E2E",
      })),
    )}`;
  try {
    const page = await pageAs(browser, "employee");
    await page.goto(`/workspace/requests?q=${encodeURIComponent(marker)}`);
    await expect(page.getByText("23 đề xuất")).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: marker })).toHaveCount(20);
    await page.goto(`/workspace/requests?q=${encodeURIComponent(marker)}&page=2`);
    await expect(page.locator("tbody tr").filter({ hasText: marker })).toHaveCount(3);
    await page.goto(`/workspace/requests?q=${encodeURIComponent(marker)}&status=PENDING`);
    await expect(page.getByText("0 đề xuất")).toBeVisible();
    await page.context().close();

    const admin = await pageAs(browser, "admin");
    await admin.goto("/administrator/users?q=ketoan");
    await expect(admin.getByText("1 tài khoản")).toBeVisible();
    await expect(admin.getByText(USERS.accountant.name)).toBeVisible();
    await admin.goto(`/administrator/requests?q=${encodeURIComponent(marker)}`);
    await expect(admin.getByText("0 đơn đã gửi")).toBeVisible();
    await admin.context().close();
  } finally {
    await sql`delete from requests where id in ${sql(ids)}`;
  }
});
