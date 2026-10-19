import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function Layout({
  children,
}: LayoutProps<"/administrator">) {
  await requireRole(ROLES.ADMIN);
  return children;
}
