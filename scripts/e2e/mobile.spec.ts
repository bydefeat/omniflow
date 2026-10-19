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
  ["itLead", "/workspace/approvals/delegations"],
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
