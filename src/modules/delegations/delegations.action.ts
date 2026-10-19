"use server";

import { and, eq, sql } from "drizzle-orm";
import { ZSAError } from "zsa";

import { user } from "@/modules/users/users.schema";
import { authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";

import { canDelegate } from "./delegations.query";
import { delegations } from "./delegations.schema";
import { type DelegationInput, delegationIdInput, delegationInput } from "./delegations.validation";

export const createDelegation = authedProcedure
  .createServerAction()
  .input(delegationInput)
  .handler(async ({ input: rawInput, ctx }) => {
    const input = rawInput as DelegationInput;
    if (!(await canDelegate(ctx.user.id, ctx.user.role))) {
      throw new ZSAError("FORBIDDEN", "Bạn không có quyền phê duyệt nên không thể ủy quyền");
    }
    if (new Date(input.endsAt) <= new Date()) {
      throw new ZSAError("UNPROCESSABLE_CONTENT", "Thời điểm kết thúc phải ở tương lai");
    }
    if (input.delegateId === ctx.user.id) {
      throw new ZSAError("UNPROCESSABLE_CONTENT", "Không thể tự ủy quyền cho chính mình");
    }
    const [delegate] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, input.delegateId), sql`${user.banned} is not true`));
    if (!delegate) throw new ZSAError("NOT_FOUND", "Người được ủy quyền không tồn tại hoặc đã bị khóa");

    await db
      .insert(delegations)
      .values({
        delegatorId: ctx.user.id,
        delegateId: input.delegateId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        reason: input.reason,
      })
      .catch((error) => {
        if (pgErrorCode(error) === PG_ERRORS.EXCLUSION) {
          throw new ZSAError("CONFLICT", "Bạn đã có một ủy quyền khác trùng khoảng thời gian này");
        }
        throw error;
      });
  });

export const cancelDelegation = authedProcedure
  .createServerAction()
  .input(delegationIdInput)
  .handler(async ({ input, ctx }) => {
    const updated = await db
      .update(delegations)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(delegations.id, input.id),
          eq(delegations.delegatorId, ctx.user.id),
          eq(delegations.status, "ACTIVE"),
          sql`${delegations.endsAt} > now()`,
        ),
      )
      .returning({ id: delegations.id });
    if (updated.length === 0) throw new ZSAError("NOT_FOUND", "Không tìm thấy ủy quyền còn hiệu lực");
  });
