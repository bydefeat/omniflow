import { listDepartmentOptions } from "@/modules/departments/departments.query";
import { UsersManager } from "@/modules/users/components/users-manager";
import { listUserOptions, searchUsers } from "@/modules/users/users.query";
import { readPage, readParam } from "@/shared/libs/list-params.lib";
import { requireSession } from "@/shared/libs/session.lib";

export default async function UsersPage({ searchParams }: PageProps<"/administrator/users">) {
  const params = await searchParams;
  const filters = {
    q: readParam(params, "q"),
    departmentId: readParam(params, "departmentId"),
    role: readParam(params, "role"),
    page: readPage(params),
  };
  const { user } = await requireSession();
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
