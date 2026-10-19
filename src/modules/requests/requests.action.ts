"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { ZSAError } from "zsa";

import { requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator } from "@/modules/request-types/request-types.validation";
import { authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { deleteStoredFile, saveFile } from "@/shared/libs/storage.lib";

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MIME_TYPES,
} from "./requests.constant";
import { attachments, requestItems, requests } from "./requests.schema";
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
  if (!type) throw new ZSAError("NOT_FOUND", "Loại đơn không tồn tại hoặc đã ngừng sử dụng");
  return type;
}

function parseDraftFormData(type: Awaited<ReturnType<typeof loadActiveType>>, formData: Record<string, unknown>) {
  const parsed = buildFormValidator(type.formSchema, { partial: true }).safeParse(formData);
  if (!parsed.success) {
    throw new ZSAError("UNPROCESSABLE_CONTENT", "Dữ liệu biểu mẫu không hợp lệ");
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

async function findOwnDraft(requestId: string, userId: string) {
  const [request] = await db
    .select({ id: requests.id, requestTypeId: requests.requestTypeId })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.requesterId, userId), eq(requests.status, "DRAFT")));
  if (!request) throw new ZSAError("NOT_FOUND", "Không tìm thấy đơn nháp của bạn");
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
    const draft = await findOwnDraft(input.id, ctx.user.id);
    const type = await loadActiveType(draft.requestTypeId);
    const formData = parseDraftFormData(type, input.formData);

    await db.transaction(async (tx) => {
      await tx
        .update(requests)
        .set({ title: input.title, reason: input.reason, formData })
        .where(and(eq(requests.id, draft.id), eq(requests.status, "DRAFT")));
      await replaceItems(tx, draft.id, input.items, type.hasLineItems);
    });
    return { id: draft.id };
  });

export const deleteDraft = authedProcedure
  .createServerAction()
  .input(requestIdInput)
  .handler(async ({ input, ctx }) => {
    const draft = await findOwnDraft(input.requestId, ctx.user.id);
    const files = await db
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(eq(attachments.requestId, draft.id));
    await db.delete(requests).where(and(eq(requests.id, draft.id), eq(requests.status, "DRAFT")));
    await Promise.all(files.map((f) => deleteStoredFile(f.storageKey)));
  });

export const uploadAttachment = authedProcedure
  .createServerAction()
  .input(attachmentUploadInput, { type: "formData" })
  .handler(async ({ input, ctx }) => {
    const draft = await findOwnDraft(input.requestId, ctx.user.id);
    const { file } = input;
    if (file.size === 0) throw new ZSAError("UNPROCESSABLE_CONTENT", "Tệp rỗng");
    if (file.size > ATTACHMENT_MAX_BYTES) {
      throw new ZSAError("PAYLOAD_TOO_LARGE", "Tệp vượt quá 10 MB");
    }
    if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
      throw new ZSAError("UNPROCESSABLE_CONTENT", "Chỉ nhận PDF, ảnh, Word hoặc Excel");
    }
    const [{ total }] = await db
      .select({ total: count() })
      .from(attachments)
      .where(eq(attachments.requestId, draft.id));
    if (total >= ATTACHMENT_MAX_COUNT) {
      throw new ZSAError("PRECONDITION_FAILED", `Tối đa ${ATTACHMENT_MAX_COUNT} tệp mỗi đơn`);
    }

    const storageKey = await saveFile(new Uint8Array(await file.arrayBuffer()));
    const [created] = await db
      .insert(attachments)
      .values({
        requestId: draft.id,
        fileName: file.name.slice(0, 255),
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: ctx.user.id,
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

export const deleteAttachment = authedProcedure
  .createServerAction()
  .input(attachmentIdInput)
  .handler(async ({ input, ctx }) => {
    const [row] = await db
      .select({ id: attachments.id, storageKey: attachments.storageKey })
      .from(attachments)
      .innerJoin(requests, eq(requests.id, attachments.requestId))
      .where(
        and(
          eq(attachments.id, input.attachmentId),
          eq(requests.requesterId, ctx.user.id),
          eq(requests.status, "DRAFT"),
        ),
      );
    if (!row) throw new ZSAError("NOT_FOUND", "Không tìm thấy tệp");
    await db.delete(attachments).where(eq(attachments.id, row.id));
    await deleteStoredFile(row.storageKey);
  });
