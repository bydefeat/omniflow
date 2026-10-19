"use client";

import { DatePicker, Form, Input, InputNumber, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import { buildFormValidator, type FormField } from "@/modules/request-types/request-types.validation";

const DATE_FORMAT = "YYYY-MM-DD";

export function DynamicFields({ fields }: { fields: FormField[] }) {
  if (fields.length === 0) return null;

  return (
    <div className="grid gap-x-4 md:grid-cols-2">
      {fields.map((field) => (
        <Form.Item
          key={field.key}
          name={["formData", field.key]}
          label={field.label}
          className={field.type === "textarea" ? "md:col-span-2" : undefined}
          rules={
            field.required
              ? [
                  {
                    required: true,
                    ...(field.type === "text" || field.type === "textarea" ? { whitespace: true } : {}),
                    message: `Vui lòng nhập ${field.label.toLowerCase()}`,
                  },
                ]
              : []
          }
        >
          {renderControl(field)}
        </Form.Item>
      ))}
    </div>
  );
}

function renderControl(field: FormField) {
  switch (field.type) {
    case "text":
      return <Input maxLength={500} />;
    case "textarea":
      return <Input.TextArea rows={3} maxLength={5000} />;
    case "number":
      return <InputNumber className="!w-full" />;
    case "date":
      return <DatePicker className="w-full" format="DD/MM/YYYY" />;
    case "dateRange":
      return <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" />;
    case "select":
      return <Select allowClear options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />;
  }
}

export function toFormDataPayload(fields: FormField[], values: Record<string, unknown> | undefined) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values?.[field.key];
    if (value == null || value === "") continue;
    if (field.type === "date") payload[field.key] = (value as Dayjs).format(DATE_FORMAT);
    else if (field.type === "dateRange") {
      const [from, to] = value as [Dayjs, Dayjs];
      payload[field.key] = [from.format(DATE_FORMAT), to.format(DATE_FORMAT)];
    } else payload[field.key] = value;
  }
  return payload;
}

export function fromFormDataPayload(fields: FormField[], data: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value == null) continue;
    if (!buildFormValidator([field], { partial: true }).safeParse({ [field.key]: value }).success) continue;
    if (field.type === "date") values[field.key] = dayjs(value as string);
    else if (field.type === "dateRange") values[field.key] = (value as string[]).map((v) => dayjs(v));
    else values[field.key] = value;
  }
  return values;
}
