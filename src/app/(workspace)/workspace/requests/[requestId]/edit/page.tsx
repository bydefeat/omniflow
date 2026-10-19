import { notFound } from "next/navigation";

import { resubmitRequest, submitRequest } from "@/modules/approvals/approvals.action";
import { getLatestReturn } from "@/modules/approvals/approvals.query";
import { CancelRequestButton } from "@/modules/approvals/components/cancel-request-button";
import { ReturnNotice } from "@/modules/approvals/components/return-notice";
import { type ActiveRequestType, listActiveRequestTypes } from "@/modules/request-types/request-types.query";
import { DeleteDraftButton } from "@/modules/requests/components/delete-draft-button";
import { RequestForm } from "@/modules/requests/components/request-form";
import { getDraftForEdit } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function EditDraftPage({ params }: PageProps<"/workspace/requests/[requestId]/edit">) {
  const { requestId } = await params;
  const { user } = await requireSession();
  const draft = await getDraftForEdit(requestId, user.id);
  if (!draft) notFound();

  if (draft.status === "NEEDS_INFO" && draft.snapshot) {
    const returned = await getLatestReturn(draft.id);
    const type: ActiveRequestType = {
      id: draft.requestTypeId,
      code: "",
      name: draft.typeName,
      description: null,
      slaHours: draft.snapshot.slaHours,
      hasLineItems: draft.snapshot.hasLineItems,
      formSchema: draft.snapshot.formSchema,
      steps: draft.snapshot.steps.map((s) => ({ requestTypeId: draft.requestTypeId, stepOrder: s.stepOrder, name: s.name })),
    };
    return (
      <>
        <PageHeader
          title="Bổ sung đơn"
          subtitle={draft.typeName}
          backHref={`/workspace/requests/${draft.id}`}
          extra={<CancelRequestButton requestId={draft.id} redirectTo={`/workspace/requests/${draft.id}`} />}
        />
        {returned && <ReturnNotice info={returned} />}
        <RequestForm types={[type]} draft={draft} submitAction={resubmitRequest} resubmit />
      </>
    );
  }

  const types = await listActiveRequestTypes();
  return (
    <>
      <PageHeader title="Sửa đơn nháp" backHref="/workspace/requests" extra={<DeleteDraftButton requestId={draft.id} />} />
      <RequestForm types={types} draft={draft} submitAction={submitRequest} />
    </>
  );
}
