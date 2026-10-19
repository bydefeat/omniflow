import { notFound } from "next/navigation";

import { RequestTypeGeneralForm } from "@/modules/request-types/components/request-type-general-form";
import { getRequestType } from "@/modules/request-types/request-types.query";

export default async function RequestTypePage({ params }: PageProps<"/administrator/request-types/[typeId]">) {
  const { typeId } = await params;
  const type = await getRequestType(typeId);
  if (!type) notFound();
  return <RequestTypeGeneralForm type={type} />;
}
