"use server";

import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator, type FormField } from "@/modules/request-types/request-types.validation";
import { ActionError, authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { deleteStoredFile, saveFile } from "@/shared/libs/storage.lib";

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  type RequestStatus,
} from "./requests.constant";
import { attachments, requestItems, requestRevisions, requests } from "./requests.schema";
import { isAllowedAttachmentName, resolveAttachmentType } from "./requests.service";
import {
  attachmentIdInput,
  attachmentUploadInput,
  type LineItemInput,
  requestDraftInput,
  requestDraftUpdateInput,
  requestIdInput,
} from "./requests.validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadActiveType(requestTypeId: string) {
  const [type] = await db
    .select({
      id: requestTypes.id,
      formSchema: requestTypes.formSchema,
      hasLineItems: requestTypes.hasLineItems,
    })
    .from(requestTypes)
    .where(and(eq(requestTypes.id, requestTypeId), eq(requestTypes.isActive, true)));
  if (!type) throw new ActionError("NOT_FOUND", "Loại đơn không tồn tại hoặc đã ngừng sử dụng");
  return type;
}

function parseDraftFormData(type: { formSchema: FormField[] }, formData: Record<string, unknown>) {
  const parsed = buildFormValidator(type.formSchema, { partial: true }).safeParse(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = type.formSchema.find((f) => f.key === issue?.path[0]);
    throw new ActionError(
      "UNPROCESSABLE_CONTENT",
      field ? `Trường "${field.label}" không hợp lệ: ${issue.message}` : "Dữ liệu biểu mẫu không hợp lệ",
    );
  }
  return parsed.data as Record<string, unknown>;
}

async function replaceItems(tx: Tx, requestId: string, items: LineItemInput[], hasLineItems: boolean) {
  await tx.delete(requestItems).where(eq(requestItems.requestId, requestId));
  if (hasLineItems && items.length > 0) {
    await tx.insert(requestItems).values(
      items.map((item, index) => ({
        requestId,
        sortOrder: index + 1,
        name: item.name,
        unit: item.unit,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    );
  }
  await tx
    .update(requests)
    .set({
      totalAmount: hasLineItems
        ? sql`(select coalesce(sum(${requestItems.amount}), 0) from ${requestItems} where ${requestItems.requestId} = ${requestId})`
        : null,
    })
    .where(eq(requests.id, requestId));
}

const EDITABLE: RequestStatus[] = ["DRAFT", "NEEDS_INFO"];

async function findOwnDraft(
  executor: Tx | typeof db,
  requestId: string,
  userId: string,
  lock = false,
  statuses: RequestStatus[] = ["DRAFT"],
) {
  const query = executor
    .select({ id: requests.id, requestTypeId: requests.requestTypeId, snapshot: requests.snapshot })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.requesterId, userId), inArray(requests.status, statuses)));
  const [request] = lock ? await query.for("update") : await query;
  if (!request) throw new ActionError("NOT_FOUND", "Không tìm thấy đơn nháp của bạn");
  return request;
}

export const createDraft = authedProcedure
  .createServerAction()
  .input(requestDraftInput)
  .handler(async ({ input, ctx }) => {
    const type = await loadActiveType(input.requestTypeId);
    const formData = parseDraftFormData(type, input.formData);

    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(requests)
        .values({
          requesterId: ctx.user.id,
          requestTypeId: type.id,
          departmentId: ctx.user.departmentId,
          title: input.title,
          reason: input.reason,
          formData,
        })
        .returning({ id: requests.id });
      await replaceItems(tx, created.id, input.items, type.hasLineItems);
      return created;
    });
  });

export const updateDraft = authedProcedure
  .createServerAction()
  .input(requestDraftUpdateInput)
  .handler(async ({ input, ctx }) => {
    const current = await findOwnDraft(db, input.id, ctx.user.id, false, EDITABLE);
    const type = current.snapshot ?? (await loadActiveType(current.requestTypeId));
    const formData = parseDraftFormData(type, input.formData);

    await db.transaction(async (tx) => {
      const draft = await findOwnDraft(tx, input.id, ctx.user.id, true, EDITABLE);
      await tx.update(requests).set({ title: input.title, reason: input.reason, formData }).where(eq(requests.id, draft.id));
      await replaceItems(tx, draft.id, input.items, type.hasLineItems);
    });
    return { id: input.id };
  });

