"use client";

import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  MinusCircleOutlined,
} from "@ant-design/icons";
import { Card, Tag, Timeline, theme } from "antd";
import { motion } from "motion/react";

import { ROLE_LABELS } from "@/shared/constants/role.constant";
import { formatDateTime } from "@/shared/libs/format.lib";

import { APPROVAL_RESULT_META } from "../approvals.constant";
import type { ApprovalTimeline as TimelineData } from "../approvals.query";

const roleName = (role: string | null) => (role ? (ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role) : null);

export function ApprovalTimeline({ timeline }: { timeline: TimelineData }) {
  const { token } = theme.useToken();

  const icons = {
    WAITING: <ClockCircleOutlined style={{ color: token.colorPrimary }} />,
    APPROVED: <CheckCircleFilled style={{ color: token.colorSuccess }} />,
    REJECTED: <CloseCircleFilled style={{ color: token.colorError }} />,
    CANCELLED: <MinusCircleOutlined style={{ color: token.colorTextQuaternary }} />,
  };

  const items = [
    ...timeline.rounds.map((round, index) => ({
      key: round.id,
      icon: icons[round.result],
      content: (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="pb-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              Bước {round.stepOrder}: {round.stepName}
            </span>
            <Tag color={APPROVAL_RESULT_META[round.result].color}>{APPROVAL_RESULT_META[round.result].label}</Tag>
            {round.overdue && <Tag color="error">Quá hạn</Tag>}
          </div>
          <div className="text-sm text-black/60">
            {round.result === "WAITING" || round.result === "CANCELLED"
              ? `Người duyệt: ${round.approverName ?? `Bất kỳ ${roleName(round.approverRole)}`}`
              : `${round.actedByName}${round.onBehalfOfName ? ` (duyệt thay ${round.onBehalfOfName})` : ""} · ${formatDateTime(round.decidedAt)}`}
          </div>
          {round.result === "WAITING" && (
            <div className="text-xs text-black/45">Hạn xử lý: {formatDateTime(round.dueAt)}</div>
          )}
          {round.reassignedByName && (
            <div className="text-xs text-black/45">
              Giao lại bởi {round.reassignedByName} · {formatDateTime(round.reassignedAt)}
            </div>
          )}
          {round.comment && (
            <div
              className="mt-1 rounded-md px-3 py-2 text-sm"
              style={{ background: round.result === "REJECTED" ? token.colorErrorBg : token.colorFillAlter }}
            >
              {round.comment}
            </div>
          )}
        </motion.div>
      ),
    })),
    ...timeline.upcoming.map((step) => ({
      key: `upcoming-${step.stepOrder}`,
      color: "gray",
      content: (
        <div className="pb-2 text-black/45">
          Bước {step.stepOrder}: {step.name}
          {step.approverRole && ` · ${roleName(step.approverRole)}`}
        </div>
      ),
    })),
  ];

  return (
    <Card title="Tiến trình phê duyệt">
      {items.length > 0 ? <Timeline items={items} /> : <p className="text-black/45">Chưa gửi duyệt</p>}
    </Card>
  );
}
