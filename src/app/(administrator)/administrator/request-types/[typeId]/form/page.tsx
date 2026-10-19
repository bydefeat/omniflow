import { notFound } from "next/navigation";

import { FormBuilder } from "@/modules/request-types/components/form-builder";
import { getRequestType } from "@/modules/request-types/request-types.query";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function RequestTypeFormPage({ params }: PageProps<"/administrator/request-types/[typeId]/form">) {
  await requireRole(ROLES.ADMIN);
  const { typeId } = await params;
  const type = await getRequestType(typeId);
  if (!type) notFound();
  return <FormBuilder key={type.updatedAt.toISOString()} typeId={type.id} fields={type.formSchema} />;
}
