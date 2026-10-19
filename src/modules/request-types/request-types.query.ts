import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/shared/libs/db.lib";

import { approvalSteps, requestTypes } from "./request-types.schema";

export async function listRequestTypes() {
  return db
    .select({
      id: requestTypes.id,
      code: requestTypes.code,
      name: requestTypes.name,
      description: requestTypes.description,
      slaHours: requestTypes.slaHours,
      hasLineItems: requestTypes.hasLineItems,
      isActive: requestTypes.isActive,
      fieldCount: sql<number>`jsonb_array_length(${requestTypes.formSchema})`.mapWith(Number),
      stepCount: sql<number>`(select count(*) from approval_steps s where s.request_type_id = ${requestTypes.id})`.mapWith(
        Number,
      ),
    })
    .from(requestTypes)
    .orderBy(asc(requestTypes.name));
}

export type RequestTypeRow = Awaited<ReturnType<typeof listRequestTypes>>[number];

export async function getRequestType(id: string) {
  const [type] = await db.select().from(requestTypes).where(eq(requestTypes.id, id));
  if (!type) return null;
  const steps = await db
    .select()
    .from(approvalSteps)
    .where(eq(approvalSteps.requestTypeId, id))
    .orderBy(asc(approvalSteps.stepOrder));
  return { ...type, steps };
}

export type RequestTypeDetail = NonNullable<Awaited<ReturnType<typeof getRequestType>>>;

export async function getApprovalSteps(requestTypeId: string) {
  return db
    .select()
    .from(approvalSteps)
    .where(eq(approvalSteps.requestTypeId, requestTypeId))
    .orderBy(asc(approvalSteps.stepOrder));
}

export async function listActiveRequestTypes() {
  const types = await db
    .select({
      id: requestTypes.id,
      code: requestTypes.code,
      name: requestTypes.name,
      description: requestTypes.description,
      slaHours: requestTypes.slaHours,
      hasLineItems: requestTypes.hasLineItems,
      formSchema: requestTypes.formSchema,
    })
    .from(requestTypes)
    .where(eq(requestTypes.isActive, true))
    .orderBy(asc(requestTypes.name));
  if (types.length === 0) return [];

  const steps = await db
    .select({
      requestTypeId: approvalSteps.requestTypeId,
      stepOrder: approvalSteps.stepOrder,
      name: approvalSteps.name,
    })
    .from(approvalSteps)
    .where(
      inArray(
        approvalSteps.requestTypeId,
        types.map((t) => t.id),
      ),
    )
    .orderBy(asc(approvalSteps.stepOrder));

  return types
    .map((type) => ({
      ...type,
      steps: steps.filter((s) => s.requestTypeId === type.id),
    }))
    .filter((type) => type.steps.length > 0);
}

export type ActiveRequestType = Awaited<ReturnType<typeof listActiveRequestTypes>>[number];

export async function hasPendingRequests(requestTypeId: string, executor: Pick<typeof db, "execute"> = db) {
  const [row] = await executor.execute<{ pending: boolean }>(
    sql`select exists(select 1 from requests where request_type_id = ${requestTypeId} and status = 'PENDING') as pending`,
  );
  return Boolean(row?.pending);
}
