"use client";

import { Input, Select, Table, Tag, Typography } from "antd";

import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { formatDateTime } from "@/shared/libs/format.lib";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { AUDIT_ACTION_LABELS, type AuditAction } from "../audit.constant";
import type { AuditFilters, AuditLogRow } from "../audit.query";

type Props = { rows: AuditLogRow[]; total: number; filters: AuditFilters };

function describeChanges(changes: unknown) {
  if (!changes || typeof changes !== "object") return null;
  return JSON.stringify(changes, null, 2);
}

export function AuditLogTable({ rows, total, filters }: Props) {
  const { update, pending } = useListFilters(filters);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input.Search
          allowClear
          placeholder="Tìm theo người thực hiện hoặc nội dung"
          className="!w-full sm:!w-80"
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
        />
        <Select
          allowClear
          placeholder="Thao tác"
          className="w-full sm:w-64"
          value={filters.action}
          onChange={(action) => update({ action })}
          options={Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <Table
        rowKey="id"
        size="small"
        dataSource={rows}
        loading={pending}
        scroll={{ x: 900 }}
        pagination={{
          current: filters.page,
          pageSize: PAGE_SIZE,
          total,
          hideOnSinglePage: true,
          showSizeChanger: false,
          onChange: (page) => update({ page }),
        }}
        expandable={{
          rowExpandable: (row) => describeChanges(row.changes) !== null,
          expandedRowRender: (row) => (
            <pre className="m-0 max-h-80 overflow-auto text-xs whitespace-pre-wrap">{describeChanges(row.changes)}</pre>
          ),
        }}
        columns={[
          {
            title: "Thời điểm",
            dataIndex: "createdAt",
            width: 150,
            render: (v: Date) => formatDateTime(v),
          },
          { title: "Người thực hiện", dataIndex: "actorName", width: 240 },
          {
            title: "Thao tác",
            dataIndex: "action",
            width: 190,
            render: (a: string) => <Tag>{AUDIT_ACTION_LABELS[a as AuditAction] ?? a}</Tag>,
          },
          {
            title: "Nội dung",
            dataIndex: "summary",
            render: (s: string) => <Typography.Text>{s}</Typography.Text>,
          },
          { title: "IP", dataIndex: "ipAddress", width: 130, render: (ip: string | null) => ip ?? "—" },
        ]}
      />
    </>
  );
}
