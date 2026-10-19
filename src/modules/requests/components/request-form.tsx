"use client";

import { SaveOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Empty, Form, Input, Select, Steps } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ActiveRequestType } from "@/modules/request-types/request-types.query";

import { createDraft, updateDraft } from "../requests.action";
import type { DraftForEdit } from "../requests.query";
import { AttachmentsPanel } from "./attachments-panel";
import { DynamicFields, fromFormDataPayload, toFormDataPayload } from "./dynamic-fields";
import { isBlankLineItem, lineItemProblem, type LineItemValue, LineItemsTable, newLineItem } from "./line-items-table";

type SubmitAction = (input: { requestId: string }) => Promise<readonly [unknown, { message: string } | null]>;

type Props = {
  types: ActiveRequestType[];
  draft?: DraftForEdit;
  submitAction: SubmitAction;
  resubmit?: boolean;
};

type Values = {
  requestTypeId?: string;
  title: string;
  reason: string;
  formData?: Record<string, unknown>;
  items?: LineItemValue[];
};

function firstFieldError(error: unknown) {
  const fieldErrors = (error as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  return Object.values(fieldErrors ?? {}).flat().find(Boolean);
}

export function RequestForm({ types, draft, submitAction, resubmit = false }: Props) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const typeId = Form.useWatch("requestTypeId", form) ?? draft?.requestTypeId;
  const type = types.find((t) => t.id === typeId);

  if (draft && !types.some((t) => t.id === draft.requestTypeId)) {
    return (
      <Alert
        type="warning"
        showIcon
        title="Loại đơn của bản nháp này đã ngừng sử dụng"
        description="Bản nháp không thể tiếp tục soạn hay gửi duyệt. Bạn có thể xóa nháp và tạo đơn mới với loại đơn khác."
      />
    );
  }

  if (types.length === 0) {
    return (
      <Card>
        <Empty description="Chưa có loại đơn nào được cấu hình. Vui lòng liên hệ quản trị viên." />
      </Card>
    );
  }

  const initialValues: Values | undefined = draft && {
    requestTypeId: draft.requestTypeId,
    title: draft.title,
    reason: draft.reason,
    formData: type ? fromFormDataPayload(type.formSchema, draft.formData) : {},
    items: draft.items.map((item) => ({
      key: item.id,
      name: item.name,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  };

  async function persist(): Promise<string | null> {
    const values = form.getFieldsValue(true) as Values;
    const rows = type?.hasLineItems ? (values.items ?? []) : [];
    const problemIndex = rows.findIndex((item) => !isBlankLineItem(item) && lineItemProblem(item));
    if (problemIndex >= 0) {
      message.error(`Hạng mục dòng ${problemIndex + 1}: ${lineItemProblem(rows[problemIndex])}`);
      return null;
    }
    const items = rows.filter((item) => !isBlankLineItem(item));
    const payload = {
      title: values.title,
      reason: values.reason,
      formData: toFormDataPayload(type?.formSchema ?? [], values.formData),
      items: items.map((item) => ({
        name: item.name,
        unit: item.unit,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
      })),
    };
    const [result, error] = draft
      ? await updateDraft({ ...payload, id: draft.id })
      : await createDraft({ ...payload, requestTypeId: values.requestTypeId ?? "" });
    if (error) {
      message.error(
        error.code === "INPUT_PARSE_ERROR"
          ? (firstFieldError(error) ?? "Thông tin chưa hợp lệ, vui lòng kiểm tra lại.")
          : error.message,
      );
      return null;
    }
    return result.id;
  }

  async function saveDraft() {
    await form.validateFields(["requestTypeId", "title", "reason"]);
    setBusy("draft");
    const id = await persist();
    setBusy(null);
    if (!id) return;
    message.success("Đã lưu nháp");
    if (draft) router.refresh();
    else router.replace(`/workspace/requests/${id}/edit`);
  }

  async function submit() {
    await form.validateFields();
    const items = ((form.getFieldValue("items") as LineItemValue[] | undefined) ?? []).filter(
      (item) => !isBlankLineItem(item),
    );
    if (type?.hasLineItems && items.length === 0) {
      return message.error("Cần ít nhất một hạng mục chi tiết");
    }
    const confirmed = await modal.confirm({
      title: "Gửi đơn đi duyệt?",
      content: "Sau khi gửi, bạn không sửa được nội dung đơn, chỉ có thể hủy khi đơn còn đang chờ duyệt.",
      okText: resubmit ? "Gửi lại" : "Gửi duyệt",
      cancelText: "Xem lại",
    });
    if (!confirmed) return;

    setBusy("submit");
    const id = await persist();
    if (!id) return setBusy(null);
    const [, error] = await submitAction({ requestId: id });
    setBusy(null);
    if (error) {
      message.error(error.message);
      if (!draft) router.replace(`/workspace/requests/${id}/edit`);
      return;
    }
    message.success("Đã gửi đơn. Người duyệt sẽ nhận được thông báo.");
    router.replace("/workspace/requests");
  }

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      requiredMark="optional"
      initialValues={initialValues ?? { items: [] }}
      onValuesChange={(changed) => {
        if ("requestTypeId" in changed) {
          const next = types.find((t) => t.id === changed.requestTypeId);
          form.setFieldsValue({ formData: {}, items: next?.hasLineItems ? [newLineItem()] : [] });
        }
      }}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Thông tin đề xuất">
            <Form.Item
              name="requestTypeId"
              label="Loại đơn"
              rules={[{ required: true, message: "Vui lòng chọn loại đơn" }]}
            >
              <Select
                placeholder="Chọn loại đề xuất"
                disabled={!!draft}
                options={types.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Form.Item>
            {type?.description && <Alert type="info" showIcon className="!mb-6" title={type.description} />}
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: "Vui lòng nhập tiêu đề" }]}>
              <Input maxLength={200} placeholder="Tóm tắt nội dung đề xuất" />
            </Form.Item>
            <Form.Item
              name="reason"
              label="Lý do / giải trình"
              rules={[{ required: true, whitespace: true, message: "Vui lòng nhập lý do" }]}
            >
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
            {type && <DynamicFields fields={type.formSchema} />}
          </Card>

          {type?.hasLineItems && (
            <Card title="Hạng mục chi tiết">
              <Form.Item name="items" noStyle>
                <LineItemsTable />
              </Form.Item>
            </Card>
          )}

          <Card title="Tệp đính kèm">
            <AttachmentsPanel requestId={draft?.id} attachments={draft?.attachments ?? []} editable />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Lộ trình phê duyệt">
            {type ? (
              <Steps
                orientation="vertical"
                size="small"
                current={-1}
                items={type.steps.map((s) => ({ title: s.name, content: `Bước ${s.stepOrder}` }))}
              />
            ) : (
              <p className="text-black/45">Chọn loại đơn để xem các cấp duyệt.</p>
            )}
            {type && <p className="!mt-4 text-xs text-black/45">Mỗi bước cần xử lý trong {type.slaHours} giờ.</p>}
          </Card>

          <div className="sticky bottom-20 z-10 flex flex-col gap-2 md:bottom-6">
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              loading={busy === "submit"}
              disabled={busy !== null}
              onClick={submit}
            >
              {resubmit ? "Gửi lại" : "Gửi duyệt"}
            </Button>
            <Button
              size="large"
              icon={<SaveOutlined />}
              loading={busy === "draft"}
              disabled={busy !== null}
              onClick={saveDraft}
            >
              Lưu nháp
            </Button>
          </div>
        </div>
      </div>
    </Form>
  );
}
