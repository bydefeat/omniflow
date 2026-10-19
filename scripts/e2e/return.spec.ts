import { expect, test } from "@playwright/test";

import {
  apiAs,
  callAction,
  clickUntilVisible,
  createSubmittedExpense,
  openDialog,
  pageAs,
  putStoredObject,
  sql,
  storedObjectExists,
  USERS,
  waitingApprovalId,
} from "./helpers";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test("người duyệt yêu cầu bổ sung, người làm đơn bổ sung rồi gửi lại, đơn được duyệt lại từ bước đầu", async ({ browser }) => {
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
      expect(rounds.map((r) => `${r.step_order}:${r.result}`)).toEqual(["1:APPROVED", "2:RETURNED", "1:WAITING"]);
      expect(await sql`select id from attachments where request_id = ${requestId}`).toHaveLength(1);
    });

    await test.step("quản lý và kế toán duyệt lại nội dung đã bổ sung, đơn sang bước giám đốc tài chính", async () => {
      for (const approver of ["itLead", "accountant"] as const) {
        expect(
          (await callAction(await apiAs(approver), "approveRequest", { approvalId: await waitingApprovalId(requestId) }))[1],
        ).toBeNull();
      }
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
  const [lead] = await sql`select id from "user" where email = ${USERS.itLead.email}`;
  const cancelled = await sql`
    select id from notifications where user_id = ${lead.id} and type = 'REQUEST_CANCELLED' and href like ${"%" + requestId}`;
  expect(cancelled).toHaveLength(1);
  const [request] = await sql`select status from requests where id = ${requestId}`;
  expect(request.status).toBe("CANCELLED");
  expect(await sql`select id from approvals where request_id = ${requestId} and result = 'WAITING'`).toHaveLength(0);
});

test("tệp đã gửi chỉ bị gỡ mềm khi bổ sung, phiên bản trước vẫn xem được", async ({ browser }) => {
  const employee = await apiAs("employee");
  const requestId = await createSubmittedExpense(employee, `Giữ bằng chứng ${Date.now()}`);
  const [owner] = await sql`select requester_id from requests where id = ${requestId}`;
  async function attach(fileName: string) {
    const key = crypto.randomUUID();
    await putStoredObject(key, pdf.toString());
    const [row] = await sql`
      insert into attachments (id, request_id, file_name, storage_key, mime_type, size_bytes, uploaded_by_id)
      values (${crypto.randomUUID()}, ${requestId}, ${fileName}, ${key}, 'application/pdf', ${pdf.length}, ${owner.requester_id})
      returning id, storage_key`;
    return row as { id: string; storage_key: string };
  }

  try {
    const submitted = await attach("bao_gia_cu.pdf");
    expect(
      (await callAction(await apiAs("itLead"), "returnRequest", {
        approvalId: await waitingApprovalId(requestId),
        comment: "Báo giá đã hết hạn",
      }))[1],
    ).toBeNull();
    const [revision] = await sql`select revision, reason, attachments from request_revisions where request_id = ${requestId}`;
    expect(revision.revision).toBe(1);
    expect(revision.attachments.map((a: { fileName: string }) => a.fileName)).toEqual(["bao_gia_cu.pdf"]);

    const fresh = await attach("bao_gia_moi_nham.pdf");
    expect((await callAction(employee, "deleteAttachment", { attachmentId: submitted.id }))[1]).toBeNull();
    expect((await callAction(employee, "deleteAttachment", { attachmentId: fresh.id }))[1]).toBeNull();
    const [kept] = await sql`select removed_at from attachments where id = ${submitted.id}`;
    expect(kept.removed_at).not.toBeNull();
    expect(await storedObjectExists(submitted.storage_key)).toBe(true);
    expect(await sql`select id from attachments where id = ${fresh.id}`).toHaveLength(0);
    expect(await storedObjectExists(fresh.storage_key)).toBe(false);
    expect((await callAction(employee, "deleteAttachment", { attachmentId: submitted.id }))[1]?.code).toBe("NOT_FOUND");

    const page = await pageAs(browser, "employee");
    await page.goto(`/workspace/requests/${requestId}/edit`);
    await expect(page.getByText("Cần bổ sung ở bước").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("bao_gia_cu.pdf")).toHaveCount(0);
    await page.goto(`/workspace/requests/${requestId}`);
    await expect(page.getByText("Đã gỡ khi bổ sung")).toBeVisible();
    await page.getByText("Lần gửi 1").click();
    await expect(page.getByRole("link", { name: "bao_gia_cu.pdf" })).toHaveCount(2);
    const download = await page.request.get(`/api/files/${submitted.id}`);
    expect(download.status()).toBe(200);
    await page.context().close();
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});
