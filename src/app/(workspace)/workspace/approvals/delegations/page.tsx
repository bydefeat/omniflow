import { forbidden } from "next/navigation";

import { DelegationsManager } from "@/modules/delegations/components/delegations-manager";
import { canDelegate, listMyDelegations } from "@/modules/delegations/delegations.query";
import { listUserOptions } from "@/modules/users/users.query";
import { requireSession } from "@/shared/libs/session.lib";

export default async function DelegationsPage() {
  const { user } = await requireSession();
  if (!(await canDelegate(user.id, user.role))) forbidden();
  const [{ given, received }, candidates] = await Promise.all([
    listMyDelegations(user.id),
    listUserOptions({ excludeId: user.id }),
  ]);
  return <DelegationsManager given={given} received={received} candidates={candidates} />;
}
