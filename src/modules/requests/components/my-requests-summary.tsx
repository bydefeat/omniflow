"use client";

import { Card, Empty, Statistic } from "antd";
import Link from "next/link";

import { formatDateTime } from "@/shared/libs/format.lib";

import { REQUEST_STATUS_META, type RequestStatus } from "../requests.constant";
import type { MyRequestRow } from "../requests.query";
import { RequestStatusTag } from "./request-status-tag";

const SHOWN: RequestStatus[] = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];

export function MyRequestsSummary({
  counts,
  recent,
}: {
  counts: Partial<Record<RequestStatus, number>>;
  recent: MyRequestRow[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SHOWN.map((status) => (
          <Link key={status} href="/workspace/requests">
            <Card hoverable size="small">
              <Statistic title={REQUEST_STATUS_META[status].label} value={counts[status] ?? 0} />
            </Card>
          </Link>
        ))}
      </div>

      <Card title="Đơn gần đây" extra={<Link href="/workspace/requests">Xem tất cả</Link>}>
        {recent.length === 0 ? (
          <Empty description="Bạn chưa có đề xuất nào">
            <Link href="/workspace/requests/new">Tạo đề xuất đầu tiên</Link>
          </Empty>
        ) : (
          <ul className="m-0 list-none divide-y divide-black/5 p-0">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.status === "DRAFT" ? `/workspace/requests/${r.id}/edit` : `/workspace/requests/${r.id}`}
                  className="flex items-center gap-3 py-3 !text-inherit"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="text-xs text-black/45">
                      {r.code ?? "Nháp"} · {r.typeName} · {formatDateTime(r.updatedAt)}
                    </span>
                  </span>
                  <RequestStatusTag status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
