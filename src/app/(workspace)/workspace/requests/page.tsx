import { Button } from "antd";
import Link from "next/link";

import { RequestsTable } from "@/modules/requests/components/requests-table";
import { listMyRequests } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function MyRequestsPage() {
  const { user } = await requireSession();
  const rows = await listMyRequests(user.id);

  return (
    <>
      <PageHeader
        title="Đơn của tôi"
        subtitle={`${rows.length} đề xuất`}
        extra={
          <Link href="/workspace/requests/new">
            <Button type="primary">Tạo đề xuất</Button>
          </Link>
        }
      />
      <RequestsTable rows={rows} basePath="/workspace/requests" editDrafts />
    </>
  );
}
