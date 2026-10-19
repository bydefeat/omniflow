"use client";

import { CheckOutlined, CloseOutlined, RollbackOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Modal } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { approveRequest, rejectRequest, returnRequest } from "../approvals.action";

type Mode = "approve" | "reject" | "return";

const MODE_TEXT: Record<Mode, { title: string; ok: string; label: string; required?: string; done: string }> = {
  approve: { title: "Phê duyệt đơn", ok: "Xác nhận duyệt", label: "Ý kiến (không bắt buộc)", done: "Đã duyệt" },
  reject: {
    title: "Từ chối đơn",
    ok: "Từ chối",
    label: "Lý do từ chối",
    required: "Vui lòng nhập lý do từ chối",
    done: "Đã từ chối đơn",
  },
  return: {
    title: "Yêu cầu bổ sung",
    ok: "Gửi yêu cầu",
    label: "Nội dung cần bổ sung",
    required: "Vui lòng nêu nội dung cần bổ sung",
    done: "Đã gửi yêu cầu bổ sung cho người đề xuất",
  },
};

type Props = {
  approvalId: string;
  stepName: string;
  onBehalfOfName: string | null;
};

export function ApprovalActions({ approvalId, stepName, onBehalfOfName }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ comment?: string }>();
  const [mode, setMode] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const { comment } = await form.validateFields();
    setSaving(true);
    const [result, error] =
      mode === "approve"
        ? await approveRequest({ approvalId, comment })
        : mode === "reject"
          ? await rejectRequest({ approvalId, comment: comment ?? "" })
          : await returnRequest({ approvalId, comment: comment ?? "" });
    setSaving(false);
    if (error) {
      message.error(error.message);
      if (error.code === "CONFLICT") router.refresh();
      return;
    }
    setMode(null);
    message.success(
      mode !== "approve"
        ? MODE_TEXT[mode!].done
        : result && "completed" in result && result.completed
          ? "Đã duyệt. Đơn đã hoàn tất quy trình."
          : "Đã duyệt. Đơn được chuyển sang bước tiếp theo.",
    );
    router.push("/workspace/approvals");
    router.refresh();
  }

  function open(next: Mode) {
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
          <div className="flex flex-wrap gap-2">
            <Button size="large" icon={<RollbackOutlined />} className="flex-1 sm:flex-none" onClick={() => open("return")}>
              Yêu cầu bổ sung
            </Button>
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
        title={mode ? MODE_TEXT[mode].title : ""}
        open={mode !== null}
        onCancel={() => setMode(null)}
        onOk={confirm}
        okText={mode ? MODE_TEXT[mode].ok : ""}
        okButtonProps={{ danger: mode === "reject" }}
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
      >
        {mode === "return" && (
          <Alert
            type="info"
            showIcon
            className="!mb-4"
            title="Đơn sẽ trả về người đề xuất để bổ sung. Khi họ gửi lại, đơn được duyệt lại từ bước đầu."
          />
        )}
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
            label={mode ? MODE_TEXT[mode].label : ""}
            rules={mode && MODE_TEXT[mode].required ? [{ required: true, whitespace: true, message: MODE_TEXT[mode].required }] : []}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
