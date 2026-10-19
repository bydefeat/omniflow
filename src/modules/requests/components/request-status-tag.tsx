"use client";

import { Tag } from "antd";

import { REQUEST_STATUS_META, type RequestStatus } from "../requests.constant";

export function RequestStatusTag({ status }: { status: RequestStatus }) {
  const meta = REQUEST_STATUS_META[status];
  return (
    <Tag color={meta.color} className={status === "CANCELLED" ? "line-through" : undefined}>
      {meta.label}
    </Tag>
  );
}