export const deleteDraft = authedProcedure
  .createServerAction()
  .input(requestIdInput)
  .handler(async ({ input, ctx }) => {
    const files = await db.transaction(async (tx) => {
      const draft = await findOwnDraft(tx, input.requestId, ctx.user.id, true);
      const stored = await tx
        .select({ storageKey: attachments.storageKey })
        .from(attachments)
        .where(eq(attachments.requestId, draft.id));
      await tx.delete(requests).where(eq(requests.id, draft.id));
      return stored;
    });
    await Promise.all(files.map((f) => deleteStoredFile(f.storageKey)));
  });

export const uploadAttachment = authedProcedure
  .createServerAction()
  .input(attachmentUploadInput, { type: "formData" })
  .handler(async ({ input, ctx }) => saveAttachment(input.requestId, input.file, ctx.user.id));

async function saveAttachment(requestId: string, file: File, userId: string) {
  if (file.size === 0) throw new ActionError("UNPROCESSABLE_CONTENT", "Tệp rỗng");
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new ActionError("PAYLOAD_TOO_LARGE", "Tệp vượt quá 10 MB");
  }
  if (!isAllowedAttachmentName(file.name)) {
    throw new ActionError("UNPROCESSABLE_CONTENT", "Chỉ nhận PDF, ảnh, Word hoặc Excel");
  }
  await findOwnDraft(db, requestId, userId, false, EDITABLE);

  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = resolveAttachmentType(data, file.name);
  if (!mimeType) {
    throw new ActionError("UNPROCESSABLE_CONTENT", "Nội dung hoặc đuôi tệp không khớp với định dạng PDF, ảnh, Word hoặc Excel");
  }
  const storageKey = await saveFile(data);
  try {
    return await db.transaction(async (tx) => {
      const draft = await findOwnDraft(tx, requestId, userId, true, EDITABLE);
      const [{ total }] = await tx
        .select({ total: count() })
        .from(attachments)
        .where(and(eq(attachments.requestId, draft.id), isNull(attachments.removedAt)));
      if (total >= ATTACHMENT_MAX_COUNT) {
        throw new ActionError("PRECONDITION_FAILED", `Tối đa ${ATTACHMENT_MAX_COUNT} tệp mỗi đơn`);
      }
      const [created] = await tx
        .insert(attachments)
        .values({
          requestId: draft.id,
          fileName: file.name.slice(0, 255),
          storageKey,
          mimeType,
          sizeBytes: file.size,
          uploadedById: userId,
        })
        .returning({
          id: attachments.id,
          fileName: attachments.fileName,
          mimeType: attachments.mimeType,
          sizeBytes: attachments.sizeBytes,
          uploadedAt: attachments.uploadedAt,
        });
      return created;
    });
  } catch (error) {
    await deleteStoredFile(storageKey);
    throw error;
  }
}

export const deleteAttachment = authedProcedure
  .createServerAction()
  .input(attachmentIdInput)
  .handler(async ({ input, ctx }) => {
    const storageKey = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: attachments.id,
          requestId: attachments.requestId,
          storageKey: attachments.storageKey,
          uploadedAt: attachments.uploadedAt,
        })
        .from(attachments)
        .innerJoin(requests, eq(requests.id, attachments.requestId))
        .where(
          and(
            eq(attachments.id, input.attachmentId),
            isNull(attachments.removedAt),
            eq(requests.requesterId, ctx.user.id),
            inArray(requests.status, EDITABLE),
          ),
        )
        .for("update", { of: requests });
      if (!row) throw new ActionError("NOT_FOUND", "Không tìm thấy tệp");
      // A file that was part of a submitted version is evidence: keep it and only hide it from the new version.
      const [submitted] = await tx
        .select({ id: requestRevisions.id })
        .from(requestRevisions)
        .where(and(eq(requestRevisions.requestId, row.requestId), gte(requestRevisions.createdAt, row.uploadedAt)))
        .limit(1);
      if (submitted) {
        await tx
          .update(attachments)
          .set({ removedAt: new Date(), removedById: ctx.user.id })
          .where(eq(attachments.id, row.id));
        return null;
      }
      await tx.delete(attachments).where(eq(attachments.id, row.id));
      return row.storageKey;
    });
    if (storageKey) await deleteStoredFile(storageKey);
  });
