"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Layout, theme } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/shared/components/ui/logo";
import { type ShellUser, UserAvatarMenu } from "@/shared/components/ui/user-avatar-menu";

export function Topbar({ user, extra }: { user: ShellUser; extra?: ReactNode }) {
  const { token } = theme.useToken();

  return (
    <Layout.Header
      className="!sticky top-0 z-20 flex items-center justify-between gap-3 !px-4 md:!px-6"
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Link href="/workspace/dashboard" className="md:hidden">
        <Logo />
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 md:gap-3">
        <Link href="/workspace/requests/new" className="hidden sm:block">
          <Button type="primary" icon={<PlusOutlined />}>
            Tạo đề xuất
          </Button>
        </Link>
        {extra}
        <UserAvatarMenu user={user} portal="workspace" />
      </div>
    </Layout.Header>
  );
}
