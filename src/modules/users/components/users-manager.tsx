"use client";

import {
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { DepartmentOption } from "@/modules/departments/departments.query";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLES,
} from "@/shared/constants/role.constant";
import { parseRoles } from "@/shared/libs/role.lib";

import { createUser, setUserBanned, setUserPassword, updateUser } from "../users.action";
import type { UserRow } from "../users.query";
import type { UserCreateValues } from "../users.validation";
import { RoleTags } from "./role-tags";

type Props = {
  users: UserRow[];
  departments: DepartmentOption[];
  currentUserId: string;
};

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value,
}));

export function UsersManager({ users, departments, currentUserId }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<UserCreateValues>();
  const [passwordForm] = Form.useForm<{ newPassword: string }>();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>();
  const [role, setRole] = useState<string>();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.employeeCode.toLowerCase().includes(q)) &&
        (!departmentId || u.departmentId === departmentId) &&
        (!role || parseRoles(u.role).includes(role)),
    );
  }, [users, search, departmentId, role]);

  function openForm(row: UserRow | null) {
    setEditing(row);
    form.resetFields();
    if (row) {
      form.setFieldsValue({
        name: row.name,
        email: row.email,
        employeeCode: row.employeeCode,
        departmentId: row.departmentId,
        managerId: row.managerId,
        roles: parseRoles(row.role).filter((r) => r !== ROLES.EMPLOYEE),
      });
    }
    setOpen(true);
  }

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    const [, error] = editing
      ? await updateUser({ ...values, id: editing.id })
      : await createUser(values);
    setSaving(false);
    if (error) return message.error(error.message);
    message.success(editing ? "Đã cập nhật người dùng" : "Đã tạo tài khoản");
    setOpen(false);
    router.refresh();
  }

  async function toggleBan(row: UserRow) {
    const [, error] = await setUserBanned({ userId: row.id, banned: !row.banned });
    if (error) return message.error(error.message);
    message.success(row.banned ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    router.refresh();
  }

  async function savePassword() {
    if (!passwordFor) return;
    const { newPassword } = await passwordForm.validateFields();
    setSaving(true);
    const [, error] = await setUserPassword({ userId: passwordFor.id, newPassword });
    setSaving(false);
    if (error) return message.error(error.message);
    message.success("Đã đặt mật khẩu mới và đăng xuất các phiên cũ của tài khoản");
    setPasswordFor(null);
  }

  const managerOptions = users
    .filter((u) => u.id !== editing?.id && !u.banned)
    .map((u) => ({ value: u.id, label: `${u.name} (${u.employeeCode})` }));

  return (
    <>
      <PageHeader
        title="Người dùng"
        subtitle={`${users.length} tài khoản`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
            Tạo tài khoản
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tên, email, mã NV"
          className="!w-full sm:!w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Phòng ban"
          className="w-full sm:w-52"
          value={departmentId}
          onChange={setDepartmentId}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select
          allowClear
          placeholder="Vai trò"
          className="w-full sm:w-52"
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS}
        />
      </div>

      <Table
        rowKey="id"
        size="small"
        dataSource={filtered}
        scroll={{ x: 960 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          { title: "Mã NV", dataIndex: "employeeCode", width: 110 },
          {
            title: "Họ tên",
            dataIndex: "name",
            render: (name, row) => (
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-xs text-black/45">{row.email}</div>
              </div>
            ),
          },
          { title: "Phòng ban", dataIndex: "departmentName", width: 180 },
          {
            title: "Quản lý trực tiếp",
            dataIndex: "managerName",
            width: 180,
            render: (v) => v ?? "—",
          },
          {
            title: "Vai trò",
            dataIndex: "role",
            width: 220,
            render: (r) => <RoleTags role={r} />,
          },
          {
            title: "Trạng thái",
            dataIndex: "banned",
            width: 110,
            render: (banned) =>
              banned ? <Tag color="error">Đã khóa</Tag> : <Tag color="success">Hoạt động</Tag>,
          },
          {
            key: "actions",
            width: 130,
            align: "right",
            render: (_, row) => (
              <Space size={4}>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openForm(row)} />
                </Tooltip>
                <Tooltip title="Đặt mật khẩu">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    onClick={() => {
                      passwordForm.resetFields();
                      setPasswordFor(row);
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  title={row.banned ? "Mở khóa tài khoản này?" : "Khóa tài khoản này?"}
                  description={row.banned ? undefined : "Người dùng sẽ bị đăng xuất ngay."}
                  okText="Đồng ý"
                  cancelText="Hủy"
                  onConfirm={() => toggleBan(row)}
                  disabled={row.id === currentUserId}
                >
                  <Tooltip title={row.banned ? "Mở khóa" : "Khóa"}>
                    <Button
                      type="text"
                      danger={!row.banned}
                      disabled={row.id === currentUserId}
                      icon={row.banned ? <UnlockOutlined /> : <LockOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Sửa người dùng" : "Tạo tài khoản"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
        width={600}
      >
        <Form form={form} layout="vertical" requiredMark={false} className="!mt-4">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="employeeCode"
              label="Mã nhân viên"
              rules={[{ required: true, message: "Vui lòng nhập mã nhân viên" }]}
              normalize={(v: string) => v.toUpperCase()}
            >
              <Input maxLength={20} placeholder="NV001" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Vui lòng nhập email" },
                { type: "email", message: "Email không hợp lệ" },
              ]}
            >
              <Input disabled={!!editing} />
            </Form.Item>
            {!editing && (
              <Form.Item
                name="password"
                label="Mật khẩu tạm"
                rules={[
                  { required: true, message: "Vui lòng nhập mật khẩu" },
                  { min: 8, message: "Tối thiểu 8 ký tự" },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            )}
            <Form.Item
              name="departmentId"
              label="Phòng ban"
              rules={[{ required: true, message: "Vui lòng chọn phòng ban" }]}
            >
              <Select
                showSearch={{ optionFilterProp: "label" }}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
            <Form.Item name="managerId" label="Quản lý trực tiếp">
              <Select allowClear showSearch={{ optionFilterProp: "label" }} options={managerOptions} />
            </Form.Item>
          </div>
          <Form.Item
            name="roles"
            label="Vai trò"
            extra="Mọi tài khoản đều có vai trò Nhân viên. Vai trò chức năng (Kế toán, CFO...) dùng cho các bước duyệt theo vai trò."
          >
            <Select mode="multiple" options={ROLE_OPTIONS} placeholder="Chỉ là nhân viên" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Đặt mật khẩu mới cho ${passwordFor?.name ?? ""}`}
        open={!!passwordFor}
        onCancel={() => setPasswordFor(null)}
        onOk={savePassword}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
      >
        <Form form={passwordForm} layout="vertical" requiredMark={false} className="!mt-4">
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 8, message: "Tối thiểu 8 ký tự" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
