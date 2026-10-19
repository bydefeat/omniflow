import { submitRequest } from "@/modules/approvals/approvals.action";
import { listActiveRequestTypes } from "@/modules/request-types/request-types.query";
import { RequestForm } from "@/modules/requests/components/request-form";
import { PageHeader } from "@/shared/components/ui/page-header";

export default async function NewRequestPage() {
  const types = await listActiveRequestTypes();
  return (
    <>
      <PageHeader title="Tạo đề xuất mới" backHref="/workspace/requests" />
      <RequestForm types={types} submitAction={submitRequest} />
    </>
  );
}
