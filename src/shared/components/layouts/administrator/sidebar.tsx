"use client";

import { Layout, Menu, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/shared/components/ui/logo";
import { ADMINISTRATOR_NAV } from "@/shared/constants/navigation.constant";
import { findActiveItem } from "@/shared/libs/navigation.lib";

export function AdministratorSidebar() {
  const pathname = usePathname();
  const active = findActiveItem(
    ADMINISTRATOR_NAV.flatMap((group) => group.items),
    pathname,
  );

  const items: MenuProps["items"] = ADMINISTRATOR_NAV.flatMap((group) => {
    const children = group.items.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: <Link href={item.href}>{item.label}</Link>,
    }));
    return group.label
      ? [{ key: group.key, type: "group" as const, label: group.label, children }]
      : children;
  });

  return (
    <Layout.Sider
      width={248}
      breakpoint="lg"
      collapsedWidth={0}
      className="!sticky top-0 z-30 h-screen"
    >
      <div className="flex h-16 items-center px-6">
        <Link href="/administrator">
          <Logo inverted />
        </Link>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={active ? [active.key] : []}
        items={items}
      />
    </Layout.Sider>
  );
}
