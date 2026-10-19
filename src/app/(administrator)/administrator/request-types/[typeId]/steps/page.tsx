import { notFound } from "next/navigation";

import { StepsEditor } from "@/modules/request-types/components/steps-editor";
import { getRequestType, hasPendingRequests } from "@/modules/request-types/request-types.query";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function RequestTypeStepsPage({ params }: PageProps<"/administrator/request-types/[typeId]/steps">) {
  await requireRole(ROLES.ADMIN);
  const { typeId } = await params;
  const [type, locked] = await Promise.all([getRequestType(typeId), hasPendingRequests(typeId)]);
  if (!type) notFound();
  return (
    <StepsEditor
      key={type.steps.map((s) => s.id).join()}
      typeId={type.id}
      locked={locked}
      steps={type.steps.map((s) => ({ name: s.name, approverType: s.approverType, approverRole: s.approverRole }))}
    />
  );
}
