"use client";

import { StopOutlined } from "@ant-design/icons";
import { App, Button, Popconfirm } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelRequest } from "../approvals.action";

export function CancelRequestButton({ requestId, redirectTo }: { requestId: string; redirectTo?: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    const [, error] = await cancelRequest({ requestId });
    setLoading(false);
    if (error) return message.error(error.message);
    message.success("Đã hủy đơn");
    if (redirectTo) router.replace(redirectTo);
    else router.refresh();
  }

  return (
    <Popconfirm
      title="Hủy đơn này?"
      description="Quy trình duyệt sẽ dừng lại và không thể khôi phục."
      okText="Hủy đơn"
      cancelText="Không"
      okButtonProps={{ danger: true }}
      onConfirm={cancel}
    >
      <Button danger icon={<StopOutlined />} loading={loading}>
        Hủy đơn
      </Button>
    </Popconfirm>
  );
}
