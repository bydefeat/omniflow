import { Layout } from "antd";
import type { ReactNode } from "react";

import type { ShellUser } from "@/shared/components/ui/user-avatar-menu";

import { AdministratorHeader } from "./header";
import { AdministratorSidebar } from "./sidebar";

export function AdministratorLayout({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  return (
    <Layout className="min-h-screen">
      <AdministratorSidebar />
      <Layout>
        <AdministratorHeader user={user} />
        <main className="w-full p-4 md:p-6">{children}</main>
      </Layout>
    </Layout>
  );
}
