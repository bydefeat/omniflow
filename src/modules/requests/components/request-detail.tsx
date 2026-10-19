"use client";

import { Card, Collapse, Descriptions, Table } from "antd";

import { formatDateTime, formatMoney, formatNumber } from "@/shared/libs/format.lib";

import type { RequestDetail as RequestDetailData } from "../requests.query";
import type { RevisionItem } from "../requests.schema";
import { formatFieldValue } from "../requests.service";
import { AttachmentsPanel } from "./attachments-panel";
import { RequestStatusTag } from "./request-status-tag";

function ItemsTable({ items, totalAmount }: { items: (RevisionItem & { id?: string })[]; totalAmount: string | null }) {
  return (
    <Table
      rowKey={(row) => row.id ?? `${row.name}-${row.unit}-${row.quantity}-${row.unitPrice}`}
      size="small"
      pagination={false}
      dataSource={items}
      scroll={{ x: 640 }}
      columns={[
        { title: "#", width: 48, render: (_, __, index) => index + 1 },
        { title: "Tên hàng hóa / chi phí", dataIndex: "name" },
        { title: "ĐVT", dataIndex: "unit", width: 80 },
        { title: "Số lượng", dataIndex: "quantity", width: 100, align: "right", render: formatNumber },
        { title: "Đơn giá", dataIndex: "unitPrice", width: 140, align: "right", render: formatMoney },
        { title: "Thành tiền", dataIndex: "amount", width: 150, align: "right", render: formatMoney },
      ]}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={5} align="right">
            <span className="font-medium">Tổng cộng</span>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <span className="font-semibold">{formatMoney(totalAmount)}</span>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
}

export function RequestDetail({ request }: { request: RequestDetailData }) {
  return (
    <div className="space-y-6">
      <Card>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Mã đơn">{request.code ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <RequestStatusTag status={request.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Loại đơn">{request.typeName}</Descriptions.Item>
          <Descriptions.Item label="Người đề xuất">
            {request.requesterName} ({request.requesterCode})
          </Descriptions.Item>
          <Descriptions.Item label="Phòng ban">{request.departmentName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Ngày gửi">{formatDateTime(request.submittedAt)}</Descriptions.Item>
          {request.hasLineItems && (
            <Descriptions.Item label="Tổng tiền">
              <span className="font-semibold">{formatMoney(request.totalAmount)}</span>
            </Descriptions.Item>
          )}
          {request.completedAt && (
            <Descriptions.Item label="Hoàn tất">{formatDateTime(request.completedAt)}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title={request.title}>
        <p className="!mb-0 whitespace-pre-line">{request.reason}</p>
        {request.formSchema.length > 0 && (
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" className="!mt-6" bordered>
            {request.formSchema.map((field) => (
              <Descriptions.Item key={field.key} label={field.label}>
                {formatFieldValue(field, request.formData[field.key])}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Card>

      {request.hasLineItems && (
        <Card title="Hạng mục chi tiết">
          <ItemsTable items={request.items} totalAmount={request.totalAmount} />
        </Card>
      )}

      <Card title="Tệp đính kèm">
        <AttachmentsPanel attachments={request.attachments} />
      </Card>

      {request.revisions.length > 0 && (
        <Card title="Các phiên bản trước khi bổ sung">
          <Collapse
            items={request.revisions.map((revision) => ({
              key: revision.id,
              label: `Lần gửi ${revision.revision} · trả về lúc ${formatDateTime(revision.createdAt)}`,
              children: (
                <div className="space-y-4">
                  <div>
                    <div className="font-medium">{revision.title}</div>
                    <p className="!mb-0 whitespace-pre-line">{revision.reason}</p>
                  </div>
                  {request.formSchema.length > 0 && (
                    <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                      {request.formSchema.map((field) => (
                        <Descriptions.Item key={field.key} label={field.label}>
                          {formatFieldValue(field, revision.formData[field.key])}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  )}
                  {request.hasLineItems && <ItemsTable items={revision.items} totalAmount={revision.totalAmount} />}
                  <AttachmentsPanel attachments={revision.attachments} />
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
