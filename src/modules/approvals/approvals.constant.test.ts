import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readHistoryFilters, readPendingFilters } from "./approvals.constant";

describe("approval list filters", () => {
  it("keeps only valid pending-approval filters", () => {
    assert.deepEqual(readPendingFilters({ q: " REQ ", scope: "delegated", overdue: "1", typeId: "t1", page: "2" }), {
      q: "REQ",
      typeId: "t1",
      scope: "delegated",
      overdue: "1",
      page: 2,
    });
    const junk = readPendingFilters({ scope: "everyone", overdue: "yes" });
    assert.equal(junk.scope, undefined);
    assert.equal(junk.overdue, undefined);
  });

  it("limits history results to decided outcomes", () => {
    assert.equal(readHistoryFilters({ result: "REJECTED" }).result, "REJECTED");
    assert.equal(readHistoryFilters({ result: "WAITING" }).result, undefined);
  });
});
