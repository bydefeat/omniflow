"use client";

import { UserSwitchOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Select } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserOption } from "@/modules/users/users.query";

import { reassignApproval } from "../approvals.action";
import type { WaitingRound } from "../approvals.query";

export function ReassignApproval({ round, users }: { round: WaitingRound; users: UserOption[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [approverId, setApproverId] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function reassign() {
    if (!approverId) return;
    setLoading(true);
    const [, error] = await reassignApproval({ approvalId: round.approvalId, approverId });
    setLoading(false);
    if (error) return message.error(error.message);
    message.success("Đã giao lại người duyệt");
    setApproverId(undefined);
    router.refresh();
  }

  return (
    <Card title={`Giao lại người duyệt · ${round.stepName}`}>
      {round.unassignable && (
        <Alert
          type="warning"
          showIcon
          className="!mb-4"
          title="Lượt duyệt này không còn ai xử lý được"
          description="Người duyệt đã bị khóa hoặc không còn ai giữ vai trò của bước. Hãy giao cho một người cụ thể."
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          className="flex-1"
          showSearch
          placeholder="Chọn người duyệt mới"
          value={approverId}
          onChange={setApproverId}
          optionFilterProp="label"
          options={users
            .filter((u) => u.id !== round.requesterId)
            .map((u) => ({ value: u.id, label: `${u.name} (${u.employeeCode})` }))}
        />
        <Button type="primary" icon={<UserSwitchOutlined />} disabled={!approverId} loading={loading} onClick={reassign}>
          Giao lại
        </Button>
      </div>
    </Card>
  );
}
