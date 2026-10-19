"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Input, Select, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SortableList } from "@/shared/components/ui/sortable-list";
import { FUNCTIONAL_ROLES } from "@/shared/constants/role.constant";

import { saveApprovalSteps } from "../request-types.action";
import { APPROVER_TYPE_LABELS } from "../request-types.constant";
import type { ApprovalStepValues } from "../request-types.validation";

type Row = { id: string; step: ApprovalStepValues };

export function StepsEditor({
  typeId,
  steps,
  locked,
}: {
  typeId: string;
  steps: ApprovalStepValues[];
  locked: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<Row[]>(() => steps.map((step) => ({ id: crypto.randomUUID(), step })));
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<ApprovalStepValues>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, step: { ...r.step, ...patch } } : r)));
  }

  async function save() {
    setSaving(true);
    const [, error] = await saveApprovalSteps({ requestTypeId: typeId, steps: rows.map((r) => r.step) });
    setSaving(false);
    if (error) {
      return message.error(
        error.code === "INPUT_PARSE_ERROR"
          ? "Bước duyệt chưa hợp lệ: mỗi bước cần tên, bước theo vai trò cần chọn vai trò"
          : error.message,
      );
    }
    message.success("Đã lưu quy trình duyệt");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {locked && (
        <Alert
          type="warning"
          showIcon
          title="Loại đơn đang có đơn chờ duyệt"
          description="Không thể đổi bước duyệt cho tới khi các đơn đó được xử lý xong."
        />
      )}

      <SortableList
        items={rows}
        getId={(r) => r.id}
        onChange={setRows}
        renderItem={(row, index, handle) => (
          <Card size="small">
            <div className="flex items-start gap-2">
              <div className="pt-1">{handle}</div>
              <Tag color="blue" className="!mt-1.5">
                Bước {index + 1}
              </Tag>
              <div className="grid flex-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Input
                    value={row.step.name}
                    maxLength={100}
                    placeholder="VD: Quản lý trực tiếp duyệt"
                    onChange={(e) => update(row.id, { name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Select
                    className="w-full"
                    value={row.step.approverType}
                    onChange={(approverType) =>
                      update(row.id, {
                        approverType,
                        approverRole: approverType === "ROLE" ? FUNCTIONAL_ROLES[0].value : null,
                      })
                    }
                    options={Object.entries(APPROVER_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                </div>
                <div className="flex gap-2 md:col-span-4">
                  {row.step.approverType === "ROLE" && (
                    <Select
                      className="flex-1"
                      value={row.step.approverRole ?? undefined}
                      onChange={(approverRole) => update(row.id, { approverRole })}
                      options={FUNCTIONAL_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                    />
                  )}
                  <Button
                    type="text"
                    danger
                    className="ms-auto"
                    icon={<DeleteOutlined />}
                    aria-label="Xóa bước"
                    onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}
      />

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          icon={<PlusOutlined />}
          disabled={rows.length >= 10}
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: crypto.randomUUID(), step: { name: "", approverType: "MANAGER", approverRole: null } },
            ])
          }
        >
          Thêm bước
        </Button>
        <Button type="primary" onClick={save} loading={saving} disabled={locked}>
          Lưu quy trình
        </Button>
      </div>
    </div>
  );
}
