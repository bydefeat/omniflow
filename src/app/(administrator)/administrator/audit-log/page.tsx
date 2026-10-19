import type { Metadata } from "next";
import { AuditLogTable } from "@/modules/audit/components/audit-log-table";
import { AUDIT_ACTION_LABELS } from "@/modules/audit/audit.constant";
import { searchAuditLogs } from "@/modules/audit/audit.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { ROLES } from "@/shared/constants/role.constant";
import { readPage, readParam } from "@/shared/libs/list-params.lib";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Nhật ký quản trị" };

export default async function AuditLogPage({ searchParams }: PageProps<"/administrator/audit-log">) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;
  const action = readParam(params, "action");
  const filters = {
    q: readParam(params, "q"),
    action: action && Object.hasOwn(AUDIT_ACTION_LABELS, action) ? action : undefined,
    page: readPage(params),
  };
  const { rows, total } = await searchAuditLogs(filters);
  return (
    <>
      <PageHeader title="Nhật ký quản trị" subtitle={`${total} thao tác được ghi nhận`} />
      <AuditLogTable rows={rows} total={total} filters={filters} />
    </>
  );
}
