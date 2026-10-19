import { DepartmentsManager } from "@/modules/departments/components/departments-manager";
import { listDepartments } from "@/modules/departments/departments.query";

export default async function DepartmentsPage() {
  const departments = await listDepartments();
  return <DepartmentsManager departments={departments} />;
}
