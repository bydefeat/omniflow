"use client";

import { LockOutlined } from "@ant-design/icons";
import { Alert, App, Button, Form, Input, Result, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SIGN_IN_PATH } from "@/shared/constants/role.constant";
import { authClient } from "@/shared/libs/auth-client.lib";

type Values = { newPassword: string; confirmPassword: string };

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Result
        status="error"
        title="Liên kết không hợp lệ"
        subTitle="Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng."
        extra={
          <Link href="/authentication/forgot-password">Gửi liên kết mới</Link>
        }
      />
    );
  }

  async function onFinish({ newPassword }: Values) {
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({
      newPassword,
      token: token!,
    });
    setLoading(false);
    if (error) {
      setError("Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng gửi lại.");
      return;
    }
    message.success("Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.");
    router.replace(SIGN_IN_PATH);
  }

  return (
    <>
      <Typography.Title level={3} className="!mb-1">
        Đặt lại mật khẩu
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-8">
        Mật khẩu mới tối thiểu 8 ký tự.
      </Typography.Paragraph>

      {error && <Alert type="error" title={error} className="!mb-6" showIcon />}

      <Form<Values>
        layout="vertical"
        size="large"
        requiredMark={false}
        onFinish={onFinish}
      >
        <Form.Item
          name="newPassword"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: "Vui lòng nhập mật khẩu mới" },
            { min: 8, message: "Tối thiểu 8 ký tự" },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Nhập lại mật khẩu"
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
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đặt lại mật khẩu
        </Button>
      </Form>
    </>
  );
}
