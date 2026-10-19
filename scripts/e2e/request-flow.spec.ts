import { expect, test } from "@playwright/test";

import { apiAs, callAction, openDialog, pageAs, sql, waitingApprovalId } from "./helpers";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("tạo đơn có hạng mục, lưu nháp, đính kèm, gửi và duyệt đủ 3 cấp", async ({ browser }) => {
  const title = `Công tác Đà Nẵng ${Date.now()}`;
  const page = await pageAs(browser, "employee");
  await page.goto("/workspace/requests/new");

  await page.getByLabel("Loại đơn").click();
  await page.getByTitle("Thanh toán công tác").click();
  await page.getByLabel("Tiêu đề").fill(title);
  await page.getByLabel("Lý do / giải trình").fill("Gặp khách hàng tại Đà Nẵng");

  await test.step("lưu nháp khi dòng hạng mục còn trống", async () => {
    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page.getByText("Đã lưu nháp")).toBeVisible();
    await expect(page).toHaveURL(/\/workspace\/requests\/[^/]+\/edit$/);
  });
  const requestId = page.url().split("/").at(-2)!;

  await test.step("nhập hạng mục có số thập phân và tổng tiền khớp server", async () => {
    await page.getByLabel("Nơi công tác").filter({ visible: true }).fill("Đà Nẵng");
    const start = page.getByPlaceholder("Ngày bắt đầu").filter({ visible: true });
    const end = page.getByPlaceholder("Ngày kết thúc").filter({ visible: true });
    await start.click();
    await start.fill("20/10/2026");
    await start.press("Enter");
    await end.fill("22/10/2026");
    await end.press("Enter");

    await page.getByRole("button", { name: "Thêm hạng mục" }).filter({ visible: true }).click();
    const row = page.locator("tbody tr").filter({ visible: true }).first();
    await row.locator("input").nth(0).fill("Vé máy bay");
    await row.locator("input").nth(1).fill("Vé");
    await row.locator("input").nth(2).fill("2,5");
    await row.locator("input").nth(3).fill("1.500.000");
    await row.locator("input").nth(3).blur();
    await expect(page.locator("tfoot").filter({ visible: true })).toContainText("3.750.000");

    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page.getByText("Đã lưu nháp")).toBeVisible();
    const [saved] = await sql`select total_amount from requests where id = ${requestId}`;
    expect(saved.total_amount).toBe("3750000.00");
  });

  await test.step("đính kèm hóa đơn PDF", async () => {
    await page.locator('input[type="file"]').setInputFiles({ name: "hoa_don_vat.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByText("hoa_don_vat.pdf")).toBeVisible();
  });

  await test.step("gửi duyệt", async () => {
    await openDialog(page.getByRole("button", { name: "Gửi duyệt" }), page.getByRole("dialog"));
    await page.getByRole("dialog").getByRole("button", { name: "Gửi duyệt" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/requests/${requestId}$`));
    await expect(page.getByText(/REQ-\d{4}-\d{4}/).first()).toBeVisible();
    const [row] = await sql`select status, snapshot from requests where id = ${requestId}`;
    expect(row.status).toBe("PENDING");
    expect(row.snapshot.steps).toHaveLength(3);
  });

  for (const approver of ["itLead", "accountant", "cfo"] as const) {
    await test.step(`${approver} phê duyệt`, async () => {
      const approverPage = await pageAs(browser, approver);
      await approverPage.goto(`/workspace/approvals/${requestId}`);
      await expect(approverPage.getByText("hoa_don_vat.pdf")).toBeVisible();
      await openDialog(approverPage.getByRole("button", { name: "Phê duyệt" }), approverPage.getByRole("dialog"));
      await approverPage.getByRole("button", { name: "Xác nhận duyệt" }).click();
      await expect(approverPage.getByRole("button", { name: "Phê duyệt" })).toHaveCount(0);
      await approverPage.context().close();
    });
  }

  await page.goto(`/workspace/requests/${requestId}`);
  await expect(page.getByText("Đã duyệt").first()).toBeVisible();
  const [done] = await sql`select status from requests where id = ${requestId}`;
  expect(done.status).toBe("APPROVED");
});

test("sửa cấu hình loại đơn không làm thay đổi đơn đang chờ duyệt", async ({ browser }) => {
  const employee = await apiAs("employee");
  const admin = await apiAs("admin");
  const [type] = await sql`select id, form_schema, has_line_items, description from request_types where code = 'EXPENSE'`;
  const [draft] = await callAction<{ id: string }>(employee, "createDraft", {
    title: `Snapshot ${Date.now()}`,
    reason: "Kiểm tra bản chụp cấu hình",
    formData: { destination: "Huế", tripDates: ["2026-11-01", "2026-11-02"] },
    items: [{ name: "Khách sạn", unit: "Đêm", quantity: 1, unitPrice: 800_000 }],
    requestTypeId: type.id,
  });
  expect((await callAction(employee, "submitRequest", { requestId: draft!.id }))[1]).toBeNull();

  try {
    const [, formError] = await callAction(admin, "saveFormSchema", {
      requestTypeId: type.id,
      fields: [{ key: "city", label: "Thành phố", type: "text", required: true }],
    });
    expect(formError).toBeNull();
    const [, typeError] = await callAction(admin, "updateRequestType", {
      id: type.id,
      code: "EXPENSE",
      name: "Thanh toán công tác",
      description: null,
      slaHours: 48,
      hasLineItems: false,
    });
    expect(typeError).toBeNull();

    const [, stepsError] = await callAction(admin, "saveApprovalSteps", {
      requestTypeId: type.id,
      steps: [{ name: "Chỉ CEO duyệt", approverType: "ROLE", approverRole: "ceo" }],
    });
    expect(stepsError?.code).toBe("PRECONDITION_FAILED");

    const approverPage = await pageAs(browser, "itLead");
    await approverPage.goto(`/workspace/approvals/${draft!.id}`);
    await expect(approverPage.getByText("Nơi công tác")).toBeVisible();
    await expect(approverPage.getByText("Huế")).toBeVisible();
    await expect(approverPage.getByText("Khách sạn")).toBeVisible();
    await expect(approverPage.getByText("Thành phố")).toHaveCount(0);
    await approverPage.context().close();

    const approvalId = await waitingApprovalId(draft!.id);
    expect((await callAction(await apiAs("itLead"), "approveRequest", { approvalId }))[1]).toBeNull();
    const [next] = await sql`select step_name from approvals where request_id = ${draft!.id} and result = 'WAITING'`;
    expect(next.step_name).toBe("Kế toán kiểm tra chứng từ");
  } finally {
    await sql`update request_types set form_schema = ${sql.json(type.form_schema)}, has_line_items = ${type.has_line_items}, description = ${type.description} where id = ${type.id}`;
    await callAction(employee, "cancelRequest", { requestId: draft!.id });
  }
});
