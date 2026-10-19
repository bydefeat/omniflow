import type { Metadata } from "next";
import { listDepartmentOptions } from "@/modules/departments/departments.query";
import { UsersManager } from "@/modules/users/components/users-manager";
import { listUserOptions, searchUsers } from "@/modules/users/users.query";
import { ASSIGNABLE_ROLES, ROLES } from "@/shared/constants/role.constant";
import { readPage, readParam } from "@/shared/libs/list-params.lib";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Người dùng" };

export default async function UsersPage({ searchParams }: PageProps<"/administrator/users">) {
  const params = await searchParams;
  const filters = {
    q: readParam(params, "q"),
    departmentId: readParam(params, "departmentId"),
    role: ASSIGNABLE_ROLES.find((r) => r === readParam(params, "role")),
    page: readPage(params),
  };
  const { user } = await requireRole(ROLES.ADMIN);
  const [{ rows, total }, departments, managers] = await Promise.all([
    searchUsers(filters),
    listDepartmentOptions(),
    listUserOptions(),
  ]);
  return (
    <UsersManager
      users={rows}
      total={total}
      filters={filters}
      managers={managers}
      departments={departments}
      currentUserId={user.id}
    />
  );
}
