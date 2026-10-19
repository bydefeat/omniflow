import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { apiAs, callAction, createSubmittedExpense, sql, USERS, waitingApprovalId } from "./helpers";

const root = path.resolve(__dirname, "../..");
const remind = () => execFileSync("npm", ["run", "--silent", "sla:remind"], { cwd: root, env: process.env, encoding: "utf8" });

test("lượt duyệt quá hạn SLA được nhắc đúng một lần, giao lại thì nhắc người mới", async () => {
  const employee = await apiAs("employee");
  const requestId = await createSubmittedExpense(employee, `Quá hạn ${Date.now()}`);
  const approvalId = (await waitingApprovalId(requestId))!;
  const [[lead], [ceo]] = await Promise.all([
    sql`select id from "user" where email = ${USERS.itLead.email}`,
    sql`select id from "user" where email = ${USERS.ceo.email}`,
  ]);
  const overdueNotices = (userId: string) =>
    sql`select id from notifications where user_id = ${userId} and type = 'APPROVAL_OVERDUE' and href like ${`%${requestId}`}`;

  try {
    expect(await overdueNotices(lead.id)).toHaveLength(0);
    remind();
    expect(await overdueNotices(lead.id)).toHaveLength(0);

    await sql`update approvals set due_at = now() - interval '1 hour' where id = ${approvalId}`;
    expect(remind()).toMatch(/Đã nhắc [1-9]\d* lượt/);
    expect(await overdueNotices(lead.id)).toHaveLength(1);
    remind();
    expect(await overdueNotices(lead.id)).toHaveLength(1);

    const [, reassignError] = await callAction(await apiAs("admin"), "reassignApproval", { approvalId, approverId: ceo.id });
    expect(reassignError).toBeNull();
    remind();
    expect(await overdueNotices(ceo.id)).toHaveLength(1);
  } finally {
    await callAction(employee, "cancelRequest", { requestId });
  }
});
