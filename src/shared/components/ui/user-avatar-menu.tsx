"use client";

import {
  AppstoreOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Dropdown, type MenuProps } from "antd";
import { useRouter } from "next/navigation";

import { HOME_PATHS, ROLES, SIGN_IN_PATH } from "@/shared/constants/role.constant";
import { BRAND_COLORS } from "@/shared/constants/theme.constant";
import { authClient } from "@/shared/libs/auth-client.lib";
import { hasRole } from "@/shared/libs/role.lib";

export type ShellUser = {
  name: string;
  email: string;
  role?: string | null;
  image?: string | null;
};

export function UserAvatarMenu({
  user,
  portal,
}: {
  user: ShellUser;
  portal: "workspace" | "administrator";
}) {
  const router = useRouter();
  const isAdmin = hasRole(user.role, ROLES.ADMIN);

  const items: MenuProps["items"] = [
    {
      key: "info",
      type: "group",
      label: (
        <div className="max-w-56">
          <div className="truncate font-medium text-black/85">{user.name}</div>
          <div className="truncate text-xs">{user.email}</div>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Hồ sơ cá nhân",
      onClick: () => router.push("/workspace/profile"),
    },
    portal === "workspace" && isAdmin
      ? {
          key: "administrator",
          icon: <SettingOutlined />,
          label: "Trang quản trị",
          onClick: () => router.push(HOME_PATHS.admin),
        }
      : null,
    portal === "administrator"
      ? {
          key: "workspace",
          icon: <AppstoreOutlined />,
          label: "Không gian làm việc",
          onClick: () => router.push(HOME_PATHS.default),
        }
      : null,
    { type: "divider" },
    {
      key: "sign-out",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: async () => {
        await authClient.signOut();
        router.replace(SIGN_IN_PATH);
      },
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 py-1"
        aria-label="Tài khoản"
      >
        <Avatar
          src={user.image || undefined}
          style={{ background: BRAND_COLORS.primary }}
        >
          {user.name.charAt(0).toUpperCase()}
        </Avatar>
        <span className="hidden max-w-40 truncate text-sm lg:inline">
          {user.name}
        </span>
      </button>
    </Dropdown>
  );
}
