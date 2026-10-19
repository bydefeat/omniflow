import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HistoryOutlined,
  HomeOutlined,
  PlusCircleOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { createElement, type ReactNode } from "react";

export type NavAccess = "approvals" | "delegations";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  access?: NavAccess;
};

export type NavGroup = {
  key: string;
  label: string | null;
  items: NavItem[];
};

export const WORKSPACE_NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Tổng quan",
    href: "/workspace/dashboard",
    icon: createElement(HomeOutlined),
  },
  {
    key: "requests",
    label: "Đơn của tôi",
    href: "/workspace/requests",
    icon: createElement(FileTextOutlined),
  },
  {
    key: "new-request",
    label: "Tạo đề xuất",
    href: "/workspace/requests/new",
    icon: createElement(PlusCircleOutlined),
  },
  {
    key: "approvals",
    label: "Chờ tôi duyệt",
    href: "/workspace/approvals",
    icon: createElement(AuditOutlined),
    access: "approvals",
  },
  {
    key: "approval-history",
    label: "Lịch sử duyệt",
    href: "/workspace/approvals/history",
    icon: createElement(HistoryOutlined),
    access: "approvals",
  },
  {
    key: "delegations",
    label: "Ủy quyền",
    href: "/workspace/delegations",
    icon: createElement(SwapOutlined),
    access: "delegations",
  },
  {
    key: "notifications",
    label: "Thông báo",
    href: "/workspace/notifications",
    icon: createElement(BellOutlined),
  },
  {
    key: "profile",
    label: "Hồ sơ",
    href: "/workspace/profile",
    icon: createElement(UserOutlined),
  },
];

export const WORKSPACE_TAB_KEYS = [
  "dashboard",
  "requests",
  "new-request",
  "approvals",
] as const;

export const ADMINISTRATOR_NAV: NavGroup[] = [
  {
    key: "overview",
    label: null,
    items: [
      {
        key: "overview",
        label: "Tổng quan",
        href: "/administrator",
        icon: createElement(DashboardOutlined),
      },
    ],
  },
  {
    key: "organization",
    label: "Tổ chức",
    items: [
      {
        key: "departments",
        label: "Phòng ban",
        href: "/administrator/departments",
        icon: createElement(ApartmentOutlined),
      },
      {
        key: "users",
        label: "Người dùng",
        href: "/administrator/users",
        icon: createElement(TeamOutlined),
      },
    ],
  },
  {
    key: "workflow",
    label: "Quy trình",
    items: [
      {
        key: "request-types",
        label: "Loại đơn & bước duyệt",
        href: "/administrator/request-types",
        icon: createElement(ProfileOutlined),
      },
    ],
  },
  {
    key: "monitoring",
    label: "Giám sát",
    items: [
      {
        key: "all-requests",
        label: "Đơn yêu cầu",
        href: "/administrator/requests",
        icon: createElement(FileSearchOutlined),
      },
      {
        key: "reports",
        label: "Báo cáo",
        href: "/administrator/reports",
        icon: createElement(BarChartOutlined),
      },
      {
        key: "audit-log",
        label: "Nhật ký quản trị",
        href: "/administrator/audit-log",
        icon: createElement(SafetyCertificateOutlined),
      },
    ],
  },
];
