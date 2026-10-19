import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getApprovalTimeline, getWaitingRound } from "@/modules/approvals/approvals.query";
import { ApprovalTimeline } from "@/modules/approvals/components/approval-timeline";
import { ReassignApproval } from "@/modules/approvals/components/reassign-approval";
import { RequestDetail } from "@/modules/requests/components/request-detail";
import { getRequestDetail } from "@/modules/requests/requests.query";
import { listUserOptions } from "@/modules/users/users.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Chi tiết đơn" };

export default async function AdminRequestPage({ params }: PageProps<"/administrator/requests/[requestId]">) {
  await requireRole(ROLES.ADMIN);
  const { requestId } = await params;
  const [request, timeline, waitingRound, users] = await Promise.all([
    getRequestDetail(requestId),
    getApprovalTimeline(requestId),
    getWaitingRound(requestId),
    listUserOptions(),
  ]);
  if (!request || request.status === "DRAFT") notFound();

  return (
    <>
      <PageHeader title={request.code} subtitle={request.typeName} backHref="/administrator/requests" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RequestDetail request={request} />
        </div>
        <div className="space-y-6">
          <ApprovalTimeline timeline={timeline} />
          {waitingRound && <ReassignApproval round={waitingRound} users={users} />}
        </div>
      </div>
    </>
  );
}
