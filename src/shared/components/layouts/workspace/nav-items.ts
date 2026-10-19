import { type NavItem, WORKSPACE_NAV } from "@/shared/constants/navigation.constant";

export type WorkspaceAccess = {
  canApprove: boolean;
  canDelegate: boolean;
};

export function visibleWorkspaceNav({ canApprove, canDelegate }: WorkspaceAccess): NavItem[] {
  return WORKSPACE_NAV.filter(
    (item) =>
      !item.access ||
      (item.access === "approvals" && canApprove) ||
      (item.access === "delegations" && canDelegate),
  );
}
