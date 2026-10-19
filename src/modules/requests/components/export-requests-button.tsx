"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";

import type { RequestFilters } from "../requests.query";

export function ExportRequestsButton({ filters, disabled }: { filters: RequestFilters; disabled?: boolean }) {
  const query = new URLSearchParams();
  for (const key of ["q", "status", "typeId"] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  return (
    <Button icon={<DownloadOutlined />} href={`/api/exports/requests?${query}`} disabled={disabled}>
      Xuất CSV
    </Button>
  );
}
