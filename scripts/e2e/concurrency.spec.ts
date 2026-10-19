import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { uuidv7 } from "uuidv7";

import {
  apiAs,
  callAction,
  createSubmittedExpense,
  expenseDraft,
  requestTypeId,
  sql,
  USERS,
  waitForBlockedQuery,
  waitingApprovalId,
} from "./helpers";

const uploads = path.resolve(__dirname, "../../uploads");

async function createDraft(title: string) {
  const employee = await apiAs("employee");
  const [draft, error] = await callAction<{ id: string }>(employee, "createDraft", {
    ...expenseDraft(title),
    requestTypeId: await requestTypeId("EXPENSE"),
  });
  expect(error).toBeNull();
  return { employee, id: draft!.id };
}

async function addStoredAttachment(requestId: string) {
  const storageKey = uuidv7();
  mkdirSync(uploads, { recursive: true });
  writeFileSync(path.join(uploads, storageKey), "%PDF-1.4\n%%EOF\n");
  const [requester] = await sql`select requester_id from requests where id = ${requestId}`;
  const [row] = await sql`
    insert into attachments (id, request_id, file_name, storage_key, mime_type, size_bytes, uploaded_by_id)
    values (${uuidv7()}, ${requestId}, 'bao_gia.pdf', ${storageKey}, 'application/pdf', 15, ${requester.requester_id})
    returning id`;
  return { attachmentId: row.id as string, file: path.join(uploads, storageKey) };
}

async function whileSubmitting<T>(requestId: string, action: () => Promise<T>, lock: "request" | "type" = "request") {
  const tx = await sql.reserve();
  try {
      await tx`begin`;
      const [{ pid }] = await tx`select pg_backend_pid() as pid`;
      if (lock === "request") await tx`select id from requests where id = ${requestId} for update`;
      else await tx`select t.id from request_types t join requests r on r.request_type_id = t.id where r.id = ${requestId} for share of t`;
      const pending = action();
      await waitForBlockedQuery(pid, lock === "request" ? "requests" : "request_types");
      await tx`
        update requests
        set status = 'PENDING', code = ${`E2E-${Date.now()}`}, submitted_at = now(), snapshot = '{}'::jsonb
        where id = ${requestId}`;
      await tx`commit`;
      return await pending;
  } finally {
    tx.release();
  }
}

async function retire(requestId: string) {
  await sql`update requests set status = 'CANCELLED', completed_at = now() where id = ${requestId} and status = 'PENDING'`;
}

test("lưu nháp trùng lúc gửi đơn không ghi đè hạng mục của đơn đã gửi", async () => {
  const { employee, id } = await createDraft(`Race update ${Date.now()}`);
  try {
    const [, error] = await whileSubmitting(id, () =>
      callAction(employee, "updateDraft", {
        ...expenseDraft("Đổi sau khi gửi"),
        id,
        items: [{ name: "Thêm sau khi gửi", unit: "Cái", quantity: 9, unitPrice: 9_000_000 }],
      }),
    );
    expect(error?.code).toBe("NOT_FOUND");
    const items = await sql`select name from request_items where request_id = ${id}`;
    expect(items.map((i) => i.name)).toEqual(["Vé máy bay"]);
    const [request] = await sql`select title, total_amount from requests where id = ${id}`;
    expect(request.total_amount).toBe("3000000.00");
    expect(request.title).not.toBe("Đổi sau khi gửi");
  } finally {
    await retire(id);
  }
});

test("xóa nháp trùng lúc gửi đơn không xóa đơn và tệp đính kèm", async () => {
  const { employee, id } = await createDraft(`Race delete ${Date.now()}`);
  const { file } = await addStoredAttachment(id);
  try {
    const [, error] = await whileSubmitting(id, () => callAction(employee, "deleteDraft", { requestId: id }));
    expect(error?.code).toBe("NOT_FOUND");
    expect((await sql`select id from requests where id = ${id}`).length).toBe(1);
    expect(existsSync(file)).toBe(true);
  } finally {
    await retire(id);
  }
});

test("xóa tệp trùng lúc gửi đơn không làm mất tệp của đơn đã gửi", async () => {
  const { employee, id } = await createDraft(`Race attachment ${Date.now()}`);
  const { attachmentId, file } = await addStoredAttachment(id);
  try {
    const [, error] = await whileSubmitting(id, () => callAction(employee, "deleteAttachment", { attachmentId }));
    expect(error?.code).toBe("NOT_FOUND");
    expect((await sql`select id from attachments where id = ${attachmentId}`).length).toBe(1);
    expect(existsSync(file)).toBe(true);
  } finally {
    await retire(id);
  }
});

test("sửa bước duyệt trùng lúc gửi đơn bị chặn thay vì đổi quy trình của đơn", async () => {
  const admin = await apiAs("admin");
  const code = `E2E_${Date.now()}`;
  const [created, createError] = await callAction<{ id: string }>(admin, "createRequestType", {
    code,
    name: `Loại đơn ${code}`,
    description: null,
    slaHours: 24,
    hasLineItems: false,
  });
  expect(createError).toBeNull();
  const typeId = created!.id;
  try {
    expect(
      (await callAction(admin, "saveApprovalSteps", { requestTypeId: typeId, steps: [{ name: "Quản lý", approverType: "MANAGER", approverRole: null }] }))[1],
    ).toBeNull();
    const [employee] = await sql`select id from "user" where email = ${USERS.employee.email}`;
    const [draft] = await sql`
      insert into requests (id, requester_id, request_type_id, title, reason)
      values (${uuidv7()}, ${employee.id}, ${typeId}, 'Race steps', 'E2E') returning id`;

    const [, error] = await whileSubmitting(
      draft.id,
      () => callAction(admin, "saveApprovalSteps", { requestTypeId: typeId, steps: [{ name: "CEO", approverType: "ROLE", approverRole: "ceo" }] }),
      "type",
    );
    expect(error?.code).toBe("PRECONDITION_FAILED");
    const steps = await sql`select name from approval_steps where request_type_id = ${typeId}`;
    expect(steps.map((s) => s.name)).toEqual(["Quản lý"]);
  } finally {
    await sql`update requests set status = 'CANCELLED', completed_at = now() where request_type_id = ${typeId} and status = 'PENDING'`;
    await callAction(admin, "setRequestTypeActive", { id: typeId, isActive: false });
  }
});

test("duyệt và hủy cùng lúc luôn kết thúc gọn, không lỗi server", async () => {
  const employee = await apiAs("employee");
  const itLead = await apiAs("itLead");
  for (let i = 0; i < 6; i++) {
    const requestId = await createSubmittedExpense(employee, `Race approve-cancel ${Date.now()}-${i}`);
    const approvalId = await waitingApprovalId(requestId);
    try {
      const results = await Promise.all([
        callAction(itLead, "approveRequest", { approvalId }),
        callAction(employee, "cancelRequest", { requestId }),
      ]);
      for (const [, error] of results) {
        if (error) expect(error.code).toBe("CONFLICT");
      }
      const [request] = await sql`select status from requests where id = ${requestId}`;
      const waiting = await sql`select id from approvals where request_id = ${requestId} and result = 'WAITING'`;
      if (request.status === "CANCELLED") expect(waiting).toHaveLength(0);
      else expect(request.status).toBe("PENDING");
    } finally {
      await retire(requestId);
    }
  }
});
