"use client";

import { Tag, theme } from "antd";
import Link from "next/link";

import { formatDateTime } from "@/shared/libs/format.lib";

import { NOTIFICATION_TYPE_META } from "../notifications.constant";
import type { NotificationRow } from "../notifications.query";

export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: NotificationRow;
  onOpen: (notification: NotificationRow) => void;
}) {
  const { token } = theme.useToken();
  const meta = NOTIFICATION_TYPE_META[notification.type];
  const unread = !notification.readAt;

  return (
    <Link
      href={notification.href ?? "#"}
      onClick={() => onOpen(notification)}
      className="flex gap-3 rounded-lg px-3 py-2.5 !text-inherit"
      style={{ background: unread ? token.colorPrimaryBg : undefined }}
    >
      <span
        className="mt-2 size-2 shrink-0 rounded-full"
        style={{ background: unread ? token.colorPrimary : "transparent" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug">{notification.title}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-black/45">
          <Tag color={meta.color} className="!m-0">
            {meta.label}
          </Tag>
          {formatDateTime(notification.createdAt)}
        </span>
      </span>
    </Link>
  );
}
