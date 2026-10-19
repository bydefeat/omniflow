import { expect, test } from "@playwright/test";

import {
  apiAs,
  callAction,
  clickUntilVisible,
  createSubmittedExpense,
  openDialog,
  pageAs,
  sql,
  USERS,
  waitingApprovalId,
} from "./helpers";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("người duyệt yêu cầu bổ sung, người làm đơn bổ sung rồi gửi lại, đơn quay về đúng bước", async ({ browser }) => {
  const employee = await apiAs("employee");
  const requestId = await createSubmittedExpense(employee, `Cần bổ sung ${Date.now()}`);
  expect((await callAction(await apiAs("itLead"), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1]).toBeNull();

  try {
    await test.step("kế toán yêu cầu bổ sung", async () => {
      const page = await pageAs(browser, "accountant");
      await page.goto(`/workspace/approvals/${requestId}`);
      await openDialog(page.getByRole("button", { name: "Yêu cầu bổ sung" }), page.getByRole("dialog"));
      await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
      await expect(page.getByText("Vui lòng nêu nội dung cần bổ sung")).toBeVisible();
      await page.getByLabel("Nội dung cần bổ sung").fill("Thiếu hóa đơn VAT cho vé máy bay");
      await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
      await expect(page).toHaveURL(/\/workspace\/approvals$/);
      await page.context().close();

      const [request] = await sql`select status from requests where id = ${requestId}`;
      expect(request.status).toBe("NEEDS_INFO");
      const [employeeRow] = await sql`select id from "user" where email = ${USERS.employee.email}`;
      const notices = await sql`
        select title from notifications where user_id = ${employeeRow.id} and type = 'REQUEST_RETURNED' and href like ${"%" + requestId}`;
      expect(notices[0].title).toContain("Thiếu hóa đơn VAT");
    });

    await test.step("người làm đơn bổ sung tệp, sửa lý do và gửi lại", async () => {
      const page = await pageAs(browser, "employee");
      await page.goto(`/workspace/requests/${requestId}`);
      await expect(page.getByText("Thiếu hóa đơn VAT cho vé máy bay").first()).toBeVisible();
      await expect(async () => {
        await page.getByRole("link", { name: "Bổ sung & gửi lại" }).click();
        await expect(page).toHaveURL(new RegExp(`/workspace/requests/${requestId}/edit$`), { timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
      await expect(page.getByText("Cần bổ sung ở bước").filter({ visible: true })).toBeVisible();

      await page.getByLabel("Lý do / giải trình").fill("Gặp khách hàng tại Đà Nẵng, đã bổ sung hóa đơn VAT");
      await page.locator('input[type="file"]').setInputFiles({ name: "hoa_don_vat.pdf", mimeType: "application/pdf", buffer: pdf });
      await expect(page.getByText("hoa_don_vat.pdf")).toBeVisible();
      await clickUntilVisible(page.getByRole("button", { name: "Gửi lại" }), page.getByRole("dialog"));
      await page.getByRole("dialog").getByRole("button", { name: "Gửi lại" }).click();
      await expect(page).toHaveURL(/\/workspace\/requests$/);
      await page.context().close();

      const [request] = await sql`select status, reason from requests where id = ${requestId}`;
      expect(request).toEqual({ status: "PENDING", reason: "Gặp khách hàng tại Đà Nẵng, đã bổ sung hóa đơn VAT" });
      const rounds = await sql`select step_order, result from approvals where request_id = ${requestId} order by created_at`;
      expect(rounds.map((r) => `${r.step_order}:${r.result}`)).toEqual(["1:APPROVED", "2:RETURNED", "2:WAITING"]);
      expect(await sql`select id from attachments where request_id = ${requestId}`).toHaveLength(1);
    });

    await test.step("kế toán duyệt tiếp, đơn sang bước giám đốc tài chính", async () => {
      expect(
        (await callAction(await apiAs("accountant"), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1],
      ).toBeNull();
      const [next] = await sql`select step_name from approvals where request_id = ${requestId} and result = 'WAITING'`;
      expect(next.step_name).toBe("Giám đốc tài chính duyệt");
    });
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});

test("đơn đang chờ bổ sung thì hủy được, gửi lại hai lần bị chặn", async () => {
  const employee = await apiAs("employee");
  const itLead = await apiAs("itLead");
  const requestId = await createSubmittedExpense(employee, `Hủy khi chờ bổ sung ${Date.now()}`);
  const [, returnError] = await callAction(itLead, "returnRequest", {
    approvalId: await waitingApprovalId(requestId),
    comment: "Ghi rõ mục đích chuyến đi",
  });
  expect(returnError).toBeNull();

  const [, resubmitError] = await callAction(employee, "resubmitRequest", { requestId });
  expect(resubmitError).toBeNull();
  const [, secondError] = await callAction(employee, "resubmitRequest", { requestId });
  expect(secondError?.code).toBe("CONFLICT");

  expect((await callAction(itLead, "returnRequest", { approvalId: await waitingApprovalId(requestId), comment: "Lần 2" }))[1]).toBeNull();
  expect((await callAction(employee, "cancelRequest", { requestId }))[1]).toBeNull();
  const [request] = await sql`select status from requests where id = ${requestId}`;
  expect(request.status).toBe("CANCELLED");
  expect(await sql`select id from approvals where request_id = ${requestId} and result = 'WAITING'`).toHaveLength(0);
});
