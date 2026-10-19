import { Button } from "antd";
import Link from "next/link";

import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { RequestsTable } from "@/modules/requests/components/requests-table";
import { readRequestFilters } from "@/modules/requests/requests.constant";
import { searchRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function MyRequestsPage({ searchParams }: PageProps<"/workspace/requests">) {
  const filters = readRequestFilters(await searchParams);
  const { user } = await requireSession();
  const [{ rows, total }, types] = await Promise.all([
    searchRequests({ requesterId: user.id }, filters),
    listRequestTypes(),
  ]);

  return (
    <>
      <PageHeader
        title="Đơn của tôi"
        subtitle={`${total} đề xuất`}
        extra={
          <Link href="/workspace/requests/new">
            <Button type="primary">Tạo đề xuất</Button>
          </Link>
        }
      />
      <RequestsTable rows={rows} total={total} filters={filters} types={types} basePath="/workspace/requests" editDrafts />
    </>
  );
}
