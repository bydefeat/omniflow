import { getAdminOverview } from "@/modules/approvals/approvals.query";
import { AdminOverview } from "@/modules/approvals/components/admin-overview";
import { listDepartmentOptions } from "@/modules/departments/departments.query";
import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { countUsers } from "@/modules/users/users.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function AdministratorPage() {
  await requireRole(ROLES.ADMIN);
  const [overview, departments, types, users] = await Promise.all([
    getAdminOverview(),
    listDepartmentOptions(),
    listRequestTypes(),
    countUsers(),
  ]);

  return (
    <>
      <PageHeader title="Tổng quan hệ thống" />
      <AdminOverview
        {...overview}
        counts={{
          users,
          departments: departments.length,
          activeTypes: types.filter((t) => t.isActive).length,
        }}
      />
    </>
  );
}
