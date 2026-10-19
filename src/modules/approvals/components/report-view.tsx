"use client";

import { Card, Empty, Progress, Statistic, Table } from "antd";

import { REQUEST_STATUS_META, type RequestStatus } from "@/modules/requests/requests.constant";
import { PageHeader } from "@/shared/components/ui/page-header";

import type { ReportData } from "../approvals.query";

const STATUSES: RequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export function ReportView({ data }: { data: ReportData }) {
  const slaRate = data.sla.decided ? Math.round((data.sla.onTime / data.sla.decided) * 100) : null;

  const byType = Object.values(
    data.byType.reduce<Record<string, { typeName: string; total: number } & Partial<Record<RequestStatus, number>>>>(
      (acc, row) => {
        const entry = (acc[row.typeName] ??= { typeName: row.typeName, total: 0 });
        entry[row.status as RequestStatus] = row.total;
        entry.total += row.total;
        return acc;
      },
      {},
    ),
  );

  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Số liệu tính trên toàn bộ đơn đã gửi" />
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card size="small">
            <Statistic title="Lượt duyệt đã xử lý" value={data.sla.decided} />
          </Card>
          <Card size="small">
            <Statistic title="Xử lý đúng hạn" value={data.sla.onTime} />
          </Card>
          <Card size="small">
            <div className="mb-1 text-sm text-black/45">Tỷ lệ đúng SLA</div>
            {slaRate === null ? <span className="text-2xl">—</span> : <Progress percent={slaRate} />}
          </Card>
        </div>

        <Card title="Theo loại đơn và trạng thái">
          {byType.length === 0 ? (
            <Empty />
          ) : (
            <Table
              rowKey="typeName"
              size="small"
              pagination={false}
              dataSource={byType}
              scroll={{ x: 640 }}
              columns={[
                { title: "Loại đơn", dataIndex: "typeName" },
                ...STATUSES.map((s) => ({
                  title: REQUEST_STATUS_META[s].label,
                  dataIndex: s,
                  width: 110,
                  align: "right" as const,
                  render: (v?: number) => v ?? 0,
                })),
                { title: "Tổng", dataIndex: "total", width: 90, align: "right" as const },
              ]}
            />
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="6 tháng gần nhất">
            {data.monthly.length === 0 ? (
              <Empty />
            ) : (
              <Table
                rowKey="month"
                size="small"
                pagination={false}
                dataSource={data.monthly}
                columns={[
                  { title: "Tháng", dataIndex: "month" },
                  { title: "Đơn gửi", dataIndex: "total", align: "right" },
                  { title: "Đã duyệt", dataIndex: "approved", align: "right" },
                  { title: "Từ chối", dataIndex: "rejected", align: "right" },
                ]}
              />
            )}
          </Card>

          <Card title="Thời gian xử lý theo bước">
            {data.stepDurations.length === 0 ? (
              <Empty />
            ) : (
              <Table
                rowKey="stepName"
                size="small"
                pagination={false}
                dataSource={data.stepDurations}
                columns={[
                  { title: "Bước", dataIndex: "stepName" },
                  { title: "Đã xử lý", dataIndex: "decided", align: "right" },
                  { title: "TB (giờ)", dataIndex: "avgHours", align: "right" },
                  {
                    title: "Đúng hạn",
                    align: "right",
                    render: (_, row) => `${Math.round((row.onTime / row.decided) * 100)}%`,
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
