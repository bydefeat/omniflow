"use client";

import { Card, Empty, Statistic, Table } from "antd";
import Link from "next/link";

import { ROLE_LABELS } from "@/shared/constants/role.constant";

type Props = {
  pending: number;
  overdue: number;
  byApprover: { name: string; total: number }[];
  byRole: { role: string | null; total: number }[];
  counts: { users: number; departments: number; activeTypes: number };
};

export function AdminOverview({ pending, overdue, byApprover, byRole, counts }: Props) {
  const queue = [
    ...byApprover.map((r) => ({ key: `u-${r.name}`, name: r.name, total: r.total })),
    ...byRole.map((r) => ({
      key: `r-${r.role}`,
      name: `Nhóm ${ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}`,
      total: r.total,
    })),
  ].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Link href="/administrator/requests">
          <Card hoverable size="small">
            <Statistic title="Đơn đang chờ duyệt" value={pending} />
          </Card>
        </Link>
        <Card size="small">
          <Statistic
            title="Lượt duyệt quá hạn SLA"
            value={overdue}
            className={overdue > 0 ? "[&_.ant-statistic-content]:!text-red-500" : undefined}
          />
        </Card>
        <Link href="/administrator/users">
          <Card hoverable size="small">
            <Statistic title="Người dùng" value={counts.users} />
          </Card>
        </Link>
        <Link href="/administrator/departments">
          <Card hoverable size="small">
            <Statistic title="Phòng ban" value={counts.departments} />
          </Card>
        </Link>
        <Link href="/administrator/request-types">
          <Card hoverable size="small">
            <Statistic title="Loại đơn đang dùng" value={counts.activeTypes} />
          </Card>
        </Link>
      </div>

      <Card title="Người duyệt đang có nhiều lượt chờ nhất">
        {queue.length === 0 ? (
          <Empty description="Không có lượt duyệt nào đang chờ" />
        ) : (
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={queue}
            columns={[
              { title: "Người duyệt / nhóm vai trò", dataIndex: "name" },
              { title: "Số lượt chờ", dataIndex: "total", width: 140, align: "right" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
