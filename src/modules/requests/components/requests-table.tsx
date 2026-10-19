"use client";

import { Input, Select, Table } from "antd";
import Link from "next/link";

import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { formatDateTime, formatMoney } from "@/shared/libs/format.lib";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { REQUEST_STATUS_META, type RequestStatus } from "../requests.constant";
import type { RequestFilters } from "../requests.query";
import { RequestStatusTag } from "./request-status-tag";

export type RequestListRow = {
  id: string;
  code: string | null;
  title: string;
  status: RequestStatus;
  typeName: string;
  totalAmount: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
  requesterName?: string;
  departmentName?: string | null;
};

type Props = {
  rows: RequestListRow[];
  total: number;
  filters: RequestFilters;
  types: { id: string; name: string }[];
  basePath: string;
  editDrafts?: boolean;
  showRequester?: boolean;
  statuses?: RequestStatus[];
};

export function RequestsTable({
  rows,
  total,
  filters,
  types,
  basePath,
  editDrafts = false,
  showRequester = false,
  statuses,
}: Props) {
  const hrefOf = (row: RequestListRow) =>
    editDrafts && row.status === "DRAFT" ? `${basePath}/${row.id}/edit` : `${basePath}/${row.id}`;
  const { update, pending } = useListFilters(filters);

  const statusOptions = (statuses ?? (Object.keys(REQUEST_STATUS_META) as RequestStatus[])).map((s) => ({
    value: s,
    label: REQUEST_STATUS_META[s].label,
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input.Search
          allowClear
          placeholder={showRequester ? "Tìm theo mã, tiêu đề, người đề xuất" : "Tìm theo mã hoặc tiêu đề"}
          className="!w-full sm:!w-72"
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          className="w-full sm:w-44"
          value={filters.status}
          onChange={(status) => update({ status })}
          options={statusOptions}
        />
        <Select
          allowClear
          placeholder="Loại đơn"
          className="w-full sm:w-56"
          value={filters.typeId}
          onChange={(typeId) => update({ typeId })}
          options={types.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>

      <Table
        rowKey="id"
        size="small"
        dataSource={rows}
        loading={pending}
        scroll={{ x: showRequester ? 1000 : 800 }}
        pagination={{
          current: filters.page,
          pageSize: PAGE_SIZE,
          total,
          hideOnSinglePage: true,
          showSizeChanger: false,
          onChange: (page) => update({ page }),
        }}
        columns={[
          {
            title: "Mã đơn",
            dataIndex: "code",
            width: 140,
            render: (code, row) => <Link href={hrefOf(row)}>{code ?? "Nháp"}</Link>,
          },
          {
            title: "Tiêu đề",
            dataIndex: "title",
            render: (title, row) => (
              <Link href={hrefOf(row)} className="font-medium">
                {title}
              </Link>
            ),
          },
          ...(showRequester
            ? [
                {
                  title: "Người đề xuất",
                  dataIndex: "requesterName",
                  width: 180,
                  render: (name: string, row: RequestListRow) => (
                    <div>
                      <div>{name}</div>
                      <div className="text-xs text-black/45">{row.departmentName}</div>
                    </div>
                  ),
                },
              ]
            : []),
          { title: "Loại đơn", dataIndex: "typeName", width: 180 },
          {
            title: "Tổng tiền",
            dataIndex: "totalAmount",
            width: 140,
            align: "right" as const,
            render: (v: string | null) => (v == null ? "—" : formatMoney(v)),
          },
          {
            title: "Trạng thái",
            dataIndex: "status",
            width: 110,
            render: (s: RequestStatus) => <RequestStatusTag status={s} />,
          },
          {
            title: showRequester ? "Ngày gửi" : "Cập nhật",
            width: 140,
            render: (_: unknown, row: RequestListRow) => formatDateTime(showRequester ? row.submittedAt : row.updatedAt),
          },
        ]}
      />
    </>
  );
}
