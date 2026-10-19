"use client";

import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/shared/components/ui/logo";
import { ADMINISTRATOR_NAV } from "@/shared/constants/navigation.constant";
import { findActiveItem } from "@/shared/libs/navigation.lib";

type MenuItem = NonNullable<MenuProps["items"]>[number];

function AdministratorMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = findActiveItem(
    ADMINISTRATOR_NAV.flatMap((group) => group.items),
    pathname,
  );

  const items = ADMINISTRATOR_NAV.flatMap<MenuItem>((group) => {
    const children = group.items.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: (
        <Link href={item.href} onClick={onNavigate}>
          {item.label}
        </Link>
      ),
    }));
    return group.label
      ? [{ key: group.key, type: "group" as const, label: group.label, children }]
      : children;
  });

  return <Menu theme="dark" mode="inline" selectedKeys={active ? [active.key] : []} items={items} />;
}

export function AdministratorSidebar() {
  return (
    <Layout.Sider width={248} className="!sticky top-0 z-30 !hidden h-screen lg:!block">
      <div className="flex h-16 items-center px-6">
        <Link href="/administrator">
          <Logo inverted />
        </Link>
      </div>
      <AdministratorMenu />
    </Layout.Sider>
  );
}

export function AdministratorMobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="text"
        className="lg:!hidden"
        icon={<MenuOutlined />}
        aria-label="Mở menu quản trị"
        onClick={() => setOpen(true)}
      />
      <Drawer
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        size={280}
        closable={false}
        styles={{ body: { padding: 0 }, header: { display: "none" } }}
      >
        <Layout.Sider width="100%" className="min-h-full">
          <div className="flex h-16 items-center px-6">
            <Link href="/administrator" onClick={() => setOpen(false)}>
              <Logo inverted />
            </Link>
          </div>
          <AdministratorMenu onNavigate={() => setOpen(false)} />
        </Layout.Sider>
      </Drawer>
    </>
  );
}
