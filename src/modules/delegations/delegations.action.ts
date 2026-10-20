"use server";

import { and, eq, inArray, sql } from "drizzle-orm";

import { recordAudit } from "@/modules/audit/audit.service";
import { user } from "@/modules/users/users.schema";
import { ROLES } from "@/shared/constants/role.constant";
import { ActionError, authedProcedure, roleProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";

import { canDelegate } from "./delegations.query";
import { delegations } from "./delegations.schema";
import {
  adminDelegationInput,
  delegationIdInput,
  type DelegationInput,
  delegationInput,
} from "./delegations.validation";

type Executor = Pick<typeof db, "select" | "insert">;

async function insertDelegation(executor: Executor, delegatorId: string, input: DelegationInput) {
  if (!(await canDelegate(delegatorId))) {
    throw new ActionError("FORBIDDEN", "Người ủy quyền không có quyền phê duyệt nên không thể ủy quyền");
  }
  if (new Date(input.endsAt) <= new Date()) {
    throw new ActionError("UNPROCESSABLE_CONTENT", "Thời điểm kết thúc phải ở tương lai");
  }
  if (input.delegateId === delegatorId) {
    throw new ActionError("UNPROCESSABLE_CONTENT", "Không thể tự ủy quyền cho chính mình");
  }
  const people = await executor
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(inArray(user.id, [delegatorId, input.delegateId]), sql`${user.banned} is not true`));
  const delegator = people.find((p) => p.id === delegatorId);
  const delegate = people.find((p) => p.id === input.delegateId);
  if (!delegate) throw new ActionError("NOT_FOUND", "Người được ủy quyền không tồn tại hoặc đã bị khóa");
  if (!delegator) throw new ActionError("NOT_FOUND", "Người ủy quyền không tồn tại hoặc đã bị khóa");

  const [created] = await executor
    .insert(delegations)
    .values({
      delegatorId,
      delegateId: input.delegateId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason,
    })
    .returning({ id: delegations.id })
    .catch((error) => {
      if (pgErrorCode(error) === PG_ERRORS.EXCLUSION) {
        throw new ActionError("CONFLICT", "Người ủy quyền đã có một ủy quyền khác trùng khoảng thời gian này");
      }
      throw error;
    });
  return { id: created.id, delegatorName: delegator.name, delegateName: delegate.name };
}

export const createDelegation = authedProcedure
  .createServerAction()
  .input(delegationInput)
  .handler(async ({ input, ctx }) => {
    await insertDelegation(db, ctx.user.id, input);
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
    if (updated.length === 0) throw new ActionError("NOT_FOUND", "Không tìm thấy ủy quyền còn hiệu lực");
  });

const adminProcedure = roleProcedure(ROLES.ADMIN);

export const adminCreateDelegation = adminProcedure
  .createServerAction()
  .input(adminDelegationInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const { delegatorId, ...rest } = input;
      const created = await insertDelegation(tx, delegatorId, rest);
      await recordAudit(tx, ctx.user, {
        action: "DELEGATION_CREATED",
        targetType: "delegation",
        targetId: created.id,
        summary: `${created.delegatorName} → ${created.delegateName}: ${input.reason}`,
        changes: { delegatorId, delegateId: input.delegateId, startsAt: input.startsAt, endsAt: input.endsAt },
      });
    });
  });

export const adminCancelDelegation = adminProcedure
  .createServerAction()
  .input(delegationIdInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(delegations)
        .set({ status: "CANCELLED" })
        .where(
          and(eq(delegations.id, input.id), eq(delegations.status, "ACTIVE"), sql`${delegations.endsAt} > now()`),
        )
        .returning({ id: delegations.id, reason: delegations.reason });
      if (!updated) throw new ActionError("NOT_FOUND", "Không tìm thấy ủy quyền còn hiệu lực");
      await recordAudit(tx, ctx.user, {
        action: "DELEGATION_CANCELLED",
        targetType: "delegation",
        targetId: updated.id,
        summary: updated.reason,
      });
    });
  });
