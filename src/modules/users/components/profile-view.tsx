"use client";

import { App, Button, Card, Descriptions, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/shared/components/ui/page-header";
import { authClient } from "@/shared/libs/auth-client.lib";
import { formatDate } from "@/shared/libs/format.lib";
import { PASSWORD_HINT, passwordFormRule } from "@/shared/libs/password.lib";

import { updateOwnName } from "../users.action";
import type { UserProfile } from "../users.query";
import { RoleTags } from "./role-tags";

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ProfileView({ profile }: { profile: UserProfile }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordValues>();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile.name);
  const router = useRouter();

  async function saveName(value: string) {
    const next = value.trim();
    if (!next || next === name) return;
    const [saved, error] = await updateOwnName({ name: next });
    if (error) return message.error(error.message);
    setName(saved.name);
    message.success("Đã cập nhật họ tên");
    router.refresh();
  }

  async function changePassword({ currentPassword, newPassword }: PasswordValues) {
    setSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSaving(false);
    if (error) {
      return message.error(
        error.code === "INVALID_PASSWORD"
          ? "Mật khẩu hiện tại không đúng"
          : error.code === "WEAK_PASSWORD"
            ? (error.message ?? PASSWORD_HINT)
            : "Không đổi được mật khẩu. Vui lòng thử lại.",
      );
    }
    form.resetFields();
    message.success("Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.");
  }

  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin tài khoản">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Họ tên">
              <Typography.Text
                editable={{
                  onChange: saveName,
                  maxLength: 100,
                  tooltip: "Sửa họ tên",
                  triggerType: ["icon", "text"],
                }}
              >
                {name}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
            <Descriptions.Item label="Mã nhân viên">{profile.employeeCode}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{profile.departmentName}</Descriptions.Item>
            <Descriptions.Item label="Quản lý trực tiếp">
              {profile.managerName ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Vai trò">
              <RoleTags role={profile.role} />
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDate(profile.createdAt)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Đổi mật khẩu">
          <Form<PasswordValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={changePassword}
          >
            <Form.Item
              name="currentPassword"
              label="Mật khẩu hiện tại"
              rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              extra={PASSWORD_HINT}
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu mới" },
                passwordFormRule,
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Nhập lại mật khẩu mới"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "Vui lòng nhập lại mật khẩu" },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || value === getFieldValue("newPassword")
                      ? Promise.resolve()
                      : Promise.reject(new Error("Mật khẩu nhập lại không khớp")),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Đổi mật khẩu
            </Button>
          </Form>
        </Card>
      </div>
    </>
  );
}
