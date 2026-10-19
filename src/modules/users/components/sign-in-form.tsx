"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/shared/libs/auth-client.lib";
import { getHomePath } from "@/shared/libs/role.lib";

type Values = { email: string; password: string };

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email hoặc mật khẩu không đúng.",
  BANNED_USER: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
};

export function SignInForm({ callbackPath }: { callbackPath: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    const { data, error } = await authClient.signIn.email(values);
    if (error) {
      setLoading(false);
      setError(
        ERROR_MESSAGES[error.code ?? ""] ??
          (error.status === 429 && error.message
            ? error.message
            : "Không thể đăng nhập. Vui lòng thử lại."),
      );
      return;
    }
    router.replace(callbackPath ?? getHomePath(data.user.role));
  }

  return (
    <>
      <Typography.Title level={3} className="!mb-1">
        Đăng nhập
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-8">
        Dùng tài khoản do quản trị viên cấp.
      </Typography.Paragraph>

      {error && <Alert type="error" title={error} className="!mb-6" showIcon />}

      <Form<Values>
        layout="vertical"
        size="large"
        requiredMark={false}
        onFinish={onFinish}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Vui lòng nhập email" },
            { type: "email", message: "Email không hợp lệ" },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            autoComplete="email"
            placeholder="ten@congty.vn"
          />
        </Form.Item>
        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
          />
        </Form.Item>
        <div className="-mt-2 mb-6 text-right">
          <Link href="/authentication/forgot-password">Quên mật khẩu?</Link>
        </div>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng nhập
        </Button>
      </Form>
    </>
  );
}
