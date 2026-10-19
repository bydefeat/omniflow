import { getAdminOverview } from "@/modules/approvals/approvals.query";
import { AdminOverview } from "@/modules/approvals/components/admin-overview";
import { listDepartmentOptions } from "@/modules/departments/departments.query";
import { listRequestTypes } from "@/modules/request-types/request-types.query";
import { listUserOptions } from "@/modules/users/users.query";
import { PageHeader } from "@/shared/components/ui/page-header";

export default async function AdministratorPage() {
  const [overview, departments, types, users] = await Promise.all([
    getAdminOverview(),
    listDepartmentOptions(),
    listRequestTypes(),
    listUserOptions(),
  ]);

  return (
    <>
      <PageHeader title="Tổng quan hệ thống" />
      <AdminOverview
        {...overview}
        counts={{
          users: users.length,
          departments: departments.length,
          activeTypes: types.filter((t) => t.isActive).length,
        }}
      />
    </>
  );
}
