"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Empty } from "antd";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/shared/components/ui/page-header";

import { markAllNotificationsRead, markNotificationRead } from "../notifications.action";
import type { NotificationRow } from "../notifications.query";
import { NotificationItem } from "./notification-item";

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = notifications.filter((n) => !n.readAt).length;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Thông báo"
        subtitle={unread ? `${unread} thông báo chưa đọc` : "Đã đọc hết"}
        extra={
          unread > 0 && (
            <Button
              onClick={async () => {
                await markAllNotificationsRead();
                await refresh();
              }}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          )
        }
      />
      <Card styles={{ body: { padding: 8 } }}>
        {notifications.length === 0 ? (
          <Empty className="!py-12" description="Chưa có thông báo" />
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onOpen={async (item) => {
                if (!item.readAt) {
                  await markNotificationRead({ id: item.id });
                  queryClient.invalidateQueries({ queryKey: ["notifications"] });
                }
              }}
            />
          ))
        )}
      </Card>
    </>
  );
}
