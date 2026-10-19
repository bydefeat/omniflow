import { expect, test } from "@playwright/test";

import {
  apiAs,
  callAction,
  createSubmittedExpense,
  openDialog,
  pageAs,
  refreshAuth,
  sql,
  USERS,
  waitingApprovalId,
} from "./helpers";

test("admin giao lại lượt duyệt bị treo khi người giữ vai trò duy nhất bị khóa", async ({ browser }) => {
  const employee = await apiAs("employee");
  const admin = await apiAs("admin");
  const requestId = await createSubmittedExpense(employee, `Treo kế toán ${Date.now()}`);
  expect((await callAction(await apiAs("itLead"), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1]).toBeNull();

  const [accountant] = await sql`select id from "user" where email = ${USERS.accountant.email}`;
  expect((await callAction(admin, "setUserBanned", { userId: accountant.id, banned: true }))[1]).toBeNull();
  try {
    const [request] = await sql`select code from requests where id = ${requestId}`;
    const adminPage = await pageAs(browser, "admin");
    await adminPage.goto("/administrator");
    await expect(adminPage.getByText("Lượt duyệt không còn ai xử lý được")).toBeVisible();
    await adminPage.getByRole("link", { name: request.code }).click();
    await expect(adminPage).toHaveURL(new RegExp(`/administrator/requests/${requestId}$`));
    await expect(adminPage.getByText("Lượt duyệt này không còn ai xử lý được")).toBeVisible();

    const [, ownError] = await callAction(admin, "reassignApproval", {
      approvalId: await waitingApprovalId(requestId),
      approverId: (await sql`select requester_id from requests where id = ${requestId}`)[0].requester_id,
    });
    expect(ownError?.code).toBe("UNPROCESSABLE_CONTENT");

    await expect(async () => {
      await adminPage.getByRole("combobox").last().click();
      await expect(adminPage.getByTitle(`${USERS.itLead.name} (NV0003)`)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await adminPage.getByTitle(`${USERS.itLead.name} (NV0003)`).click();
    await adminPage.getByRole("button", { name: "Giao lại" }).click();
    await expect(adminPage.getByText("Đã giao lại người duyệt")).toBeVisible();
    await expect(adminPage.getByText(/Giao lại bởi Quản trị viên/)).toBeVisible();
    await adminPage.context().close();

    const [notice] = await sql`
      select n.title from notifications n join "user" u on u.id = n.user_id
      where u.email = ${USERS.itLead.email} and n.href like ${"%" + requestId} and n.title like '%được giao cho bạn%'`;
    expect(notice).toBeTruthy();

    const approverPage = await pageAs(browser, "itLead");
    await approverPage.goto(`/workspace/approvals/${requestId}`);
    await openDialog(approverPage.getByRole("button", { name: "Phê duyệt" }), approverPage.getByRole("dialog"));
    await approverPage.getByRole("button", { name: "Xác nhận duyệt" }).click();
    await expect(approverPage.getByRole("button", { name: "Phê duyệt" })).toHaveCount(0);
    await approverPage.context().close();

    const [next] = await sql`select step_name from approvals where request_id = ${requestId} and result = 'WAITING'`;
    expect(next.step_name).toBe("Giám đốc tài chính duyệt");
  } finally {
    await callAction(admin, "setUserBanned", { userId: accountant.id, banned: false });
    await refreshAuth("accountant");
    await callAction(employee, "cancelRequest", { requestId });
  }
});

test("hủy đơn báo cho người giữ vai trò của bước đang chờ và người được họ ủy quyền", async () => {
  const employee = await apiAs("employee");
  const requestId = await createSubmittedExpense(employee, `Hủy ở bước kế toán ${Date.now()}`);
  expect((await callAction(await apiAs("itLead"), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1]).toBeNull();

  const [accountant] = await sql`select id from "user" where email = ${USERS.accountant.email}`;
  const [ceo] = await sql`select id from "user" where email = ${USERS.ceo.email}`;
  const [delegation] = await sql`
    insert into delegations (id, delegator_id, delegate_id, starts_at, ends_at, reason)
    values (gen_random_uuid()::text, ${accountant.id}, ${ceo.id}, now() - interval '1 hour', now() + interval '1 day', 'E2E')
    returning id`;
  try {
    expect((await callAction(employee, "cancelRequest", { requestId }))[1]).toBeNull();
    const rows = await sql`
      select user_id from notifications where type = 'REQUEST_CANCELLED' and href like ${"%" + requestId}`;
    const notified = rows.map((r) => r.user_id);
    expect(notified).toContain(accountant.id);
    expect(notified).toContain(ceo.id);
  } finally {
    await sql`delete from delegations where id = ${delegation.id}`;
  }
});
