"use client";

import { App, Button, Card, Form } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateRequestType } from "../request-types.action";
import type { RequestTypeDetail } from "../request-types.query";
import type { RequestTypeFormValues } from "../request-types.validation";
import { RequestTypeFields } from "./request-type-fields";

export function RequestTypeGeneralForm({ type }: { type: RequestTypeDetail }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  async function save(values: RequestTypeFormValues) {
    setSaving(true);
    const [, error] = await updateRequestType({ ...values, id: type.id });
    setSaving(false);
    if (error) return message.error(error.message);
    message.success("Đã lưu thông tin loại đơn");
    router.refresh();
  }

  return (
    <Card>
      <Form<RequestTypeFormValues>
        layout="vertical"
        requiredMark={false}
        initialValues={{
          code: type.code,
          name: type.name,
          description: type.description,
          slaHours: type.slaHours,
          hasLineItems: type.hasLineItems,
        }}
        onFinish={save}
      >
        <RequestTypeFields />
        <Button type="primary" htmlType="submit" loading={saving}>
          Lưu thay đổi
        </Button>
      </Form>
    </Card>
  );
}
