import { getApprovalHistory } from "@/modules/approvals/approvals.query";
import { ApprovalHistoryTable } from "@/modules/approvals/components/approval-history-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function ApprovalHistoryPage() {
  const { user } = await requireSession();
  const rows = await getApprovalHistory(user.id);
  return (
    <>
      <PageHeader title="Lịch sử duyệt" subtitle={`${rows.length} lượt đã xử lý`} />
      <ApprovalHistoryTable rows={rows} />
    </>
  );
}
