"use client";

import { Empty, Table, Tag } from "antd";
import Link from "next/link";

import { formatDateTime } from "@/shared/libs/format.lib";

import { APPROVAL_RESULT_META } from "../approvals.constant";
import type { ApprovalHistoryRow } from "../approvals.query";

export function ApprovalHistoryTable({ rows }: { rows: ApprovalHistoryRow[] }) {
  if (rows.length === 0) return <Empty className="!py-12" description="Bạn chưa xử lý lượt duyệt nào" />;

  return (
    <Table
      rowKey="approvalId"
      size="small"
      dataSource={rows}
      scroll={{ x: 960 }}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
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
              <div className="font-medium">{title}</div>
              <div className="text-xs text-black/45">
                {row.typeName} · {row.requesterName}
              </div>
            </div>
          ),
        },
        { title: "Bước", dataIndex: "stepName", width: 180 },
        {
          title: "Kết quả",
          dataIndex: "result",
          width: 160,
          render: (result: keyof typeof APPROVAL_RESULT_META, row) => (
            <div>
              <Tag color={APPROVAL_RESULT_META[result].color}>{APPROVAL_RESULT_META[result].label}</Tag>
              {row.onBehalfOfName && <div className="text-xs text-black/45">Thay {row.onBehalfOfName}</div>}
            </div>
          ),
        },
        { title: "Ý kiến", dataIndex: "comment", width: 240, render: (v) => v ?? "—" },
        { title: "Thời điểm", dataIndex: "decidedAt", width: 150, render: (v) => formatDateTime(v) },
      ]}
    />
  );
}
