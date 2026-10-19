import type { Metadata } from "next";
import { NotificationsList } from "@/modules/notifications/components/notifications-list";
import { readNotificationFilters, searchNotifications } from "@/modules/notifications/notifications.query";
import { requireSession } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Thông báo" };

export default async function NotificationsPage({ searchParams }: PageProps<"/workspace/notifications">) {
  const { user } = await requireSession();
  const filters = readNotificationFilters(await searchParams);
  return <NotificationsList {...await searchNotifications(user.id, filters)} filters={filters} />;
}
