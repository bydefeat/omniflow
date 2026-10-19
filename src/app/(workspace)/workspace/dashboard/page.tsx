import { canAccessApprovals, getPendingApprovals } from "@/modules/approvals/approvals.query";
import { PendingApprovalsCard } from "@/modules/approvals/components/pending-approvals-card";
import { MyRequestsSummary } from "@/modules/requests/components/my-requests-summary";
import { countMyRequestsByStatus, listMyRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const [counts, recent, canApprove] = await Promise.all([
    countMyRequestsByStatus(user.id),
    listMyRequests(user.id, 5),
    canAccessApprovals(user.id),
  ]);
  const pending = canApprove ? await getPendingApprovals(user.id) : [];

  return (
    <>
      <PageHeader title={`Xin chào, ${user.name}`} subtitle="Tổng quan đề xuất và công việc phê duyệt của bạn" />
      <div className="space-y-6">
        {canApprove && <PendingApprovalsCard total={pending.length} overdue={pending.filter((p) => p.overdue).length} />}
        <MyRequestsSummary counts={counts} recent={recent} />
      </div>
    </>
  );
}
