"use client";

import { Layout, Menu, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Logo } from "@/shared/components/ui/logo";
import { findActiveItem } from "@/shared/libs/navigation.lib";
import { useSidebarStore } from "@/shared/stores/sidebar.store";

import { visibleWorkspaceNav, type WorkspaceAccess } from "./nav-items";

export function Sidebar({
  access,
  badges,
}: {
  access: WorkspaceAccess;
  badges?: Partial<Record<string, ReactNode>>;
}) {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);

  useEffect(() => {
    useSidebarStore.persist.rehydrate();
  }, []);

  const items = visibleWorkspaceNav(access);
  const active = findActiveItem(items, pathname);

  return (
    <Layout.Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      theme="light"
      width={240}
      className="!sticky top-0 hidden h-screen md:block print:!hidden"
      style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}` }}
    >
      <div className="flex h-16 items-center px-6">
        <Link href="/workspace/dashboard">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <Menu
        mode="inline"
        className="!border-e-0"
        selectedKeys={active ? [active.key] : []}
        items={items.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: (
            <Link href={item.href} className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              {badges?.[item.key]}
            </Link>
          ),
        }))}
      />
    </Layout.Sider>
  );
}
