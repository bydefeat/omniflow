"use client";

import { Form, Input, InputNumber, Switch } from "antd";

export function RequestTypeFields() {
  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item
          name="code"
          label="Mã loại đơn"
          rules={[{ required: true, message: "Vui lòng nhập mã" }]}
          normalize={(v: string) => v.toUpperCase()}
        >
          <Input maxLength={30} placeholder="EXPENSE" />
        </Form.Item>
        <Form.Item name="name" label="Tên loại đơn" rules={[{ required: true, message: "Vui lòng nhập tên" }]}>
          <Input maxLength={100} placeholder="Thanh toán công tác" />
        </Form.Item>
      </div>
      <Form.Item name="description" label="Mô tả / quy định">
        <Input.TextArea maxLength={500} rows={3} showCount />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item
          name="slaHours"
          label="Thời hạn xử lý mỗi bước (giờ)"
          rules={[{ required: true, message: "Vui lòng nhập thời hạn" }]}
        >
          <InputNumber min={1} max={720} className="!w-full" />
        </Form.Item>
        <Form.Item
          name="hasLineItems"
          label="Có bảng hạng mục chi tiết"
          valuePropName="checked"
          extra="Bật cho đơn tài chính / mua sắm: nhập tên hàng, số lượng, đơn giá, tự tính tổng tiền."
        >
          <Switch />
        </Form.Item>
      </div>
    </>
  );
}
