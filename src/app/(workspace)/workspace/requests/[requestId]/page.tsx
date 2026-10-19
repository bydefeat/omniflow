import { Button } from "antd";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApprovalTimeline } from "@/modules/approvals/approvals.query";
import { ApprovalTimeline } from "@/modules/approvals/components/approval-timeline";
import { CancelRequestButton } from "@/modules/approvals/components/cancel-request-button";
import { RequestDetail } from "@/modules/requests/components/request-detail";
import { getRequestDetail } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function RequestPage({ params }: PageProps<"/workspace/requests/[requestId]">) {
  const { requestId } = await params;
  const { user } = await requireSession();
  const request = await getRequestDetail(requestId);
  if (!request || request.requesterId !== user.id) notFound();
  const timeline = await getApprovalTimeline(requestId);

  return (
    <>
      <PageHeader
        title={request.code ?? "Đơn nháp"}
        subtitle={request.typeName}
        backHref="/workspace/requests"
        extra={
          <>
            {request.status === "DRAFT" && (
              <Link href={`/workspace/requests/${request.id}/edit`}>
                <Button type="primary">Tiếp tục soạn</Button>
              </Link>
            )}
            {request.status === "PENDING" && <CancelRequestButton requestId={request.id} />}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestDetail request={request} />
        </div>
        <ApprovalTimeline timeline={timeline} />
      </div>
    </>
  );
}
