import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/shared/libs/db.lib";
import { PAGE_SIZE, readPage, readParam } from "@/shared/libs/list-params.lib";

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

export type NotificationFilters = { unread?: "1"; page: number };

export function readNotificationFilters(params: Record<string, string | string[] | undefined>): NotificationFilters {
  return { unread: readParam(params, "unread") === "1" ? "1" : undefined, page: readPage(params) };
}

export async function searchNotifications(userId: string, filters: NotificationFilters) {
  const where = and(eq(notifications.userId, userId), filters.unread ? isNull(notifications.readAt) : undefined);
  const [rows, [{ total }], unread] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(notifications).where(where),
    countUnread(userId),
  ]);
  return { rows, total, unread };
}

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

export async function countUnread(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row.total;
}
