import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/shared/libs/db.lib";

import { notifications } from "./notifications.schema";

export async function listNotifications(userId: string, limit = 50) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

export async function countUnread(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row.total;
}
