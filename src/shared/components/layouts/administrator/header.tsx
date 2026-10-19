"use client";

import { Breadcrumb, Layout, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type ShellUser, UserAvatarMenu } from "@/shared/components/ui/user-avatar-menu";
import { ADMINISTRATOR_NAV } from "@/shared/constants/navigation.constant";
import { findActiveItem } from "@/shared/libs/navigation.lib";

export function AdministratorHeader({ user }: { user: ShellUser }) {
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
      className="!sticky top-0 z-20 flex items-center justify-between gap-3 !px-6"
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Breadcrumb
        className="ps-8 lg:ps-0"
        items={[
          { title: <Link href="/administrator">Quản trị</Link> },
          ...(group?.label ? [{ title: group.label }] : []),
          ...(active && active.href !== "/administrator"
            ? [{ title: <Link href={active.href}>{active.label}</Link> }]
            : []),
        ]}
      />
      <UserAvatarMenu user={user} portal="administrator" />
    </Layout.Header>
  );
}
