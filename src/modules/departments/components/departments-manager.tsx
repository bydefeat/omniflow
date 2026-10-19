"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Table } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/shared/components/ui/page-header";

import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "../departments.action";
import type { DepartmentRow } from "../departments.query";
import type { DepartmentFormValues } from "../departments.validation";

export function DepartmentsManager({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<DepartmentFormValues>();
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openForm(row: DepartmentRow | null) {
    setEditing(row);
    form.setFieldsValue(row ?? { code: "", name: "", phone: "" });
    setOpen(true);
  }

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    const [, error] = editing
      ? await updateDepartment({ ...values, id: editing.id })
      : await createDepartment(values);
    setSaving(false);
    if (error) return message.error(error.message);
    message.success(editing ? "Đã cập nhật phòng ban" : "Đã thêm phòng ban");
    setOpen(false);
    router.refresh();
  }

  async function remove(row: DepartmentRow) {
    const [, error] = await deleteDepartment({ id: row.id });
    if (error) return message.error(error.message);
    message.success("Đã xóa phòng ban");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Phòng ban"
        subtitle={`${departments.length} phòng ban`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
            Thêm phòng ban
          </Button>
        }
      />

      <Table
        rowKey="id"
        size="small"
        dataSource={departments}
        pagination={false}
        scroll={{ x: 640 }}
        columns={[
          { title: "Mã", dataIndex: "code", width: 140 },
          { title: "Tên phòng ban", dataIndex: "name" },
          { title: "Số nội bộ", dataIndex: "phone", width: 140, render: (v) => v ?? "—" },
          { title: "Số người", dataIndex: "userCount", width: 100, align: "right" },
          {
            key: "actions",
            width: 100,
            align: "right",
            render: (_, row) => (
              <Space size={4}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label="Sửa"
                  onClick={() => openForm(row)}
                />
                <Popconfirm
                  title="Xóa phòng ban này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(row)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Xóa"
                    disabled={row.userCount > 0}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Sửa phòng ban" : "Thêm phòng ban"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false} className="!mt-4">
          <Form.Item
            name="code"
            label="Mã phòng ban"
            rules={[{ required: true, message: "Vui lòng nhập mã" }]}
            normalize={(v: string) => v.toUpperCase()}
          >
            <Input placeholder="PB_IT" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên phòng ban"
            rules={[{ required: true, message: "Vui lòng nhập tên" }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="phone" label="Số máy nội bộ">
            <Input maxLength={15} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
