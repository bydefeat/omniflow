import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestTypeGeneralForm } from "@/modules/request-types/components/request-type-general-form";
import { getRequestType } from "@/modules/request-types/request-types.query";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export const metadata: Metadata = { title: "Loại đơn" };

export default async function RequestTypePage({ params }: PageProps<"/administrator/request-types/[typeId]">) {
  await requireRole(ROLES.ADMIN);
  const { typeId } = await params;
  const type = await getRequestType(typeId);
  if (!type) notFound();
  return <RequestTypeGeneralForm type={type} />;
}
