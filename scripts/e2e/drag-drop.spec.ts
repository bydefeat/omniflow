import { expect, type Page, test } from "@playwright/test";

import { apiAs, callAction, pageAs, sql } from "./helpers";

async function dragHandle(page: Page, from: number, to: number) {
  const handles = page.getByRole("button", { name: "Kéo để sắp xếp" });
  const source = await handles.nth(from).boundingBox();
  const target = await handles.nth(to).boundingBox();
  if (!source || !target) throw new Error("Không tìm thấy tay nắm kéo thả");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 + 10, { steps: 5 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2 + 5, { steps: 20 });
  await page.mouse.up();
}

test("kéo thả đổi thứ tự trường biểu mẫu và bước duyệt rồi lưu đúng thứ tự", async ({ browser }) => {
  const admin = await apiAs("admin");
  const code = `DND_${Date.now()}`;
  const [created, error] = await callAction<{ id: string }>(admin, "createRequestType", {
    code,
    name: `Kéo thả ${code}`,
    description: null,
    slaHours: 24,
    hasLineItems: false,
  });
  expect(error).toBeNull();
  const typeId = created!.id;
  try {
    expect(
      (
        await callAction(admin, "saveFormSchema", {
          requestTypeId: typeId,
          fields: [
            { key: "first", label: "Trường A", type: "text", required: false },
            { key: "second", label: "Trường B", type: "text", required: false },
            { key: "third", label: "Trường C", type: "text", required: false },
          ],
        })
      )[1],
    ).toBeNull();
    expect(
      (
        await callAction(admin, "saveApprovalSteps", {
          requestTypeId: typeId,
          steps: [
            { name: "Bước Một", approverType: "MANAGER", approverRole: null },
            { name: "Bước Hai", approverType: "ROLE", approverRole: "cfo" },
          ],
        })
      )[1],
    ).toBeNull();

    const page = await pageAs(browser, "admin");

    await page.goto(`/administrator/request-types/${typeId}/form`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Kéo để sắp xếp" })).toHaveCount(3);
    await dragHandle(page, 0, 2);
    await page.getByRole("button", { name: "Lưu biểu mẫu" }).click();
    await expect(page.getByText("Đã lưu biểu mẫu")).toBeVisible();
    const [type] = await sql`select form_schema from request_types where id = ${typeId}`;
    expect(type.form_schema.map((f: { key: string }) => f.key)).toEqual(["second", "third", "first"]);

    await page.goto(`/administrator/request-types/${typeId}/steps`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Kéo để sắp xếp" })).toHaveCount(2);
    await dragHandle(page, 1, 0);
    await page.getByRole("button", { name: "Lưu quy trình" }).click();
    await expect(page.getByText("Đã lưu quy trình duyệt")).toBeVisible();
    const steps = await sql`select name from approval_steps where request_type_id = ${typeId} order by step_order`;
    expect(steps.map((s) => s.name)).toEqual(["Bước Hai", "Bước Một"]);
    await page.context().close();
  } finally {
    await callAction(admin, "setRequestTypeActive", { id: typeId, isActive: false });
    await admin.dispose();
  }
});
