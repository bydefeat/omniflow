"use client";

import { Empty, Table, Tag } from "antd";
import Link from "next/link";

import { formatDateTime, formatMoney } from "@/shared/libs/format.lib";

import type { PendingApprovalRow } from "../approvals.query";

export function PendingApprovalsTable({ rows }: { rows: PendingApprovalRow[] }) {
  if (rows.length === 0) {
    return <Empty className="!py-12" description="Không có đơn nào đang chờ bạn duyệt" />;
  }

  return (
    <Table
      rowKey="approvalId"
      size="small"
      dataSource={rows}
      scroll={{ x: 960 }}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      rowClassName={(row) => (row.overdue ? "bg-red-50" : "")}
      columns={[
        {
          title: "Mã đơn",
          dataIndex: "code",
          width: 140,
          render: (code, row) => <Link href={`/workspace/approvals/${row.requestId}`}>{code}</Link>,
        },
        {
          title: "Tiêu đề",
          dataIndex: "title",
          render: (title, row) => (
            <div>
              <Link href={`/workspace/approvals/${row.requestId}`} className="font-medium">
                {title}
              </Link>
              <div className="text-xs text-black/45">{row.typeName}</div>
            </div>
          ),
        },
        {
          title: "Người đề xuất",
          dataIndex: "requesterName",
          width: 180,
          render: (name, row) => (
            <div>
              <div>{name}</div>
              <div className="text-xs text-black/45">{row.departmentName}</div>
            </div>
          ),
        },
        {
          title: "Bước",
          dataIndex: "stepName",
          width: 200,
          render: (step, row) => (
            <div>
              <div>{step}</div>
              {row.onBehalfOfName && <Tag color="purple">Thay {row.onBehalfOfName}</Tag>}
            </div>
          ),
        },
        {
          title: "Tổng tiền",
          dataIndex: "totalAmount",
          width: 140,
          align: "right",
          render: (v) => (v == null ? "—" : formatMoney(v)),
        },
        {
          title: "Hạn xử lý",
          dataIndex: "dueAt",
          width: 160,
          render: (due, row) => (
            <div>
              <div>{formatDateTime(due)}</div>
              {row.overdue && <Tag color="error">Quá hạn</Tag>}
            </div>
          ),
        },
      ]}
    />
  );
}
