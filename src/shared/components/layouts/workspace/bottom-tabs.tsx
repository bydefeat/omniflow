"use client";

import { MenuOutlined } from "@ant-design/icons";
import { Drawer, Menu, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { WORKSPACE_TAB_KEYS } from "@/shared/constants/navigation.constant";
import { findActiveItem } from "@/shared/libs/navigation.lib";

import { visibleWorkspaceNav, type WorkspaceAccess } from "./nav-items";

export function BottomTabs({
  access,
  badges,
}: {
  access: WorkspaceAccess;
  badges?: Partial<Record<string, ReactNode>>;
}) {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  const items = visibleWorkspaceNav(access);
  const active = findActiveItem(items, pathname);
  const tabs = items.filter((item) =>
    (WORKSPACE_TAB_KEYS as readonly string[]).includes(item.key),
  );

  return (
    <>
      <nav
        data-print-hidden
        className="fixed inset-x-0 bottom-0 z-30 flex md:hidden"
        style={{
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {tabs.map((item) => {
          const selected = active?.key === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
              style={{ color: selected ? token.colorPrimary : token.colorTextSecondary }}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {badges?.[item.key] && (
                <span className="absolute top-1 left-1/2 ms-2">{badges[item.key]}</span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-0 bg-transparent py-2 text-[11px]"
          style={{ color: token.colorTextSecondary }}
        >
          <MenuOutlined className="text-lg leading-none" />
          <span>Thêm</span>
        </button>
      </nav>

      <Drawer placement="bottom" open={open} onClose={() => setOpen(false)} title="Menu" size="auto">
        <Menu
          mode="inline"
          className="!border-e-0"
          selectedKeys={active ? [active.key] : []}
          onClick={() => setOpen(false)}
          items={items.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.href}>{item.label}</Link>,
          }))}
        />
      </Drawer>
    </>
  );
}
