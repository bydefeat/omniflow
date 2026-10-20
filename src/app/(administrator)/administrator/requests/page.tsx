import type { Metadata } from "next";
import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { ExportRequestsButton } from "@/modules/requests/components/export-requests-button";
import { RequestsTable } from "@/modules/requests/components/requests-table";
import { readRequestFilters } from "@/modules/requests/requests.constant";
import { searchRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Đơn yêu cầu" };

export default async function AdminRequestsPage({ searchParams }: PageProps<"/administrator/requests">) {
  await requireRole(ROLES.ADMIN);
  const filters = readRequestFilters(await searchParams);
  const [{ rows, total }, types] = await Promise.all([searchRequests({}, filters), listRequestTypes()]);
  return (
    <>
      <PageHeader
        title="Đơn yêu cầu"
        subtitle={`${total} đơn đã gửi`}
        extra={<ExportRequestsButton filters={filters} total={total} />}
      />
      <RequestsTable
        rows={rows}
        total={total}
        filters={filters}
        types={types}
        basePath="/administrator/requests"
        showRequester
        statuses={["PENDING", "NEEDS_INFO", "APPROVED", "REJECTED", "CANCELLED"]}
      />
    </>
  );
}
