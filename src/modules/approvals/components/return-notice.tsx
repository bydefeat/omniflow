"use client";

import { Alert } from "antd";

import { formatDateTime } from "@/shared/libs/format.lib";

import type { getLatestReturn } from "../approvals.query";

type Props = { info: NonNullable<Awaited<ReturnType<typeof getLatestReturn>>>; extra?: React.ReactNode };

export function ReturnNotice({ info, extra }: Props) {
  return (
    <Alert
      type="warning"
      showIcon
      className="!mb-6"
      title={`Cần bổ sung ở bước "${info.stepName}"`}
      description={
        <div className="space-y-2">
          <div className="whitespace-pre-line">{info.comment}</div>
          <div className="text-xs text-black/45">
            {info.actedByName} · {formatDateTime(info.decidedAt)}
          </div>
          {extra}
        </div>
      }
    />
  );
}
