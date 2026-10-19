"use client";

import { AuditOutlined } from "@ant-design/icons";
import { Button, Card, Statistic } from "antd";
import Link from "next/link";

export function PendingApprovalsCard({ total, overdue }: { total: number; overdue: number }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-8">
          <Statistic title="Đơn chờ bạn duyệt" value={total} prefix={<AuditOutlined />} />
          {overdue > 0 && <Statistic title="Quá hạn" value={overdue} className="[&_.ant-statistic-content]:!text-red-500" />}
        </div>
        <Link href="/workspace/approvals">
          <Button type="primary">Xử lý ngay</Button>
        </Link>
      </div>
    </Card>
  );
}
