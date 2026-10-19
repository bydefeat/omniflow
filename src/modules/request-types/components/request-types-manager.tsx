"use client";

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Modal, Switch, Table, Tag } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/shared/components/ui/page-header";

import { createRequestType, setRequestTypeActive } from "../request-types.action";
import type { RequestTypeRow } from "../request-types.query";
import type { RequestTypeFormValues } from "../request-types.validation";
import { RequestTypeFields } from "./request-type-fields";

export function RequestTypesManager({ types }: { types: RequestTypeRow[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<RequestTypeFormValues>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function create() {
    const values = await form.validateFields();
    setSaving(true);
    const [created, error] = await createRequestType(values);
    setSaving(false);
    if (error) return message.error(error.message);
    message.success("Đã tạo loại đơn. Tiếp tục cấu hình biểu mẫu và bước duyệt.");
    router.push(`/administrator/request-types/${created.id}/form`);
  }

  async function toggle(row: RequestTypeRow, isActive: boolean) {
    const [, error] = await setRequestTypeActive({ id: row.id, isActive });
    if (error) return message.error(error.message);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Loại đơn & bước duyệt"
        subtitle="Cấu hình biểu mẫu và quy trình phê duyệt cho từng loại đề xuất"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ slaHours: 24, hasLineItems: false });
              setOpen(true);
            }}
          >
            Thêm loại đơn
          </Button>
        }
      />

      <Table
        rowKey="id"
        size="small"
        dataSource={types}
        pagination={false}
        scroll={{ x: 800 }}
        columns={[
          { title: "Mã", dataIndex: "code", width: 140 },
          {
            title: "Tên loại đơn",
            dataIndex: "name",
            render: (name, row) => (
              <Link href={`/administrator/request-types/${row.id}`} className="font-medium">
                {name}
              </Link>
            ),
          },
          { title: "SLA", dataIndex: "slaHours", width: 90, render: (v) => `${v} giờ` },
          {
            title: "Hạng mục",
            dataIndex: "hasLineItems",
            width: 100,
            render: (v) => (v ? <Tag color="blue">Có</Tag> : "—"),
          },
          { title: "Số trường", dataIndex: "fieldCount", width: 100, align: "right" },
          {
            title: "Số bước duyệt",
            dataIndex: "stepCount",
            width: 120,
            align: "right",
            render: (v) => (v > 0 ? v : <Tag color="warning">Chưa có</Tag>),
          },
          {
            title: "Đang dùng",
            dataIndex: "isActive",
            width: 100,
            render: (v, row) => <Switch size="small" checked={v} onChange={(c) => toggle(row, c)} />,
          },
        ]}
      />

      <Modal
        title="Thêm loại đơn"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={create}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
        width={640}
      >
        <Form form={form} layout="vertical" requiredMark={false} className="!mt-4">
          <RequestTypeFields />
        </Form>
      </Modal>
    </>
  );
}
