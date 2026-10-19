"use client";

import { DeleteOutlined } from "@ant-design/icons";
import { App, Button, Popconfirm } from "antd";
import { useRouter } from "next/navigation";

import { deleteDraft } from "../requests.action";

export function DeleteDraftButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { message } = App.useApp();

  async function remove() {
    const [, error] = await deleteDraft({ requestId });
    if (error) return message.error(error.message);
    message.success("Đã xóa đơn nháp");
    router.replace("/workspace/requests");
  }

  return (
    <Popconfirm
      title="Xóa đơn nháp này?"
      description="Nội dung và tệp đính kèm sẽ bị xóa vĩnh viễn."
      okText="Xóa"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      onConfirm={remove}
    >
      <Button danger icon={<DeleteOutlined />}>
        Xóa nháp
      </Button>
    </Popconfirm>
  );
}
