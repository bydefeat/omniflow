import { notFound } from "next/navigation";

import { FormBuilder } from "@/modules/request-types/components/form-builder";
import { getRequestType } from "@/modules/request-types/request-types.query";

export default async function RequestTypeFormPage({ params }: PageProps<"/administrator/request-types/[typeId]/form">) {
  const { typeId } = await params;
  const type = await getRequestType(typeId);
  if (!type) notFound();
  return <FormBuilder key={type.updatedAt.toISOString()} typeId={type.id} fields={type.formSchema} />;
}
