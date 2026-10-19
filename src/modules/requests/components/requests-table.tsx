"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Table } from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatDateTime, formatMoney } from "@/shared/libs/format.lib";

import { REQUEST_STATUS_META, type RequestStatus } from "../requests.constant";
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
  basePath: string;
  editDrafts?: boolean;
  showRequester?: boolean;
  statuses?: RequestStatus[];
};

export function RequestsTable({ rows, basePath, editDrafts = false, showRequester = false, statuses }: Props) {
  const hrefOf = (row: RequestListRow) =>
    editDrafts && row.status === "DRAFT" ? `${basePath}/${row.id}/edit` : `${basePath}/${row.id}`;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RequestStatus>();
  const [typeName, setTypeName] = useState<string>();

  const typeNames = useMemo(() => [...new Set(rows.map((r) => r.typeName))], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q ||
          r.title.toLowerCase().includes(q) ||
          (r.code ?? "").toLowerCase().includes(q) ||
          (r.requesterName ?? "").toLowerCase().includes(q)) &&
        (!status || r.status === status) &&
        (!typeName || r.typeName === typeName),
    );
  }, [rows, search, status, typeName]);

  const statusOptions = (statuses ?? (Object.keys(REQUEST_STATUS_META) as RequestStatus[])).map((s) => ({
    value: s,
    label: REQUEST_STATUS_META[s].label,
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={showRequester ? "Tìm theo mã, tiêu đề, người đề xuất" : "Tìm theo mã hoặc tiêu đề"}
          className="!w-full sm:!w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select allowClear placeholder="Trạng thái" className="w-full sm:w-44" value={status} onChange={setStatus} options={statusOptions} />
        <Select
          allowClear
          placeholder="Loại đơn"
          className="w-full sm:w-56"
          value={typeName}
          onChange={setTypeName}
          options={typeNames.map((t) => ({ value: t, label: t }))}
        />
      </div>

      <Table
        rowKey="id"
        size="small"
        dataSource={filtered}
        scroll={{ x: showRequester ? 1000 : 800 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
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
