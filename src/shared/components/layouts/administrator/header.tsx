"use client";

import { Breadcrumb, Layout, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { type ShellUser, UserAvatarMenu } from "@/shared/components/ui/user-avatar-menu";
import { ADMINISTRATOR_NAV } from "@/shared/constants/navigation.constant";
import { findActiveItem } from "@/shared/libs/navigation.lib";

import { AdministratorMobileMenu } from "./sidebar";

export function AdministratorHeader({ user, extra }: { user: ShellUser; extra?: ReactNode }) {
  const pathname = usePathname();
  const { token } = theme.useToken();

  const group = ADMINISTRATOR_NAV.find((g) =>
    g.items.some((item) => findActiveItem([item], pathname)),
  );
  const active = findActiveItem(
    ADMINISTRATOR_NAV.flatMap((g) => g.items),
    pathname,
  );

  return (
    <Layout.Header
      className="!sticky top-0 z-20 flex items-center justify-between gap-3 !px-4 md:!px-6"
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AdministratorMobileMenu />
        <Breadcrumb
          className="min-w-0 truncate"
          items={[
            { title: <Link href="/administrator">Quản trị</Link> },
            ...(group?.label ? [{ title: group.label }] : []),
            ...(active && active.href !== "/administrator"
              ? [{ title: <Link href={active.href}>{active.label}</Link> }]
              : []),
          ]}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        <UserAvatarMenu user={user} portal="administrator" />
      </div>
    </Layout.Header>
  );
}
