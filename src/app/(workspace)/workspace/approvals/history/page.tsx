import { forbidden } from "next/navigation";

import { readHistoryFilters } from "@/modules/approvals/approvals.constant";
import { canAccessApprovals, searchApprovalHistory } from "@/modules/approvals/approvals.query";
import { ApprovalHistoryTable } from "@/modules/approvals/components/approval-history-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function ApprovalHistoryPage({ searchParams }: PageProps<"/workspace/approvals/history">) {
  const { user } = await requireSession();
  if (!(await canAccessApprovals(user.id))) forbidden();
  const filters = readHistoryFilters(await searchParams);
  const { rows, total } = await searchApprovalHistory(user.id, filters);
  return (
    <>
      <PageHeader title="Lịch sử duyệt" subtitle={`${total} lượt đã xử lý`} />
      <ApprovalHistoryTable rows={rows} total={total} filters={filters} />
    </>
  );
}
