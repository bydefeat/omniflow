import { DepartmentsManager } from "@/modules/departments/components/departments-manager";
import { listDepartments } from "@/modules/departments/departments.query";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function DepartmentsPage() {
  await requireRole(ROLES.ADMIN);
  const departments = await listDepartments();
  return <DepartmentsManager departments={departments} />;
}
