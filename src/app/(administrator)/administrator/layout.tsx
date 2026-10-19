import { AdministratorLayout } from "@/shared/components/layouts/administrator";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function Layout({ children }: LayoutProps<"/administrator">) {
  const { user } = await requireRole(ROLES.ADMIN);
  return (
    <AdministratorLayout user={{ name: user.name, email: user.email, role: user.role, image: user.image }}>
      {children}
    </AdministratorLayout>
  );
}
