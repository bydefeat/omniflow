import { type ReactNode, Suspense } from "react";

import { AdministratorLayout } from "@/shared/components/layouts/administrator";
import { PageSkeleton } from "@/shared/components/ui/page-skeleton";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

async function AdministratorShell({ children }: { children: ReactNode }) {
  const { user } = await requireRole(ROLES.ADMIN);
  return (
    <AdministratorLayout user={{ name: user.name, email: user.email, role: user.role, image: user.image }}>
      {children}
    </AdministratorLayout>
  );
}

export default function Layout({ children }: LayoutProps<"/administrator">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdministratorShell>{children}</AdministratorShell>
    </Suspense>
  );
}
