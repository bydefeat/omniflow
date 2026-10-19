import { expect, test } from "@playwright/test";

import { pageAs, type UserKey } from "./helpers";

const phone = { width: 390, height: 844 };

const pages: [UserKey, string][] = [
  ["employee", "/workspace/dashboard"],
  ["employee", "/workspace/requests"],
  ["employee", "/workspace/requests/new"],
  ["employee", "/workspace/notifications"],
  ["employee", "/workspace/profile"],
  ["itLead", "/workspace/approvals"],
  ["itLead", "/workspace/approvals/history"],
  ["itLead", "/workspace/delegations"],
];

for (const [user, url] of pages) {
  test(`${url} vừa màn hình điện thoại (${user})`, async ({ browser }, testInfo) => {
    const page = await pageAs(browser, user, { viewport: phone });
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("navigation").filter({ visible: true }).last()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: testInfo.outputPath("phone.png"), fullPage: true });
    expect(overflow, "trang bị tràn ngang").toBeLessThanOrEqual(1);
    await page.context().close();
  });
}

const adminPages = ["/administrator", "/administrator/users", "/administrator/requests", "/administrator/reports"];

for (const url of adminPages) {
  test(`${url} dùng được trên điện thoại (admin)`, async ({ browser }) => {
    const page = await pageAs(browser, "admin", { viewport: phone });
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "trang bị tràn ngang").toBeLessThanOrEqual(1);
    await expect(async () => {
      await page.getByRole("button", { name: "Mở menu quản trị" }).click();
      await expect(page.getByRole("dialog").getByRole("link", { name: "Phòng ban" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("dialog").getByRole("link", { name: "Phòng ban" }).click();
    await expect(page).toHaveURL(/\/administrator\/departments$/);
    await page.context().close();
  });
}
