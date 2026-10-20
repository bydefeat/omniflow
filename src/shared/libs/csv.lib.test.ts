import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCsv } from "./csv.lib";

describe("toCsv", () => {
  it("starts with a BOM and uses CRLF", () => {
    assert.equal(toCsv(["a", "b"], [[1, null]]), "﻿a,b\r\n1,\r\n");
  });

  it("quotes separators, quotes and line breaks", () => {
    assert.equal(toCsv(["x"], [['Báo giá "A", lần 2\nghi chú']]).split("\r\n")[1], '"Báo giá ""A"", lần 2\nghi chú"');
  });

  it("neutralises spreadsheet formulas in text but keeps numbers", () => {
    const [, row] = toCsv(["a", "b", "c"], [["=HYPERLINK(\"x\")", "-5", -5]]).split("\r\n");
    assert.equal(row, `"'=HYPERLINK(""x"")",'-5,-5`);
  });
});
