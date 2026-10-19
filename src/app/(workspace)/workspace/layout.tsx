import { canAccessApprovals } from "@/modules/approvals/approvals.query";
import { PendingApprovalsBadge } from "@/modules/approvals/components/pending-approvals-badge";
import { canDelegate, hasReceivedDelegations } from "@/modules/delegations/delegations.query";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { WorkspaceLayout } from "@/shared/components/layouts/workspace";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function Layout({ children }: LayoutProps<"/workspace">) {
  const { user } = await requireRole(ROLES.EMPLOYEE);
  const [canApprove, delegate, received] = await Promise.all([
    canAccessApprovals(user.id),
    canDelegate(user.id),
    hasReceivedDelegations(user.id),
  ]);

  return (
    <WorkspaceLayout
      user={{ name: user.name, email: user.email, role: user.role, image: user.image }}
      access={{ canApprove, canDelegate: delegate || received }}
      headerExtra={<NotificationBell />}
      badges={canApprove ? { approvals: <PendingApprovalsBadge /> } : undefined}
    >
      {children}
    </WorkspaceLayout>
  );
}
