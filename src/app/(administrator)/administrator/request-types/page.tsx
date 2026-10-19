import { RequestTypesManager } from "@/modules/request-types/components/request-types-manager";
import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function RequestTypesPage() {
  await requireRole(ROLES.ADMIN);
  const types = await listRequestTypes();
  return <RequestTypesManager types={types} />;
}
