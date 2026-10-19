"use server";

import { eq } from "drizzle-orm";
import { ZSAError } from "zsa";

import { ROLES } from "@/shared/constants/role.constant";
import { roleProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";

import { departments } from "./departments.schema";
import {
  departmentIdInput,
  departmentInput,
  departmentUpdateInput,
} from "./departments.validation";

const adminProcedure = roleProcedure(ROLES.ADMIN);

function translate(error: unknown): never {
  const code = pgErrorCode(error);
  if (code === PG_ERRORS.UNIQUE) {
    throw new ZSAError("CONFLICT", "Mã phòng ban đã tồn tại");
  }
  if (code === PG_ERRORS.FOREIGN_KEY) {
    throw new ZSAError(
      "PRECONDITION_FAILED",
      "Phòng ban đang có người dùng hoặc đơn yêu cầu, không thể xóa",
    );
  }
  throw error;
}

export const createDepartment = adminProcedure
  .createServerAction()
  .input(departmentInput)
  .handler(async ({ input }) => {
    await db.insert(departments).values(input).catch(translate);
  });

export const updateDepartment = adminProcedure
  .createServerAction()
  .input(departmentUpdateInput)
  .handler(async ({ input: { id, ...values } }) => {
    const updated = await db
      .update(departments)
      .set(values)
      .where(eq(departments.id, id))
      .returning({ id: departments.id })
      .catch(translate);
    if (updated.length === 0) throw new ZSAError("NOT_FOUND", "Không tìm thấy phòng ban");
  });

export const deleteDepartment = adminProcedure
  .createServerAction()
  .input(departmentIdInput)
  .handler(async ({ input }) => {
    await db
      .delete(departments)
      .where(eq(departments.id, input.id))
      .catch(translate);
  });
