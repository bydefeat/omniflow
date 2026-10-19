"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Empty, Input, Select, Switch } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SortableList } from "@/shared/components/ui/sortable-list";

import { saveFormSchema } from "../request-types.action";
import { FIELD_TYPE_LABELS } from "../request-types.constant";
import { FIELD_TYPES, type FormField } from "../request-types.validation";

type Row = { id: string; field: FormField };

const newRow = (index: number): Row => ({
  id: crypto.randomUUID(),
  field: { key: `field${index + 1}`, label: "", type: "text", required: false },
});

export function FormBuilder({ typeId, fields }: { typeId: string; fields: FormField[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Row[]>(() => fields.map((field) => ({ id: crypto.randomUUID(), field })));
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<FormField>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, field: { ...r.field, ...patch } } : r)));
  }

  async function save() {
    setSaving(true);
    const [, error] = await saveFormSchema({ requestTypeId: typeId, fields: rows.map((r) => r.field) });
    setSaving(false);
    if (error) {
      return message.error(
        error.code === "INPUT_PARSE_ERROR"
          ? "Biểu mẫu chưa hợp lệ: kiểm tra nhãn, mã trường (không trùng) và danh sách lựa chọn"
          : error.message,
      );
    }
    message.success("Đã lưu biểu mẫu");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card size="small">
        <p className="!mb-0 text-sm text-black/60">
          Các trường nhập liệu riêng của loại đơn này. Tiêu đề, lý do, hạng mục chi tiết và tệp đính kèm đã có sẵn trên
          mọi đơn. Kéo biểu tượng ⋮⋮ để sắp xếp.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <Empty description="Chưa có trường riêng nào" />
        </Card>
      ) : (
        <SortableList
          items={rows}
          getId={(r) => r.id}
          onChange={setRows}
          renderItem={(row, index, handle) => (
            <Card size="small">
              <div className="flex items-start gap-2">
                <div className="pt-1">{handle}</div>
                <div className="grid flex-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs text-black/60">Nhãn hiển thị</label>
                    <Input
                      value={row.field.label}
                      maxLength={100}
                      placeholder={`Trường ${index + 1}`}
                      onChange={(e) => update(row.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs text-black/60">Mã trường</label>
                    <Input
                      value={row.field.key}
                      maxLength={40}
                      onChange={(e) => update(row.id, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs text-black/60">Kiểu</label>
                    <Select
                      className="w-full"
                      value={row.field.type}
                      onChange={(type) => update(row.id, { type })}
                      options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 md:col-span-2">
                    <label className="flex items-center gap-2 pb-1 text-sm">
                      <Switch
                        size="small"
                        checked={row.field.required}
                        onChange={(required) => update(row.id, { required })}
                      />
                      Bắt buộc
                    </label>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="Xóa trường"
                      onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                    />
                  </div>
                  {row.field.type === "select" && (
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-xs text-black/60">Các lựa chọn (Enter để thêm)</label>
                      <Select
                        mode="tags"
                        className="w-full"
                        value={row.field.options ?? []}
                        onChange={(options) => update(row.id, { options })}
                        open={false}
                        suffixIcon={null}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        />
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button icon={<PlusOutlined />} onClick={() => setRows((current) => [...current, newRow(current.length)])}>
          Thêm trường
        </Button>
        <Button type="primary" onClick={save} loading={saving}>
          Lưu biểu mẫu
        </Button>
      </div>
    </div>
  );
}
