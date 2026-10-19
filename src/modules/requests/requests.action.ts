"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { ZSAError } from "zsa";

import { requestTypes } from "@/modules/request-types/request-types.schema";
import { buildFormValidator } from "@/modules/request-types/request-types.validation";
import { authedProcedure } from "@/shared/libs/action.lib";
import { db } from "@/shared/libs/db.lib";
import { getSession } from "@/shared/libs/session.lib";
import { deleteStoredFile, saveFile } from "@/shared/libs/storage.lib";

import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
} from "./requests.constant";
import { attachments, requestItems, requests } from "./requests.schema";
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
  if (!type) throw new ZSAError("NOT_FOUND", "Loại đơn không tồn tại hoặc đã ngừng sử dụng");
  return type;
}

function parseDraftFormData(type: Awaited<ReturnType<typeof loadActiveType>>, formData: Record<string, unknown>) {
  const parsed = buildFormValidator(type.formSchema, { partial: true }).safeParse(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = type.formSchema.find((f) => f.key === issue?.path[0]);
    throw new ZSAError(
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

async function findOwnDraft(executor: Tx | typeof db, requestId: string, userId: string, lock = false) {
  const query = executor
    .select({ id: requests.id, requestTypeId: requests.requestTypeId })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.requesterId, userId), eq(requests.status, "DRAFT")));
  const [request] = lock ? await query.for("update") : await query;
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
    const { requestTypeId } = await findOwnDraft(db, input.id, ctx.user.id);
    const type = await loadActiveType(requestTypeId);
    const formData = parseDraftFormData(type, input.formData);

    await db.transaction(async (tx) => {
      const draft = await findOwnDraft(tx, input.id, ctx.user.id, true);
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

type UploadError = { code: string; message: string };

export async function uploadAttachment(
  formData: FormData,
): Promise<readonly [AttachmentResult, null] | readonly [null, UploadError]> {
  const session = await getSession();
  if (!session) return [null, { code: "NOT_AUTHORIZED", message: "Phiên đăng nhập đã hết hạn" }];

  const parsed = attachmentUploadInput.safeParse({
    requestId: formData.get("requestId"),
    file: formData.get("file"),
  });
  if (!parsed.success) return [null, { code: "INPUT_PARSE_ERROR", message: "Dữ liệu tải lên không hợp lệ" }];

  try {
    return [await saveAttachment(parsed.data.requestId, parsed.data.file, session.user.id), null];
  } catch (error) {
    if (error instanceof ZSAError) {
      return [null, { code: error.code, message: typeof error.data === "string" ? error.data : error.message }];
    }
    throw error;
  }
}

type AttachmentResult = Awaited<ReturnType<typeof saveAttachment>>;

async function saveAttachment(requestId: string, file: File, userId: string) {
  if (file.size === 0) throw new ZSAError("UNPROCESSABLE_CONTENT", "Tệp rỗng");
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new ZSAError("PAYLOAD_TOO_LARGE", "Tệp vượt quá 10 MB");
  }
  if (!isAllowedAttachmentName(file.name)) {
    throw new ZSAError("UNPROCESSABLE_CONTENT", "Chỉ nhận PDF, ảnh, Word hoặc Excel");
  }
  await findOwnDraft(db, requestId, userId);

  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = resolveAttachmentType(data, file.name);
  if (!mimeType) {
    throw new ZSAError("UNPROCESSABLE_CONTENT", "Nội dung hoặc đuôi tệp không khớp với định dạng PDF, ảnh, Word hoặc Excel");
  }
  const storageKey = await saveFile(data);
  try {
    return await db.transaction(async (tx) => {
      const draft = await findOwnDraft(tx, requestId, userId, true);
      const [{ total }] = await tx
        .select({ total: count() })
        .from(attachments)
        .where(eq(attachments.requestId, draft.id));
      if (total >= ATTACHMENT_MAX_COUNT) {
        throw new ZSAError("PRECONDITION_FAILED", `Tối đa ${ATTACHMENT_MAX_COUNT} tệp mỗi đơn`);
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
        .select({ id: attachments.id, storageKey: attachments.storageKey })
        .from(attachments)
        .innerJoin(requests, eq(requests.id, attachments.requestId))
        .where(
          and(
            eq(attachments.id, input.attachmentId),
            eq(requests.requesterId, ctx.user.id),
            eq(requests.status, "DRAFT"),
          ),
        )
        .for("update", { of: requests });
      if (!row) throw new ZSAError("NOT_FOUND", "Không tìm thấy tệp");
      await tx.delete(attachments).where(eq(attachments.id, row.id));
      return row.storageKey;
    });
    await deleteStoredFile(storageKey);
  });
