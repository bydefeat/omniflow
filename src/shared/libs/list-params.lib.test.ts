import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escapeLike, readPage, readParam } from "./list-params.lib";

describe("list params helpers", () => {
  it("takes the first value, trims it and caps it at 100 characters", () => {
    assert.equal(readParam({ q: ["  abc ", "x"] }, "q"), "abc");
    assert.equal(readParam({ q: "   " }, "q"), undefined);
    assert.equal(readParam({ q: "a".repeat(150) }, "q")?.length, 100);
  });

  it("falls back to page 1 for invalid pages", () => {
    assert.equal(readPage({ page: "3" }), 3);
    for (const page of ["0", "-2", "1.5", "abc", undefined]) assert.equal(readPage({ page }), 1);
  });

  it("escapes LIKE wildcards and backslashes", () => {
    assert.equal(escapeLike("50%_a\\b"), "50\\%\\_a\\\\b");
  });
});
