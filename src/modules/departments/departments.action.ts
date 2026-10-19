"use server";

import { eq } from "drizzle-orm";

import { diff, recordAudit } from "@/modules/audit/audit.service";
import { ROLES } from "@/shared/constants/role.constant";
import { ActionError, roleProcedure } from "@/shared/libs/action.lib";
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
  if (error instanceof ActionError) throw error;
  const code = pgErrorCode(error);
  if (code === PG_ERRORS.UNIQUE) {
    throw new ActionError("CONFLICT", "Mã phòng ban đã tồn tại");
  }
  if (code === PG_ERRORS.FOREIGN_KEY) {
    throw new ActionError(
      "PRECONDITION_FAILED",
      "Phòng ban đang có người dùng hoặc đơn yêu cầu, không thể xóa",
    );
  }
  throw error;
}

export const createDepartment = adminProcedure
  .createServerAction()
  .input(departmentInput)
  .handler(async ({ input, ctx }) => {
    await db
      .transaction(async (tx) => {
        const [created] = await tx.insert(departments).values(input).returning({ id: departments.id });
        await recordAudit(tx, ctx.user, {
          action: "DEPARTMENT_CREATED",
          targetType: "department",
          targetId: created.id,
          summary: `${input.code} – ${input.name}`,
          changes: input,
        });
      })
      .catch(translate);
  });

export const updateDepartment = adminProcedure
  .createServerAction()
  .input(departmentUpdateInput)
  .handler(async ({ input: { id, ...values }, ctx }) => {
    await db
      .transaction(async (tx) => {
        const [before] = await tx.select().from(departments).where(eq(departments.id, id)).for("update");
        if (!before) throw new ActionError("NOT_FOUND", "Không tìm thấy phòng ban");
        await tx.update(departments).set(values).where(eq(departments.id, id));
        await recordAudit(tx, ctx.user, {
          action: "DEPARTMENT_UPDATED",
          targetType: "department",
          targetId: id,
          summary: `${values.code} – ${values.name}`,
          changes: diff(before, values),
        });
      })
      .catch(translate);
  });

export const deleteDepartment = adminProcedure
  .createServerAction()
  .input(departmentIdInput)
  .handler(async ({ input, ctx }) => {
    await db
      .transaction(async (tx) => {
        const [deleted] = await tx.delete(departments).where(eq(departments.id, input.id)).returning();
        if (!deleted) throw new ActionError("NOT_FOUND", "Không tìm thấy phòng ban");
        await recordAudit(tx, ctx.user, {
          action: "DEPARTMENT_DELETED",
          targetType: "department",
          targetId: deleted.id,
          summary: `${deleted.code} – ${deleted.name}`,
          changes: { code: deleted.code, name: deleted.name, phone: deleted.phone },
        });
      })
      .catch(translate);
  });
