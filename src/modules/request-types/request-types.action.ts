"use server";

import { eq } from "drizzle-orm";

import { ROLES } from "@/shared/constants/role.constant";
import { ActionError, roleProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { PG_ERRORS, pgErrorCode } from "@/shared/libs/db-error.lib";

import { hasPendingRequests } from "./request-types.query";
import { approvalSteps, requestTypes } from "./request-types.schema";
import {
  approvalStepsInput,
  formSchemaInput,
  requestTypeActiveInput,
  requestTypeInput,
  requestTypeUpdateInput,
} from "./request-types.validation";

const adminProcedure = roleProcedure(ROLES.ADMIN);

function translate(error: unknown): never {
  if (pgErrorCode(error) === PG_ERRORS.UNIQUE) {
    throw new ActionError("CONFLICT", "Mã loại đơn đã tồn tại");
  }
  throw error;
}

export const createRequestType = adminProcedure
  .createServerAction()
  .input(requestTypeInput)
  .handler(async ({ input }) => {
    const [created] = await db
      .insert(requestTypes)
      .values(input)
      .returning({ id: requestTypes.id })
      .catch(translate);
    return created;
  });

export const updateRequestType = adminProcedure
  .createServerAction()
  .input(requestTypeUpdateInput)
  .handler(async ({ input: { id, ...values } }) => {
    const updated = await db
      .update(requestTypes)
      .set(values)
      .where(eq(requestTypes.id, id))
      .returning({ id: requestTypes.id })
      .catch(translate);
    if (updated.length === 0) throw new ActionError("NOT_FOUND", "Không tìm thấy loại đơn");
  });

export const setRequestTypeActive = adminProcedure
  .createServerAction()
  .input(requestTypeActiveInput)
  .handler(async ({ input }) => {
    await db
      .update(requestTypes)
      .set({ isActive: input.isActive })
      .where(eq(requestTypes.id, input.id));
  });

export const saveFormSchema = adminProcedure
  .createServerAction()
  .input(formSchemaInput)
  .handler(async ({ input }) => {
    const { requestTypeId, fields } = input;
    await db
      .update(requestTypes)
      .set({
        formSchema: fields.map((f) => (f.type === "select" ? f : { ...f, options: undefined })),
      })
      .where(eq(requestTypes.id, requestTypeId));
  });

export const saveApprovalSteps = adminProcedure
  .createServerAction()
  .input(approvalStepsInput)
  .handler(async ({ input }) => {
    await db.transaction(async (tx) => {
      const [type] = await tx
        .select({ id: requestTypes.id })
        .from(requestTypes)
        .where(eq(requestTypes.id, input.requestTypeId))
        .for("update");
      if (!type) throw new ActionError("NOT_FOUND", "Không tìm thấy loại đơn");
      if (await hasPendingRequests(input.requestTypeId, tx)) {
        throw new ActionError(
          "PRECONDITION_FAILED",
          "Loại đơn đang có đơn chờ duyệt. Hãy đợi các đơn này xử lý xong rồi mới đổi bước duyệt.",
        );
      }
      await tx.delete(approvalSteps).where(eq(approvalSteps.requestTypeId, input.requestTypeId));
      await tx.insert(approvalSteps).values(
        input.steps.map((step, index) => ({
          requestTypeId: input.requestTypeId,
          stepOrder: index + 1,
          name: step.name,
          approverType: step.approverType,
          approverRole: step.approverRole,
        })),
      );
    });
  });
