import { RequestsTable } from "@/modules/requests/components/requests-table";
import { listAllRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";

export default async function AdminRequestsPage() {
  const rows = await listAllRequests();
  return (
    <>
      <PageHeader title="Đơn yêu cầu" subtitle={`${rows.length} đơn đã gửi`} />
      <RequestsTable
        rows={rows}
        basePath="/administrator/requests"
        showRequester
        statuses={["PENDING", "NEEDS_INFO", "APPROVED", "REJECTED", "CANCELLED"]}
      />
    </>
  );
}
