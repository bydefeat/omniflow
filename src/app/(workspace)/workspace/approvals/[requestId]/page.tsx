import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canViewRequest, getActionableApproval, getApprovalTimeline } from "@/modules/approvals/approvals.query";
import { ApprovalActions } from "@/modules/approvals/components/approval-actions";
import { ApprovalTimeline } from "@/modules/approvals/components/approval-timeline";
import { RequestDetail } from "@/modules/requests/components/request-detail";
import { getRequestDetail } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Duyệt đơn" };

export default async function ApprovalDetailPage({ params }: PageProps<"/workspace/approvals/[requestId]">) {
  const { requestId } = await params;
  const { user } = await requireSession();
  if (!(await canViewRequest(requestId, user.id))) notFound();
  const [request, timeline, actionable] = await Promise.all([
    getRequestDetail(requestId),
    getApprovalTimeline(requestId),
    getActionableApproval(requestId, user.id),
  ]);
  if (!request || request.status === "DRAFT") notFound();

  return (
    <>
      <PageHeader title={request.code} subtitle={request.typeName} backHref="/workspace/approvals" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RequestDetail request={request} />
          {actionable && (
            <ApprovalActions
              approvalId={actionable.approvalId}
              stepName={actionable.stepName}
              onBehalfOfName={actionable.onBehalfOfName}
            />
          )}
        </div>
        <ApprovalTimeline timeline={timeline} />
      </div>
    </>
  );
}
