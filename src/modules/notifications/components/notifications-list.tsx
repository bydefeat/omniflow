"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Empty, Pagination, Segmented } from "antd";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/shared/components/ui/page-header";
import { useListFilters } from "@/shared/hooks/list-filters.hook";
import { PAGE_SIZE } from "@/shared/libs/list-params.lib";

import { markAllNotificationsRead, markNotificationRead } from "../notifications.action";
import type { NotificationFilters, NotificationRow } from "../notifications.query";
import { NotificationItem } from "./notification-item";

type Props = { rows: NotificationRow[]; total: number; unread: number; filters: NotificationFilters };

export function NotificationsList({ rows: notifications, total, unread, filters }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { update, pending } = useListFilters(filters);

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
      <Segmented
        className="!mb-4"
        value={filters.unread ? "unread" : "all"}
        onChange={(value) => update({ unread: value === "unread" ? "1" : undefined })}
        options={[
          { value: "all", label: "Tất cả" },
          { value: "unread", label: `Chưa đọc${unread ? ` (${unread})` : ""}` },
        ]}
      />
      <Card styles={{ body: { padding: 8 } }} loading={pending && notifications.length === 0}>
        {notifications.length === 0 ? (
          <Empty
            className="!py-12"
            description={filters.unread ? "Không còn thông báo chưa đọc" : "Chưa có thông báo"}
          />
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
      <Pagination
        className="!mt-4"
        align="center"
        current={filters.page}
        pageSize={PAGE_SIZE}
        total={total}
        hideOnSinglePage
        showSizeChanger={false}
        onChange={(page) => update({ page })}
      />
    </>
  );
}
