"use client";

import { App, Button, Card, DatePicker, Form, Input, Popconfirm, Select, Table, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserOption } from "@/modules/users/users.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { formatDateTime } from "@/shared/libs/format.lib";

import { cancelDelegation, createDelegation } from "../delegations.action";
import { DELEGATION_STATUS_META } from "../delegations.constant";
import type { DelegationRow } from "../delegations.query";

const STATUS_META = DELEGATION_STATUS_META;

type Values = { delegateId: string; range: [Dayjs, Dayjs]; reason: string };

type Props = {
  given: DelegationRow[];
  received: DelegationRow[];
  candidates: UserOption[];
  canCreate: boolean;
};

export function DelegationsManager({ given, received, candidates, canCreate }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);

  async function create(values: Values) {
    setSaving(true);
    const [, error] = await createDelegation({
      delegateId: values.delegateId,
      startsAt: values.range[0].toISOString(),
      endsAt: values.range[1].toISOString(),
      reason: values.reason,
    });
    setSaving(false);
    if (error) return message.error(error.message);
    message.success("Đã tạo ủy quyền");
    form.resetFields();
    router.refresh();
  }

  async function cancel(id: string) {
    const [, error] = await cancelDelegation({ id });
    if (error) return message.error(error.message);
    message.success("Đã hủy ủy quyền");
    router.refresh();
  }

  const columns = (withCancel: boolean) => [
    { title: withCancel ? "Người được ủy quyền" : "Người ủy quyền", dataIndex: "otherName", render: (name: string, row: DelegationRow) => `${name} (${row.otherCode})` },
    {
      title: "Thời gian",
      width: 280,
      render: (_: unknown, row: DelegationRow) => `${formatDateTime(row.startsAt)} → ${formatDateTime(row.endsAt)}`,
    },
    { title: "Lý do", dataIndex: "reason" },
    {
      title: "Trạng thái",
      dataIndex: "displayStatus",
      width: 130,
      render: (s: DelegationRow["displayStatus"]) => <Tag color={STATUS_META[s].color}>{STATUS_META[s].label}</Tag>,
    },
    ...(withCancel
      ? [
          {
            key: "actions",
            width: 90,
            render: (_: unknown, row: DelegationRow) =>
              (row.displayStatus === "ACTIVE" || row.displayStatus === "UPCOMING") && (
                <Popconfirm title="Hủy ủy quyền này?" okText="Hủy ủy quyền" cancelText="Không" onConfirm={() => cancel(row.id)}>
                  <Button type="link" danger size="small">
                    Hủy
                  </Button>
                </Popconfirm>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Ủy quyền phê duyệt"
        subtitle="Khi đi công tác hoặc nghỉ phép, người được ủy quyền sẽ duyệt thay bạn trong khoảng thời gian đã chọn"
      />

      <div className="space-y-6">
        {canCreate && (
          <Card title="Tạo ủy quyền mới">
            <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={create}>
              <div className="grid gap-x-4 md:grid-cols-2">
                <Form.Item name="delegateId" label="Người được ủy quyền" rules={[{ required: true, message: "Vui lòng chọn người" }]}>
                  <Select
                    showSearch={{ optionFilterProp: "label" }}
                    options={candidates.map((u) => ({ value: u.id, label: `${u.name} (${u.employeeCode})` }))}
                  />
                </Form.Item>
                <Form.Item name="range" label="Thời gian hiệu lực" rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}>
                  <DatePicker.RangePicker
                    showTime={{ format: "HH:mm" }}
                    format="DD/MM/YYYY HH:mm"
                    className="w-full"
                    disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
                  />
                </Form.Item>
              </div>
              <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập lý do" }]}>
                <Input maxLength={255} placeholder="Đi công tác nước ngoài, nghỉ phép..." />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                Tạo ủy quyền
              </Button>
            </Form>
          </Card>
        )}

        {(canCreate || given.length > 0) && (
          <Card title="Tôi đã ủy quyền">
            <Table rowKey="id" size="small" dataSource={given} columns={columns(true)} pagination={false} scroll={{ x: 800 }} />
          </Card>
        )}

        <Card title="Tôi được ủy quyền">
          <Table rowKey="id" size="small" dataSource={received} columns={columns(false)} pagination={false} scroll={{ x: 800 }} />
        </Card>
      </div>
    </>
  );
}
