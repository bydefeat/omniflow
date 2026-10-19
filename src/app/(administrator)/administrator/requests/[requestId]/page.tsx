import { notFound } from "next/navigation";

import { getApprovalTimeline } from "@/modules/approvals/approvals.query";
import { ApprovalTimeline } from "@/modules/approvals/components/approval-timeline";
import { RequestDetail } from "@/modules/requests/components/request-detail";
import { getRequestDetail } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";

export default async function AdminRequestPage({ params }: PageProps<"/administrator/requests/[requestId]">) {
  const { requestId } = await params;
  const [request, timeline] = await Promise.all([getRequestDetail(requestId), getApprovalTimeline(requestId)]);
  if (!request || request.status === "DRAFT") notFound();

  return (
    <>
      <PageHeader title={request.code} subtitle={request.typeName} backHref="/administrator/requests" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestDetail request={request} />
        </div>
        <ApprovalTimeline timeline={timeline} />
      </div>
    </>
  );
}
