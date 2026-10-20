"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";

import type { RequestFilters } from "../requests.query";

const EXPORT_ROW_LIMIT = 10_000;

export function ExportRequestsButton({ filters, total }: { filters: RequestFilters; total: number }) {
  const query = new URLSearchParams();
  for (const key of ["q", "status", "typeId"] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  const tooMany = total > EXPORT_ROW_LIMIT;
  return (
    <Tooltip title={tooMany ? `Tối đa ${EXPORT_ROW_LIMIT.toLocaleString("vi-VN")} đơn mỗi lần xuất, hãy lọc hẹp hơn` : undefined}>
      <Button icon={<DownloadOutlined />} href={`/api/exports/requests?${query}`} disabled={total === 0 || tooMany}>
        Xuất CSV
      </Button>
    </Tooltip>
  );
}
