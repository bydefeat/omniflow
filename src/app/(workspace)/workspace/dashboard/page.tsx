import type { Metadata } from "next";
import { canAccessApprovals, summarizePendingApprovals } from "@/modules/approvals/approvals.query";
import { PendingApprovalsCard } from "@/modules/approvals/components/pending-approvals-card";
import { MyRequestsSummary } from "@/modules/requests/components/my-requests-summary";
import { countMyRequestsByStatus, listMyRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function DashboardPage() {
  const { user } = await requireSession();
  const [counts, recent, canApprove] = await Promise.all([
    countMyRequestsByStatus(user.id),
    listMyRequests(user.id, 5),
    canAccessApprovals(user.id),
  ]);
  const pending = canApprove ? await summarizePendingApprovals(user.id) : null;

  return (
    <>
      <PageHeader title={`Xin chào, ${user.name}`} subtitle="Tổng quan đề xuất và công việc phê duyệt của bạn" />
      <div className="space-y-6">
        {pending && <PendingApprovalsCard total={pending.total} overdue={pending.overdue} />}
        <MyRequestsSummary counts={counts} recent={recent} />
      </div>
    </>
  );
}
