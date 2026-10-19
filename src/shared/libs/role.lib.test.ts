import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeCallbackPath } from "./role.lib";

describe("safeCallbackPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    assert.equal(safeCallbackPath("/workspace/requests?status=PENDING#top"), "/workspace/requests?status=PENDING#top");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    for (const value of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", undefined, ["/a"]]) {
      assert.equal(safeCallbackPath(value), null, String(value));
    }
  });

  it("rejects control characters that browsers strip into //host", () => {
    for (const value of ["/\t/evil.com", "/\n/evil.com", "/\r//evil.com", "/\u0000/evil.com"]) {
      assert.equal(safeCallbackPath(value), null, JSON.stringify(value));
    }
  });

  it("normalises dot segments without leaving the origin", () => {
    assert.equal(safeCallbackPath("/a/../..//evil.com"), null);
    assert.equal(safeCallbackPath("/workspace/./dashboard"), "/workspace/dashboard");
  });
});
