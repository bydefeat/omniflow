import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDate, formatDateTime, formatMoney } from "./format.lib";

describe("format.lib", () => {
  it("formats date-times in Vietnam time regardless of the server time zone", () => {
    assert.equal(formatDateTime(new Date("2026-10-19T18:30:00Z")), "20/10/2026 01:30");
    assert.equal(formatDateTime("2026-10-19T01:05:00.000Z"), "19/10/2026 08:05");
  });

  it("keeps date-only form values on the same calendar day", () => {
    assert.equal(formatDate("2026-10-20"), "20/10/2026");
  });

  it("formats timestamps as Vietnam dates", () => {
    assert.equal(formatDate(new Date("2026-10-19T20:00:00Z")), "20/10/2026");
  });

  it("formats VND without decimals and shows a dash for empty values", () => {
    assert.equal(formatMoney("5000000.00").replace(/\s/g, " "), "5.000.000 ₫");
    assert.equal(formatMoney(null), "—");
    assert.equal(formatDateTime(null), "—");
  });
});
