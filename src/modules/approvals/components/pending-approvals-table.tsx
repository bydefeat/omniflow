"use client";

import { Card, Checkbox, Empty, Input, Pagination, Select, Table, Tag } from "antd";
import Link from "next/link";

import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { formatDateTime, formatMoney } from "@/shared/libs/format.lib";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { PENDING_SCOPE_OPTIONS } from "../approvals.constant";
import type { PendingApprovalRow, PendingFilters } from "../approvals.query";

type Props = {
  rows: PendingApprovalRow[];
  total: number;
  hasDelegators: boolean;
  filters: PendingFilters;
  types: { id: string; name: string }[];
};

export function PendingApprovalsTable({ rows, total, hasDelegators, filters, types }: Props) {
  const { update, pending } = useListFilters(filters);
  const filtered = Boolean(filters.q || filters.typeId || filters.scope || filters.overdue);
  const pagination = {
    current: filters.page,
    pageSize: PAGE_SIZE,
    total,
    hideOnSinglePage: true,
    showSizeChanger: false,
    onChange: (page: number) => update({ page }),
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input.Search
          allowClear
          placeholder="Tìm theo mã, tiêu đề, người đề xuất"
          className="!w-full sm:!w-72"
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
        />
        <Select
          allowClear
          placeholder="Loại đơn"
          className="w-full sm:w-56"
          value={filters.typeId}
          onChange={(typeId) => update({ typeId })}
          options={types.map((t) => ({ value: t.id, label: t.name }))}
        />
        {(hasDelegators || filters.scope) && (
          <Select
            allowClear
            placeholder="Nguồn giao duyệt"
            className="w-full sm:w-56"
            value={filters.scope}
            onChange={(scope) => update({ scope })}
            options={[...PENDING_SCOPE_OPTIONS]}
          />
        )}
        <Checkbox checked={!!filters.overdue} onChange={(e) => update({ overdue: e.target.checked ? "1" : undefined })}>
          Chỉ đơn quá hạn
        </Checkbox>
      </div>

      {total === 0 && !pending ? (
        <Empty
          className="!py-12"
          description={filtered ? "Không có đơn chờ duyệt khớp bộ lọc" : "Không có đơn nào đang chờ bạn duyệt"}
        />
      ) : (
        <PendingApprovalsList rows={rows} pending={pending} pagination={pagination} />
      )}
    </>
  );
}

function PendingApprovalsList({
  rows,
  pending,
  pagination,
}: {
  rows: PendingApprovalRow[];
  pending: boolean;
  pagination: { current: number; pageSize: number; total: number; hideOnSinglePage: boolean; onChange: (page: number) => void };
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Link key={row.approvalId} href={`/workspace/approvals/${row.requestId}`} className="block">
            <Card size="small" hoverable className={row.overdue ? "!border-red-300 !bg-red-50" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.title}</div>
                  <div className="text-xs text-black/45">
                    {row.code} · {row.typeName}
                  </div>
                </div>
                {row.totalAmount != null && (
                  <div className="shrink-0 font-medium whitespace-nowrap">{formatMoney(row.totalAmount)}</div>
                )}
              </div>
              <div className="mt-2 text-sm text-black/65">
                {row.requesterName}
                {row.departmentName && ` · ${row.departmentName}`}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/45">
                <span>{row.stepName}</span>
                <span>· Hạn {formatDateTime(row.dueAt)}</span>
                {row.overdue && <Tag color="error">Quá hạn</Tag>}
                {row.onBehalfOfName && <Tag color="purple">Thay {row.onBehalfOfName}</Tag>}
              </div>
            </Card>
          </Link>
        ))}
        <Pagination {...pagination} align="center" size="small" />
      </div>
      <div className="hidden md:block">
        <Table
          rowKey="approvalId"
          size="small"
          dataSource={rows}
          loading={pending}
          scroll={{ x: 960 }}
          pagination={{ ...pagination, showSizeChanger: false }}
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
      </div>
    </>
  );
}
