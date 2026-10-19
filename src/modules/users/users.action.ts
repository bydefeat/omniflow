"use server";

import { eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { ZSAError } from "zsa";

import { ROLES } from "@/shared/constants/role.constant";
import { roleProcedure } from "@/shared/libs/action.lib";
import { auth } from "@/shared/libs/auth.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";
import { serializeRoles } from "@/shared/libs/role.lib";

import { user } from "./users.schema";
import {
  userBanInput,
  userCreateInput,
  userPasswordInput,
  userUpdateInput,
} from "./users.validation";

const adminProcedure = roleProcedure(ROLES.ADMIN);

async function assertNoManagerCycle(userId: string, managerId: string | null) {
  if (!managerId) return;
  if (managerId === userId) {
    throw new ZSAError("UNPROCESSABLE_CONTENT", "Người dùng không thể tự quản lý chính mình");
  }
  const rows = await db.select({ id: user.id, managerId: user.managerId }).from(user);
  const managerOf = new Map(rows.map((r) => [r.id, r.managerId]));
  const seen = new Set<string>();
  let current: string | null | undefined = managerId;
  while (current && !seen.has(current)) {
    if (current === userId) {
      throw new ZSAError(
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
      throw new ZSAError(
        "CONFLICT",
        taken.email === input.email ? "Email đã được sử dụng" : "Mã nhân viên đã tồn tại",
      );
    }

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
      throw new ZSAError("UNPROCESSABLE_CONTENT", "Không thể tự gỡ vai trò quản trị của chính mình");
    }
    await assertNoManagerCycle(input.id, input.managerId);

    const updated = await db
      .update(user)
      .set({
        name: input.name,
        employeeCode: input.employeeCode,
        departmentId: input.departmentId,
        managerId: input.managerId,
        role: serializeRoles(input.roles).join(","),
      })
      .where(eq(user.id, input.id))
      .returning({ id: user.id })
      .catch((error) => {
        const code = pgErrorCode(error);
        if (code === PG_ERRORS.UNIQUE) throw new ZSAError("CONFLICT", "Mã nhân viên đã tồn tại");
        if (code === PG_ERRORS.FOREIGN_KEY) {
          throw new ZSAError("UNPROCESSABLE_CONTENT", "Phòng ban hoặc quản lý được chọn không tồn tại");
        }
        throw error;
      });
    if (updated.length === 0) throw new ZSAError("NOT_FOUND", "Không tìm thấy người dùng");
  });

export const setUserBanned = adminProcedure
  .createServerAction()
  .input(userBanInput)
  .handler(async ({ input, ctx }) => {
    if (input.userId === ctx.user.id) {
      throw new ZSAError("UNPROCESSABLE_CONTENT", "Không thể tự khóa tài khoản của chính mình");
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
  .handler(async ({ input }) => {
    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId: input.userId, newPassword: input.newPassword },
    });
  });
