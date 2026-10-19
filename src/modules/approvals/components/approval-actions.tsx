"use client";

import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Modal } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { approveRequest, rejectRequest } from "../approvals.action";

type Props = {
  approvalId: string;
  stepName: string;
  onBehalfOfName: string | null;
};

export function ApprovalActions({ approvalId, stepName, onBehalfOfName }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ comment?: string }>();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const { comment } = await form.validateFields();
    setSaving(true);
    const [result, error] =
      mode === "approve"
        ? await approveRequest({ approvalId, comment })
        : await rejectRequest({ approvalId, comment: comment ?? "" });
    setSaving(false);
    if (error) {
      message.error(error.message);
      if (error.code === "CONFLICT") router.refresh();
      return;
    }
    setMode(null);
    message.success(
      mode === "reject"
        ? "Đã từ chối đơn"
        : result && "completed" in result && result.completed
          ? "Đã duyệt. Đơn đã hoàn tất quy trình."
          : "Đã duyệt. Đơn được chuyển sang bước tiếp theo.",
    );
    router.push("/workspace/approvals");
    router.refresh();
  }

  function open(next: "approve" | "reject") {
    form.resetFields();
    setMode(next);
  }

  return (
    <>
      <Card className="!sticky bottom-16 z-20 md:bottom-4" styles={{ body: { padding: 16 } }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Bạn đang xử lý: {stepName}</div>
            {onBehalfOfName && <div className="text-sm text-black/60">Duyệt thay {onBehalfOfName} (ủy quyền)</div>}
          </div>
          <div className="flex gap-2">
            <Button danger size="large" icon={<CloseOutlined />} className="flex-1 sm:flex-none" onClick={() => open("reject")}>
              Từ chối
            </Button>
            <Button type="primary" size="large" icon={<CheckOutlined />} className="flex-1 sm:flex-none" onClick={() => open("approve")}>
              Phê duyệt
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        title={mode === "reject" ? "Từ chối đơn" : "Phê duyệt đơn"}
        open={mode !== null}
        onCancel={() => setMode(null)}
        onOk={confirm}
        okText={mode === "reject" ? "Từ chối" : "Xác nhận duyệt"}
        okButtonProps={{ danger: mode === "reject" }}
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
      >
        {mode === "reject" && (
          <Alert
            type="warning"
            showIcon
            className="!mb-4"
            title="Từ chối sẽ dừng toàn bộ quy trình duyệt và báo lý do cho người làm đơn."
          />
        )}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="comment"
            label={mode === "reject" ? "Lý do từ chối" : "Ý kiến (không bắt buộc)"}
            rules={mode === "reject" ? [{ required: true, whitespace: true, message: "Vui lòng nhập lý do từ chối" }] : []}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
