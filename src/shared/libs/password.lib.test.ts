import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { passwordProblem, passwordSchema } from "./password.lib";

describe("passwordProblem", () => {
  it("accepts long enough passwords with letters and digits, including Vietnamese letters", () => {
    assert.equal(passwordProblem("Matkhau@123"), null);
    assert.equal(passwordProblem("mậtkhẩu2026"), null);
  });

  it("rejects short, overlong, digit-only and letter-only passwords", () => {
    assert.match(passwordProblem("Abc12345")!, /tối thiểu 10/);
    assert.match(passwordProblem(`a1${"x".repeat(127)}`)!, /tối đa 128/);
    assert.match(passwordProblem("1234567890")!, /cả chữ và số/);
    assert.match(passwordProblem("abcdefghij")!, /cả chữ và số/);
  });

  it("surfaces the problem as the zod issue message", () => {
    const result = passwordSchema.safeParse("ngan1");
    assert.equal(result.success, false);
    assert.match(result.error!.issues[0].message, /tối thiểu 10/);
  });
});
