import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { departments } from "@/modules/departments/departments.schema";
import { requestTypes } from "@/modules/request-types/request-types.schema";
import { user } from "@/modules/users/users.schema";
import { db } from "@/shared/libs/db.lib";
import { escapeLike, PAGE_SIZE } from "@/shared/libs/list-params.lib";

import type { RequestStatus } from "./requests.constant";
import { attachments, requestItems, requestRevisions, requests } from "./requests.schema";

const attachmentColumns = {
  id: attachments.id,
  fileName: attachments.fileName,
  mimeType: attachments.mimeType,
  sizeBytes: attachments.sizeBytes,
  uploadedAt: attachments.uploadedAt,
  removedAt: attachments.removedAt,
};

async function loadChildren(requestId: string, { withRemoved }: { withRemoved: boolean }) {
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
      .where(and(eq(attachments.requestId, requestId), withRemoved ? undefined : isNull(attachments.removedAt)))
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
      status: requests.status,
      snapshot: requests.snapshot,
      typeName: requestTypes.name,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .where(
      and(
        eq(requests.id, requestId),
        eq(requests.requesterId, userId),
        inArray(requests.status, ["DRAFT", "NEEDS_INFO"]),
      ),
    );
  if (!request) return null;
  return { ...request, ...(await loadChildren(requestId, { withRemoved: false })) };
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
      typeFormSchema: requestTypes.formSchema,
      typeHasLineItems: requestTypes.hasLineItems,
      snapshot: requests.snapshot,
    })
    .from(requests)
    .innerJoin(user, eq(user.id, requests.requesterId))
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .leftJoin(departments, eq(departments.id, requests.departmentId))
    .where(eq(requests.id, requestId));
  if (!request) return null;
  const { typeFormSchema, typeHasLineItems, snapshot, ...rest } = request;
  return {
    ...rest,
    formSchema: snapshot?.formSchema ?? typeFormSchema,
    hasLineItems: snapshot?.hasLineItems ?? typeHasLineItems,
    ...(await loadChildren(requestId, { withRemoved: true })),
    revisions: await db
      .select()
      .from(requestRevisions)
      .where(eq(requestRevisions.requestId, requestId))
      .orderBy(desc(requestRevisions.revision)),
  };
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

export type RequestFilters = { q?: string; status?: RequestStatus; typeId?: string; page: number };

function requestsWhere(scope: { requesterId?: string }, filters: Omit<RequestFilters, "page">) {
  const q = filters.q && `%${escapeLike(filters.q)}%`;
  return and(
    scope.requesterId ? eq(requests.requesterId, scope.requesterId) : ne(requests.status, "DRAFT"),
    q
      ? or(ilike(requests.title, q), ilike(requests.code, q), scope.requesterId ? undefined : ilike(user.name, q))
      : undefined,
    filters.status ? eq(requests.status, filters.status) : undefined,
    filters.typeId ? eq(requests.requestTypeId, filters.typeId) : undefined,
  );
}

export async function searchRequests(scope: { requesterId?: string }, filters: RequestFilters) {
  const where = requestsWhere(scope, filters);
  const [rows, [{ total }]] = await Promise.all([
    db
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
      .where(where)
      .orderBy(scope.requesterId ? desc(requests.updatedAt) : sql`${requests.submittedAt} desc nulls last`)
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(requests)
      .innerJoin(user, eq(user.id, requests.requesterId))
      .where(where),
  ]);
  return { rows, total };
}

export const EXPORT_ROW_LIMIT = 10_000;

/** Every submitted request matching the admin list filters, for CSV export (capped at EXPORT_ROW_LIMIT). */
export async function exportRequests(filters: Omit<RequestFilters, "page">) {
  return db
    .select({
      code: requests.code,
      title: requests.title,
      typeName: requestTypes.name,
      requesterCode: user.employeeCode,
      requesterName: user.name,
      departmentName: departments.name,
      status: requests.status,
      totalAmount: requests.totalAmount,
      submittedAt: requests.submittedAt,
      completedAt: requests.completedAt,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.requestTypeId))
    .innerJoin(user, eq(user.id, requests.requesterId))
    .leftJoin(departments, eq(departments.id, requests.departmentId))
    .where(requestsWhere({}, filters))
    .orderBy(sql`${requests.submittedAt} desc nulls last`)
    .limit(EXPORT_ROW_LIMIT);
}

export type RequestSearchRow = Awaited<ReturnType<typeof searchRequests>>["rows"][number];

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
