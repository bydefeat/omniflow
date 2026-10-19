import { forbidden } from "next/navigation";

import { canAccessApprovals, getPendingApprovals } from "@/modules/approvals/approvals.query";
import { PendingApprovalsTable } from "@/modules/approvals/components/pending-approvals-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function ApprovalsPage() {
  const { user } = await requireSession();
  if (!(await canAccessApprovals(user.id))) forbidden();
  const rows = await getPendingApprovals(user.id);
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <>
      <PageHeader title="Đơn chờ tôi duyệt" subtitle={`${rows.length} đơn${overdue ? ` · ${overdue} quá hạn` : ""}`} />
      <PendingApprovalsTable rows={rows} />
    </>
  );
}
