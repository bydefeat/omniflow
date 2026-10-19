import { listDepartmentOptions } from "@/modules/departments/departments.query";
import { UsersManager } from "@/modules/users/components/users-manager";
import { listUsers } from "@/modules/users/users.query";
import { requireSession } from "@/shared/libs/session.lib";

export default async function UsersPage() {
  const { user } = await requireSession();
  const [users, departments] = await Promise.all([listUsers(), listDepartmentOptions()]);
  return <UsersManager users={users} departments={departments} currentUserId={user.id} />;
}
