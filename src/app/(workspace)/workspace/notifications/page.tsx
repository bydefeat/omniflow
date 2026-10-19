import { NotificationsList } from "@/modules/notifications/components/notifications-list";
import { listNotifications } from "@/modules/notifications/notifications.query";
import { requireSession } from "@/shared/libs/session.lib";

export default async function NotificationsPage() {
  const { user } = await requireSession();
  const notifications = await listNotifications(user.id, 100);
  return <NotificationsList notifications={notifications} />;
}
