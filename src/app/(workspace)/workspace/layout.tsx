import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function Layout({ children }: LayoutProps<"/workspace">) {
  await requireRole(ROLES.EMPLOYEE);
  return children;
}
