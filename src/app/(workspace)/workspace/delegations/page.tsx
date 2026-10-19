import { forbidden } from "next/navigation";

import { DelegationsManager } from "@/modules/delegations/components/delegations-manager";
import { canDelegate, hasReceivedDelegations, listMyDelegations } from "@/modules/delegations/delegations.query";
import { listUserOptions } from "@/modules/users/users.query";
import { requireSession } from "@/shared/libs/session.lib";

export default async function DelegationsPage() {
  const { user } = await requireSession();
  const [canCreate, received] = await Promise.all([canDelegate(user.id), hasReceivedDelegations(user.id)]);
  if (!canCreate && !received) forbidden();
  const [delegationsOfUser, candidates] = await Promise.all([
    listMyDelegations(user.id),
    listUserOptions({ excludeId: user.id }),
  ]);
  return (
    <DelegationsManager
      given={delegationsOfUser.given}
      received={delegationsOfUser.received}
      candidates={candidates}
      canCreate={canCreate}
    />
  );
}
