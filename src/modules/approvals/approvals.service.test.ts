import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Assignment,
  computeDueAt,
  decideAct,
  hasApproverRole,
  nextStep,
  resolveAssignee,
} from "./approvals.service";

const managerStep = { stepOrder: 1, name: "QL duyệt", approverType: "MANAGER" as const, approverRole: null };
const cfoStep = { stepOrder: 2, name: "CFO duyệt", approverType: "ROLE" as const, approverRole: "cfo" };

const waitingFor = (patch: Partial<Assignment>): Assignment => ({
  result: "WAITING",
  approverId: null,
  approverRole: null,
  requesterId: "requester",
  ...patch,
});

describe("resolveAssignee", () => {
  it("assigns a MANAGER step to the requester's manager", () => {
    assert.deepEqual(resolveAssignee(managerStep, { managerId: "boss" }), {
      approverId: "boss",
      approverRole: null,
    });
  });

  it("returns null when the requester has no manager", () => {
    assert.equal(resolveAssignee(managerStep, { managerId: null }), null);
  });

  it("assigns a ROLE step to the role pool", () => {
    assert.deepEqual(resolveAssignee(cfoStep, { managerId: "boss" }), {
      approverId: null,
      approverRole: "cfo",
    });
  });
});

describe("nextStep", () => {
  const steps = [cfoStep, managerStep, { ...cfoStep, stepOrder: 3, name: "CEO" }];

  it("returns the following step by order", () => {
    assert.equal(nextStep(steps, 1)?.stepOrder, 2);
    assert.equal(nextStep(steps, 2)?.name, "CEO");
  });

  it("returns undefined after the last step", () => {
    assert.equal(nextStep(steps, 3), undefined);
  });
});

describe("decideAct", () => {
  const boss = { id: "boss", roles: ["employee", "approver"] };
  const cfo = { id: "cfo-user", roles: ["employee", "cfo"] };
  const deputy = { id: "deputy", roles: ["employee"] };

  it("lets the assigned manager act", () => {
    assert.deepEqual(decideAct(waitingFor({ approverId: "boss" }), boss, []), {
      allowed: true,
      onBehalfOfId: null,
    });
  });

  it("lets any holder of the step role act", () => {
    assert.deepEqual(decideAct(waitingFor({ approverRole: "cfo" }), cfo, []), {
      allowed: true,
      onBehalfOfId: null,
    });
  });

  it("rejects someone who is not assigned", () => {
    assert.deepEqual(decideAct(waitingFor({ approverId: "boss" }), deputy, []), {
      allowed: false,
      reason: "NOT_ASSIGNED",
    });
  });

  it("lets a delegate act on behalf of the assigned manager", () => {
    assert.deepEqual(decideAct(waitingFor({ approverId: "boss" }), deputy, [boss]), {
      allowed: true,
      onBehalfOfId: "boss",
    });
  });

  it("lets a delegate act for a role pool through the delegator's role", () => {
    assert.deepEqual(decideAct(waitingFor({ approverRole: "cfo" }), deputy, [cfo]), {
      allowed: true,
      onBehalfOfId: "cfo-user",
    });
  });

  it("does not use an expired delegation (delegator no longer passed in)", () => {
    assert.equal(decideAct(waitingFor({ approverId: "boss" }), deputy, []).allowed, false);
  });

  it("blocks approving your own request, even when you hold the role", () => {
    const self = { id: "requester", roles: ["cfo"] };
    assert.deepEqual(decideAct(waitingFor({ approverRole: "cfo" }), self, []), {
      allowed: false,
      reason: "OWN_REQUEST",
    });
  });

  it("blocks acting through a delegation granted by the requester", () => {
    const requesterAsCfo = { id: "requester", roles: ["cfo"] };
    assert.equal(decideAct(waitingFor({ approverRole: "cfo" }), deputy, [requesterAsCfo]).allowed, false);
  });

  it("rejects rounds that are no longer waiting", () => {
    assert.deepEqual(decideAct(waitingFor({ approverId: "boss", result: "APPROVED" }), boss, []), {
      allowed: false,
      reason: "NOT_WAITING",
    });
  });
});

describe("helpers", () => {
  it("computes the SLA deadline", () => {
    const from = new Date("2026-10-19T08:00:00Z");
    assert.equal(computeDueAt(from, 24).toISOString(), "2026-10-20T08:00:00.000Z");
  });

  it("recognises approver and functional roles", () => {
    assert.equal(hasApproverRole(["employee"]), false);
    assert.equal(hasApproverRole(["employee", "approver"]), true);
    assert.equal(hasApproverRole(["employee", "accountant"]), true);
  });
});
