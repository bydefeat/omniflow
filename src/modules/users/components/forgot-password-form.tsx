"use client";

import { MailOutlined } from "@ant-design/icons";
import { Button, Form, Input, Result, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";

import { SIGN_IN_PATH } from "@/shared/constants/role.constant";
import { authClient } from "@/shared/libs/auth-client.lib";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish({ email }: { email: string }) {
    setLoading(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/authentication/reset-password",
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Result
        status="success"
        title="Kiểm tra hộp thư"
        subTitle="Nếu email thuộc một tài khoản trong hệ thống, liên kết đặt lại mật khẩu đã được gửi tới email đó."
        extra={<Link href={SIGN_IN_PATH}>Quay lại đăng nhập</Link>}
      />
    );
  }

  return (
    <>
      <Typography.Title level={3} className="!mb-1">
        Quên mật khẩu
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-8">
        Nhập email để nhận liên kết đặt lại mật khẩu.
      </Typography.Paragraph>

      <Form layout="vertical" size="large" requiredMark={false} onFinish={onFinish}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Vui lòng nhập email" },
            { type: "email", message: "Email không hợp lệ" },
          ]}
        >
          <Input prefix={<MailOutlined />} autoComplete="email" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Gửi liên kết
        </Button>
      </Form>

      <div className="mt-6 text-center">
        <Link href={SIGN_IN_PATH}>Quay lại đăng nhập</Link>
      </div>
    </>
  );
}
