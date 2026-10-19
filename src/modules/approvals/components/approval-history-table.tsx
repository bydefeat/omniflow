"use client";

import { Empty, Input, Select, Table, Tag } from "antd";
import Link from "next/link";

import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { formatDateTime } from "@/shared/libs/format.lib";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { APPROVAL_RESULT_META, HISTORY_RESULTS } from "../approvals.constant";
import type { ApprovalHistoryRow, HistoryFilters } from "../approvals.query";

type Props = { rows: ApprovalHistoryRow[]; total: number; filters: HistoryFilters };

export function ApprovalHistoryTable({ rows, total, filters }: Props) {
  const { update, pending } = useListFilters(filters);
  const filtered = Boolean(filters.q || filters.result);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input.Search
          allowClear
          placeholder="Tìm theo mã, tiêu đề, người đề xuất"
          className="!w-full sm:!w-72"
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
        />
        <Select
          allowClear
          placeholder="Kết quả"
          className="w-full sm:w-48"
          value={filters.result}
          onChange={(result) => update({ result })}
          options={HISTORY_RESULTS.map((r) => ({ value: r, label: APPROVAL_RESULT_META[r].label }))}
        />
      </div>
      {rows.length === 0 && !pending ? (
        <Empty
          className="!py-12"
          description={filtered ? "Không có lượt duyệt khớp bộ lọc" : "Bạn chưa xử lý lượt duyệt nào"}
        />
      ) : (
        <HistoryTable rows={rows} total={total} filters={filters} pending={pending} onPage={(page) => update({ page })} />
      )}
    </>
  );
}

function HistoryTable({
  rows,
  total,
  filters,
  pending,
  onPage,
}: Props & { pending: boolean; onPage: (page: number) => void }) {
  return (
    <Table
      rowKey="approvalId"
      size="small"
      dataSource={rows}
      loading={pending}
      scroll={{ x: 960 }}
      pagination={{
        current: filters.page,
        pageSize: PAGE_SIZE,
        total,
        hideOnSinglePage: true,
        showSizeChanger: false,
        onChange: onPage,
      }}
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
              {row.actedByDelegate ? (
                <div className="text-xs text-black/45">{row.actedByName} duyệt thay bạn</div>
              ) : (
                row.onBehalfOfName && <div className="text-xs text-black/45">Thay {row.onBehalfOfName}</div>
              )}
            </div>
          ),
        },
        { title: "Ý kiến", dataIndex: "comment", width: 240, render: (v) => v ?? "—" },
        { title: "Thời điểm", dataIndex: "decidedAt", width: 150, render: (v) => formatDateTime(v) },
      ]}
    />
  );
}
