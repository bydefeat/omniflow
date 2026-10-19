"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";

import { countUnread, listNotifications } from "./notifications.query";
import { notifications } from "./notifications.schema";

export const getNotificationSummary = authedProcedure
  .createServerAction()
  .handler(async ({ ctx }) => {
    const [unread, latest] = await Promise.all([countUnread(ctx.user.id), listNotifications(ctx.user.id, 8)]);
    return { unread, latest };
  });

export const markNotificationRead = authedProcedure
  .createServerAction()
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, ctx }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)),
      );
  });

export const markAllNotificationsRead = authedProcedure
  .createServerAction()
  .handler(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  });
