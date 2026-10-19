"use server";

import { asc, eq } from "drizzle-orm";

import { diff, recordAudit } from "@/modules/audit/audit.service";
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function translate(error: unknown): never {
  if (error instanceof ActionError) throw error;
  if (pgErrorCode(error) === PG_ERRORS.UNIQUE) {
    throw new ActionError("CONFLICT", "Mã loại đơn đã tồn tại");
  }
  throw error;
}

export const createRequestType = adminProcedure
  .createServerAction()
  .input(requestTypeInput)
  .handler(async ({ input, ctx }) =>
    db
      .transaction(async (tx) => {
        const [created] = await tx.insert(requestTypes).values(input).returning({ id: requestTypes.id });
        await recordAudit(tx, ctx.user, {
          action: "REQUEST_TYPE_CREATED",
          targetType: "request_type",
          targetId: created.id,
          summary: `${input.code} – ${input.name}`,
          changes: input,
        });
        return created;
      })
      .catch(translate),
  );

async function lockType(tx: Tx, id: string) {
  const [type] = await tx.select().from(requestTypes).where(eq(requestTypes.id, id)).for("update");
  if (!type) throw new ActionError("NOT_FOUND", "Không tìm thấy loại đơn");
  return type;
}

export const updateRequestType = adminProcedure
  .createServerAction()
  .input(requestTypeUpdateInput)
  .handler(async ({ input: { id, ...values }, ctx }) => {
    await db
      .transaction(async (tx) => {
        const before = await lockType(tx, id);
        await tx.update(requestTypes).set(values).where(eq(requestTypes.id, id));
        await recordAudit(tx, ctx.user, {
          action: "REQUEST_TYPE_UPDATED",
          targetType: "request_type",
          targetId: id,
          summary: `${values.code} – ${values.name}`,
          changes: diff(before, values),
        });
      })
      .catch(translate);
  });

export const setRequestTypeActive = adminProcedure
  .createServerAction()
  .input(requestTypeActiveInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const before = await lockType(tx, input.id);
      await tx.update(requestTypes).set({ isActive: input.isActive }).where(eq(requestTypes.id, input.id));
      await recordAudit(tx, ctx.user, {
        action: input.isActive ? "REQUEST_TYPE_ACTIVATED" : "REQUEST_TYPE_DEACTIVATED",
        targetType: "request_type",
        targetId: input.id,
        summary: `${before.code} – ${before.name}`,
      });
    });
  });

export const saveFormSchema = adminProcedure
  .createServerAction()
  .input(formSchemaInput)
  .handler(async ({ input, ctx }) => {
    const { requestTypeId, fields } = input;
    const formSchema = fields.map((f) => (f.type === "select" ? f : { ...f, options: undefined }));
    await db.transaction(async (tx) => {
      const before = await lockType(tx, requestTypeId);
      await tx.update(requestTypes).set({ formSchema }).where(eq(requestTypes.id, requestTypeId));
      await recordAudit(tx, ctx.user, {
        action: "FORM_SCHEMA_SAVED",
        targetType: "request_type",
        targetId: requestTypeId,
        summary: `${before.code}: ${fields.length} trường (${fields.map((f) => f.label).join(", ")})`,
        changes: diff({ formSchema: before.formSchema }, { formSchema }),
      });
    });
  });

export const saveApprovalSteps = adminProcedure
  .createServerAction()
  .input(approvalStepsInput)
  .handler(async ({ input, ctx }) => {
    await db.transaction(async (tx) => {
      const type = await lockType(tx, input.requestTypeId);
      if (await hasPendingRequests(input.requestTypeId, tx)) {
        throw new ActionError(
          "PRECONDITION_FAILED",
          "Loại đơn đang có đơn chờ duyệt. Hãy đợi các đơn này xử lý xong rồi mới đổi bước duyệt.",
        );
      }
      const before = await tx
        .select({ name: approvalSteps.name, approverType: approvalSteps.approverType, approverRole: approvalSteps.approverRole })
        .from(approvalSteps)
        .where(eq(approvalSteps.requestTypeId, input.requestTypeId))
        .orderBy(asc(approvalSteps.stepOrder));
      await tx.delete(approvalSteps).where(eq(approvalSteps.requestTypeId, input.requestTypeId));
      const steps = input.steps.map((step, index) => ({
        requestTypeId: input.requestTypeId,
        stepOrder: index + 1,
        name: step.name,
        approverType: step.approverType,
        approverRole: step.approverRole,
      }));
      await tx.insert(approvalSteps).values(steps);
      await recordAudit(tx, ctx.user, {
        action: "APPROVAL_STEPS_SAVED",
        targetType: "request_type",
        targetId: input.requestTypeId,
        summary: `${type.code}: ${steps.map((s) => s.name).join(" → ")}`,
        changes: diff(
          { steps: before },
          { steps: input.steps.map(({ name, approverType, approverRole }) => ({ name, approverType, approverRole })) },
        ),
      });
    });
  });
