import { APPROVER_ROLES } from "@/shared/constants/role.constant";

export type StepConfig = {
  stepOrder: number;
  name: string;
  approverType: "MANAGER" | "ROLE";
  approverRole: string | null;
};

export type Assignee =
  | { approverId: string; approverRole: null }
  | { approverId: null; approverRole: string };

export type Actor = { id: string; roles: string[] };

export type Assignment = {
  result: string;
  approverId: string | null;
  approverRole: string | null;
  requesterId: string;
};

export type ActDecision =
  | { allowed: true; onBehalfOfId: string | null }
  | { allowed: false; reason: "NOT_WAITING" | "OWN_REQUEST" | "NOT_ASSIGNED" };

export function resolveAssignee(step: StepConfig, requester: { managerId: string | null }): Assignee | null {
  if (step.approverType === "MANAGER") {
    return requester.managerId ? { approverId: requester.managerId, approverRole: null } : null;
  }
  return step.approverRole ? { approverId: null, approverRole: step.approverRole } : null;
}

export function nextStep<T extends { stepOrder: number }>(steps: T[], currentOrder: number): T | undefined {
  return steps.filter((s) => s.stepOrder > currentOrder).sort((a, b) => a.stepOrder - b.stepOrder)[0];
}

function isAssignedTo(assignment: Assignment, who: Actor) {
  return assignment.approverId
    ? assignment.approverId === who.id
    : !!assignment.approverRole && who.roles.includes(assignment.approverRole);
}

export function decideAct(assignment: Assignment, actor: Actor, delegators: Actor[]): ActDecision {
  if (assignment.result !== "WAITING") return { allowed: false, reason: "NOT_WAITING" };
  if (assignment.requesterId === actor.id) return { allowed: false, reason: "OWN_REQUEST" };
  if (isAssignedTo(assignment, actor)) return { allowed: true, onBehalfOfId: null };
  const delegator = delegators.find((d) => d.id !== assignment.requesterId && isAssignedTo(assignment, d));
  return delegator ? { allowed: true, onBehalfOfId: delegator.id } : { allowed: false, reason: "NOT_ASSIGNED" };
}

export function computeDueAt(from: Date, slaHours: number) {
  return new Date(from.getTime() + slaHours * 3_600_000);
}

export function hasApproverRole(roles: string[]) {
  return roles.some((role) => APPROVER_ROLES.includes(role));
}
