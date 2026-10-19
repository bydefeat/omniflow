import { notFound } from "next/navigation";

import { submitRequest } from "@/modules/approvals/approvals.action";
import { listActiveRequestTypes } from "@/modules/request-types/request-types.query";
import { DeleteDraftButton } from "@/modules/requests/components/delete-draft-button";
import { RequestForm } from "@/modules/requests/components/request-form";
import { getDraftForEdit } from "@/modules/requests/requests.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requireSession } from "@/shared/libs/session.lib";

export default async function EditDraftPage({ params }: PageProps<"/workspace/requests/[requestId]/edit">) {
  const { requestId } = await params;
  const { user } = await requireSession();
  const [draft, types] = await Promise.all([getDraftForEdit(requestId, user.id), listActiveRequestTypes()]);
  if (!draft) notFound();

  return (
    <>
      <PageHeader title="Sửa đơn nháp" backHref="/workspace/requests" extra={<DeleteDraftButton requestId={draft.id} />} />
      <RequestForm types={types} draft={draft} submitAction={submitRequest} />
    </>
  );
}
