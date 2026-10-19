import { RequestTypesManager } from "@/modules/request-types/components/request-types-manager";
import { listRequestTypes } from "@/modules/request-types/request-types.query";

export default async function RequestTypesPage() {
  const types = await listRequestTypes();
  return <RequestTypesManager types={types} />;
}
