import { Layout } from "antd";
import type { ReactNode } from "react";

import type { ShellUser } from "@/shared/components/ui/user-avatar-menu";

import { BottomTabs } from "./bottom-tabs";
import type { WorkspaceAccess } from "./nav-items";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type WorkspaceLayoutProps = {
  user: ShellUser;
  access: WorkspaceAccess;
  headerExtra?: ReactNode;
  badges?: Partial<Record<string, ReactNode>>;
  children: ReactNode;
};

export function WorkspaceLayout({
  user,
  access,
  headerExtra,
  badges,
  children,
}: WorkspaceLayoutProps) {
  return (
    <Layout className="min-h-screen">
      <Sidebar access={access} badges={badges} />
      <Layout>
        <Topbar user={user} extra={headerExtra} />
        <Layout.Content className="mx-auto w-full max-w-6xl p-4 pb-24 md:p-6">
          {children}
        </Layout.Content>
      </Layout>
      <BottomTabs access={access} badges={badges} />
    </Layout>
  );
}
