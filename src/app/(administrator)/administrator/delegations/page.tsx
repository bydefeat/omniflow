import type { Metadata } from "next";

import { DelegationsAdmin } from "@/modules/delegations/components/delegations-admin";
import { DELEGATION_STATUSES } from "@/modules/delegations/delegations.constant";
import { searchDelegations } from "@/modules/delegations/delegations.query";
import { listUserOptions } from "@/modules/users/users.query";
import { ROLES } from "@/shared/constants/role.constant";
import { readPage, readParam } from "@/shared/libs/list-params.lib";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Ủy quyền" };

export default async function AdminDelegationsPage({ searchParams }: PageProps<"/administrator/delegations">) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;
  const status = readParam(params, "status");
  const filters = {
    q: readParam(params, "q"),
    status: DELEGATION_STATUSES.find((s) => s === status),
    page: readPage(params),
  };
  const [{ rows, total }, users] = await Promise.all([searchDelegations(filters), listUserOptions()]);
  return <DelegationsAdmin rows={rows} total={total} filters={filters} users={users} />;
}
