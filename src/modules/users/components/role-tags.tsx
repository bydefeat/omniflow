"use client";

import { Tag } from "antd";

import { ROLE_LABELS, ROLES } from "@/shared/constants/role.constant";
import { parseRoles } from "@/shared/libs/role.lib";

export function RoleTags({ role }: { role: string | null | undefined }) {
  const roles = parseRoles(role).filter((r) => r !== ROLES.EMPLOYEE);
  if (roles.length === 0) return <Tag>Nhân viên</Tag>;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Tag key={r} color={r === ROLES.ADMIN ? "red" : r === ROLES.APPROVER ? "blue" : "purple"}>
          {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
        </Tag>
      ))}
    </span>
  );
}
