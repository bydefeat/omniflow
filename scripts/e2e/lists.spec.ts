import { expect, test } from "@playwright/test";

import { apiAs, callAction, createSubmittedExpense, pageAs, sql, USERS, waitingApprovalId } from "./helpers";

test("danh sách chờ duyệt, lịch sử duyệt và thông báo lọc, phân trang ở server", async ({ browser }) => {
  const employee = await apiAs("employee");
  const title = `Lọc danh sách ${Date.now()}`;
  const requestId = await createSubmittedExpense(employee, title);

  try {
    const lead = await pageAs(browser, "itLead");
    await lead.goto(`/workspace/approvals?q=${encodeURIComponent(title)}`);
    await expect(lead.getByRole("link", { name: title }).filter({ visible: true })).toHaveCount(1);
    await lead.goto(`/workspace/approvals?q=${encodeURIComponent(title)}&scope=delegated`);
    await expect(lead.getByText("Không có đơn chờ duyệt khớp bộ lọc")).toBeVisible();
    await lead.goto(`/workspace/approvals?q=${encodeURIComponent(title)}&overdue=1`);
    await expect(lead.getByText("Không có đơn chờ duyệt khớp bộ lọc")).toBeVisible();

    expect(
      (await callAction(await apiAs("itLead"), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1],
    ).toBeNull();
    await lead.goto(`/workspace/approvals/history?q=${encodeURIComponent(title)}&result=APPROVED`);
    await expect(lead.getByText(title)).toBeVisible();
    await lead.goto(`/workspace/approvals/history?q=${encodeURIComponent(title)}&result=REJECTED`);
    await expect(lead.getByText("Không có lượt duyệt khớp bộ lọc")).toBeVisible();
    await lead.context().close();

    const page = await pageAs(browser, "employee");
    await page.goto("/workspace/notifications?unread=1");
    await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
    expect((await callAction(employee, "markAllNotificationsRead"))[1]).toBeNull();
    await page.goto("/workspace/notifications?unread=1");
    await expect(page.getByText("Không còn thông báo chưa đọc")).toBeVisible();
    await page.context().close();

    const admin = await pageAs(browser, "admin");
    await admin.goto("/administrator/reports");
    await expect(admin.getByText(/\d{2}\/\d{4}/).first()).toBeVisible();
    await admin.context().close();
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});

test("lọc 'được ủy quyền duyệt thay' chỉ hiện lượt của người ủy quyền", async ({ browser }) => {
  const [[lead], [accountant]] = await Promise.all([
    sql`select id from "user" where email = ${USERS.itLead.email}`,
    sql`select id from "user" where email = ${USERS.accountant.email}`,
  ]);
  const [delegation] = await sql`
    insert into delegations (id, delegator_id, delegate_id, starts_at, ends_at, reason)
    values (${crypto.randomUUID()}, ${lead.id}, ${accountant.id}, now() - interval '1 hour', now() + interval '1 day', 'E2E lọc ủy quyền')
    returning id`;
  const employee = await apiAs("employee");
  const title = `Lọc ủy quyền ${Date.now()}`;
  const requestId = await createSubmittedExpense(employee, title);
  try {
    const page = await pageAs(browser, "accountant");
    const query = `q=${encodeURIComponent(title)}`;
    await page.goto(`/workspace/approvals?${query}&scope=delegated`);
    await expect(page.getByRole("link", { name: title }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText(`Thay ${USERS.itLead.name}`).filter({ visible: true }).first()).toBeVisible();
    await page.goto(`/workspace/approvals?${query}&scope=mine`);
    await expect(page.getByText("Không có đơn chờ duyệt khớp bộ lọc")).toBeVisible();
    await page.context().close();
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
    await sql`delete from delegations where id = ${delegation.id}`;
  }
});
