"use server";

import { eq, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { ROLES } from "@/shared/constants/role.constant";
import { ActionError, roleProcedure } from "@/shared/libs/action.lib";
import { auth } from "@/shared/libs/auth.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";
import { serializeRoles } from "@/shared/libs/role.lib";

import { departments } from "@/modules/departments/departments.schema";

import { user } from "./users.schema";
import {
  userBanInput,
  userCreateInput,
  userPasswordInput,
  userUpdateInput,
} from "./users.validation";

const adminProcedure = roleProcedure(ROLES.ADMIN);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function assertAssignable(
  executor: Tx | typeof db,
  input: { departmentId: string; managerId: string | null },
  currentManagerId?: string | null,
) {
  const [department] = await executor
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, input.departmentId));
  if (!department) throw new ActionError("UNPROCESSABLE_CONTENT", "Phòng ban được chọn không tồn tại");
  if (!input.managerId || input.managerId === currentManagerId) return;
  const [manager] = await executor
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, input.managerId));
  if (!manager) throw new ActionError("UNPROCESSABLE_CONTENT", "Quản lý được chọn không tồn tại");
  if (manager.banned) throw new ActionError("UNPROCESSABLE_CONTENT", "Quản lý được chọn đang bị khóa tài khoản");
}

async function assertNoManagerCycle(tx: Tx, userId: string, managerId: string | null) {
  if (!managerId) return;
  if (managerId === userId) {
    throw new ActionError("UNPROCESSABLE_CONTENT", "Người dùng không thể tự quản lý chính mình");
  }
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('omniflow:user-manager'))`);
  const rows = await tx.select({ id: user.id, managerId: user.managerId }).from(user);
  const managerOf = new Map(rows.map((r) => [r.id, r.managerId]));
  const seen = new Set<string>();
  let current: string | null | undefined = managerId;
  while (current && !seen.has(current)) {
    if (current === userId) {
      throw new ActionError(
        "UNPROCESSABLE_CONTENT",
        "Quan hệ quản lý bị vòng lặp: người được chọn đang do người dùng này quản lý (trực tiếp hoặc gián tiếp)",
      );
    }
    seen.add(current);
    current = managerOf.get(current);
  }
}

export const createUser = adminProcedure
  .createServerAction()
  .input(userCreateInput)
  .handler(async ({ input }) => {
    const [taken] = await db
      .select({ email: user.email, employeeCode: user.employeeCode })
      .from(user)
      .where(or(eq(user.email, input.email), eq(user.employeeCode, input.employeeCode)));
    if (taken) {
      throw new ActionError(
        "CONFLICT",
        taken.email === input.email ? "Email đã được sử dụng" : "Mã nhân viên đã tồn tại",
      );
    }
    await assertAssignable(db, input);

    await auth.api.createUser({
      headers: await headers(),
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        data: {
          role: serializeRoles(input.roles),
          employeeCode: input.employeeCode,
          departmentId: input.departmentId,
          managerId: input.managerId,
        },
      },
    });
  });

export const updateUser = adminProcedure
  .createServerAction()
  .input(userUpdateInput)
  .handler(async ({ input, ctx }) => {
    if (input.id === ctx.user.id && !input.roles.includes(ROLES.ADMIN)) {
      throw new ActionError("UNPROCESSABLE_CONTENT", "Không thể tự gỡ vai trò quản trị của chính mình");
    }
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ managerId: user.managerId }).from(user).where(eq(user.id, input.id));
      if (!current) throw new ActionError("NOT_FOUND", "Không tìm thấy người dùng");
      await assertAssignable(tx, input, current.managerId);
      await assertNoManagerCycle(tx, input.id, input.managerId);

      await tx
        .update(user)
        .set({
          name: input.name,
          employeeCode: input.employeeCode,
          departmentId: input.departmentId,
          managerId: input.managerId,
          role: serializeRoles(input.roles).join(","),
        })
        .where(eq(user.id, input.id))
        .catch((error) => {
          if (pgErrorCode(error) === PG_ERRORS.UNIQUE) throw new ActionError("CONFLICT", "Mã nhân viên đã tồn tại");
          throw error;
        });
    });
  });

export const setUserBanned = adminProcedure
  .createServerAction()
  .input(userBanInput)
  .handler(async ({ input, ctx }) => {
    if (input.userId === ctx.user.id) {
      throw new ActionError("UNPROCESSABLE_CONTENT", "Không thể tự khóa tài khoản của chính mình");
    }
    const requestHeaders = await headers();
    if (input.banned) {
      await auth.api.banUser({
        headers: requestHeaders,
        body: { userId: input.userId, banReason: input.reason },
      });
    } else {
      await auth.api.unbanUser({ headers: requestHeaders, body: { userId: input.userId } });
    }
  });

export const setUserPassword = adminProcedure
  .createServerAction()
  .input(userPasswordInput)
  .handler(async ({ input, ctx }) => {
    const requestHeaders = await headers();
    await auth.api.setUserPassword({
      headers: requestHeaders,
      body: { userId: input.userId, newPassword: input.newPassword },
    });
    if (input.userId === ctx.user.id) {
      await auth.api.revokeOtherSessions({ headers: requestHeaders });
    } else {
      await auth.api.revokeUserSessions({ headers: requestHeaders, body: { userId: input.userId } });
    }
  });
