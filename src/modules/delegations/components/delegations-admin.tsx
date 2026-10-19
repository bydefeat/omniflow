"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Table, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserOption } from "@/modules/users/users.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { formatDateTime } from "@/shared/libs/format.lib";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { adminCancelDelegation, adminCreateDelegation } from "../delegations.action";
import { DELEGATION_STATUS_META, DELEGATION_STATUSES } from "../delegations.constant";
import type { AdminDelegationRow, DelegationFilters } from "../delegations.query";

type Values = { delegatorId: string; delegateId: string; range: [Dayjs, Dayjs]; reason: string };

type Props = {
  rows: AdminDelegationRow[];
  total: number;
  filters: DelegationFilters;
  users: UserOption[];
};

export function DelegationsAdmin({ rows, total, filters, users }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const { update, pending } = useListFilters(filters);
  const [form] = Form.useForm<Values>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const delegatorId = Form.useWatch("delegatorId", form);
  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} (${u.employeeCode})` }));

  async function create() {
    const values = await form.validateFields();
    setSaving(true);
    const [, error] = await adminCreateDelegation({
      delegatorId: values.delegatorId,
      delegateId: values.delegateId,
      startsAt: values.range[0].toISOString(),
      endsAt: values.range[1].toISOString(),
      reason: values.reason,
    });
    setSaving(false);
    if (error) return message.error(error.message);
    message.success("Đã tạo ủy quyền");
    setOpen(false);
    form.resetFields();
    router.refresh();
  }

  async function cancel(id: string) {
    const [, error] = await adminCancelDelegation({ id });
    if (error) return message.error(error.message);
    message.success("Đã hủy ủy quyền");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Ủy quyền phê duyệt"
        subtitle="Tạo ủy quyền thay người duyệt vắng mặt đột xuất; mọi thao tác được ghi vào nhật ký quản trị"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Tạo ủy quyền
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input.Search
          allowClear
          placeholder="Tìm theo người ủy quyền, người được ủy quyền, lý do"
          className="!w-full sm:!w-80"
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          className="w-full sm:w-44"
          value={filters.status}
          onChange={(status) => update({ status })}
          options={DELEGATION_STATUSES.map((s) => ({ value: s, label: DELEGATION_STATUS_META[s].label }))}
        />
      </div>

      <Table
        rowKey="id"
        size="small"
        dataSource={rows}
        loading={pending}
        scroll={{ x: 960 }}
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
            title: "Người ủy quyền",
            width: 200,
            render: (_, row) => `${row.delegatorName} (${row.delegatorCode})`,
          },
          {
            title: "Người được ủy quyền",
            width: 200,
            render: (_, row) => `${row.delegateName} (${row.delegateCode})`,
          },
          {
            title: "Thời gian",
            width: 280,
            render: (_, row) => `${formatDateTime(row.startsAt)} → ${formatDateTime(row.endsAt)}`,
          },
          { title: "Lý do", dataIndex: "reason" },
          {
            title: "Trạng thái",
            dataIndex: "displayStatus",
            width: 130,
            render: (s: AdminDelegationRow["displayStatus"]) => (
              <Tag color={DELEGATION_STATUS_META[s].color}>{DELEGATION_STATUS_META[s].label}</Tag>
            ),
          },
          {
            key: "actions",
            width: 80,
            render: (_, row) =>
              (row.displayStatus === "ACTIVE" || row.displayStatus === "UPCOMING") && (
                <Popconfirm title="Hủy ủy quyền này?" okText="Hủy ủy quyền" cancelText="Không" onConfirm={() => cancel(row.id)}>
                  <Button type="link" danger size="small">
                    Hủy
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />

      <Modal
        title="Tạo ủy quyền thay người duyệt"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={create}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
      >
        <Form<Values> form={form} layout="vertical" requiredMark={false} className="!mt-4">
          <Form.Item
            name="delegatorId"
            label="Người ủy quyền (người vắng mặt)"
            rules={[{ required: true, message: "Vui lòng chọn người ủy quyền" }]}
          >
            <Select showSearch={{ optionFilterProp: "label" }} options={userOptions} />
          </Form.Item>
          <Form.Item
            name="delegateId"
            label="Người được ủy quyền (duyệt thay)"
            dependencies={["delegatorId"]}
            rules={[{ required: true, message: "Vui lòng chọn người được ủy quyền" }]}
          >
            <Select
              showSearch={{ optionFilterProp: "label" }}
              options={userOptions.filter((u) => u.value !== delegatorId)}
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
          <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập lý do" }]}>
            <Input maxLength={255} placeholder="Trưởng phòng nghỉ ốm đột xuất..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
