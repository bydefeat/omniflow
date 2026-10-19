import { and, asc, count, desc, eq, ne } from "drizzle-orm";

import { departments } from "@/modules/departments/departments.schema";
import { requestTypes } from "@/modules/request-types/request-types.schema";
import { user } from "@/modules/users/users.schema";
import { db } from "@/shared/libs/db.lib";

import type { RequestStatus } from "./requests.constant";
import { attachments, requestItems, requests } from "./requests.schema";

const attachmentColumns = {
  id: attachments.id,
  fileName: attachments.fileName,
  mimeType: attachments.mimeType,
  sizeBytes: attachments.sizeBytes,
  uploadedAt: attachments.uploadedAt,
};

async function loadChildren(requestId: string) {
  const [items, files] = await Promise.all([
    db
      .select({
        id: requestItems.id,
        name: requestItems.name,
        unit: requestItems.unit,
        quantity: requestItems.quantity,
        unitPrice: requestItems.unitPrice,
        amount: requestItems.amount,
      })
      .from(requestItems)
      .where(eq(requestItems.requestId, requestId))
      .orderBy(asc(requestItems.sortOrder)),
    db
      .select(attachmentColumns)
      .from(attachments)
      .where(eq(attachments.requestId, requestId))
      .orderBy(asc(attachments.uploadedAt)),
  ]);
  return { items, attachments: files };
}

export async function getDraftForEdit(requestId: string, userId: string) {
  const [request] = await db
    .select({
      id: requests.id,
      requestTypeId: requests.requestTypeId,
      title: requests.title,
      reason: requests.reason,
      formData: requests.formData,
    })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.requesterId, userId), eq(requests.status, "DRAFT")));
  if (!request) return null;
  return { ...request, ...(await loadChildren(requestId)) };
}

export type DraftForEdit = NonNullable<Awaited<ReturnType<typeof getDraftForEdit>>>;

export async function getRequestDetail(requestId: string) {
  const [request] = await db
    .select({
      id: requests.id,
      code: requests.code,
      title: requests.title,
      reason: requests.reason,
      formData: requests.formData,
      totalAmount: requests.totalAmount,
      status: requests.status,
      submittedAt: requests.submittedAt,
      completedAt: requests.completedAt,
      createdAt: requests.createdAt,
      requesterId: requests.requesterId,
      requesterName: user.name,
      requesterCode: user.employeeCode,
      departmentName: departments.name,
      requestTypeId: requests.requestTypeId,
      typeName: requestTypes.name,
      formSchema: requestTypes.formSchema,
      hasLineItems: requestTypes.hasLineItems,
    })
    .from(requests)
    .innerJoin(user, eq(user.id, requests.requesterId))
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .leftJoin(departments, eq(departments.id, requests.departmentId))
    .where(eq(requests.id, requestId));
  if (!request) return null;
  return { ...request, ...(await loadChildren(requestId)) };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>;

const listColumns = {
  id: requests.id,
  code: requests.code,
  title: requests.title,
  status: requests.status,
  totalAmount: requests.totalAmount,
  submittedAt: requests.submittedAt,
  updatedAt: requests.updatedAt,
  requestTypeId: requests.requestTypeId,
  typeName: requestTypes.name,
};

export async function listMyRequests(userId: string, limit?: number) {
  const query = db
    .select(listColumns)
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .where(eq(requests.requesterId, userId))
    .orderBy(desc(requests.updatedAt));
  return limit ? query.limit(limit) : query;
}

export type MyRequestRow = Awaited<ReturnType<typeof listMyRequests>>[number];

export async function countMyRequestsByStatus(userId: string) {
  const rows = await db
    .select({ status: requests.status, total: count() })
    .from(requests)
    .where(eq(requests.requesterId, userId))
    .groupBy(requests.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.total])) as Partial<Record<RequestStatus, number>>;
}

export async function listAllRequests() {
  return db
    .select({
      ...listColumns,
      requesterName: user.name,
      requesterCode: user.employeeCode,
      departmentId: requests.departmentId,
      departmentName: departments.name,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .innerJoin(user, eq(user.id, requests.requesterId))
    .leftJoin(departments, eq(departments.id, requests.departmentId))
    .where(ne(requests.status, "DRAFT"))
    .orderBy(desc(requests.submittedAt));
}

export type AdminRequestRow = Awaited<ReturnType<typeof listAllRequests>>[number];

export async function getAttachment(attachmentId: string) {
  const [row] = await db
    .select({
      id: attachments.id,
      requestId: attachments.requestId,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      storageKey: attachments.storageKey,
    })
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  return row ?? null;
}
