import { forbidden } from "next/navigation";

import { readPendingFilters } from "@/modules/approvals/approvals.constant";
import { canAccessApprovals, searchPendingApprovals, summarizePendingApprovals } from "@/modules/approvals/approvals.query";
import { PendingApprovalsTable } from "@/modules/approvals/components/pending-approvals-table";
import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function ApprovalsPage({ searchParams }: PageProps<"/workspace/approvals">) {
  const { user } = await requireSession();
  if (!(await canAccessApprovals(user.id))) forbidden();
  const filters = readPendingFilters(await searchParams);
  const [result, summary, types] = await Promise.all([
    searchPendingApprovals(user.id, filters),
    summarizePendingApprovals(user.id),
    listRequestTypes(),
  ]);

  return (
    <>
      <PageHeader
        title="Đơn chờ tôi duyệt"
        subtitle={`${summary.total} đơn${summary.overdue ? ` · ${summary.overdue} quá hạn` : ""}`}
      />
      <PendingApprovalsTable {...result} filters={filters} types={types.map((t) => ({ id: t.id, name: t.name }))} />
    </>
  );
}
