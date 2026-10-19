"use client";

import { BellOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Empty, Popover } from "antd";
import Link from "next/link";
import { useState } from "react";

import { getNotificationSummary, markAllNotificationsRead, markNotificationRead } from "../notifications.action";
import type { NotificationRow } from "../notifications.query";
import { NotificationItem } from "./notification-item";

const QUERY_KEY = ["notifications", "summary"];

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const [summary, error] = await getNotificationSummary();
      if (error) throw error;
      return summary;
    },
    refetchInterval: 30_000,
  });

  async function openItem(notification: NotificationRow) {
    setOpen(false);
    if (!notification.readAt) {
      await markNotificationRead({ id: notification.id });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  }

  async function readAll() {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  const content = (
    <div className="w-80 max-w-[calc(100vw-32px)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Thông báo</span>
        {!!data?.unread && (
          <Button type="link" size="small" className="!px-0" onClick={readAll}>
            Đánh dấu đã đọc
          </Button>
        )}
      </div>
      {data?.latest.length ? (
        <div className="-mx-3 max-h-96 overflow-y-auto">
          {data.latest.map((n) => (
            <NotificationItem key={n.id} notification={n} onOpen={openItem} />
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
      )}
      <div className="mt-2 border-t border-black/5 pt-2 text-center">
        <Link href="/workspace/notifications" onClick={() => setOpen(false)}>
          Xem tất cả
        </Link>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen}>
      <Badge count={data?.unread ?? 0} size="small" offset={[-4, 4]}>
        <Button type="text" shape="circle" icon={<BellOutlined className="text-lg" />} aria-label="Thông báo" />
      </Badge>
    </Popover>
  );
}
