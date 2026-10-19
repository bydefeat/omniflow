import { Tag } from "antd";
import { notFound } from "next/navigation";

import { RequestTypeTabs } from "@/modules/request-types/components/request-type-tabs";
import { getRequestType } from "@/modules/request-types/request-types.query";
import { PageHeader } from "@/shared/components/ui/page-header";

export default async function Layout({ children, params }: LayoutProps<"/administrator/request-types/[typeId]">) {
  const { typeId } = await params;
  const type = await getRequestType(typeId);
  if (!type) notFound();

  return (
    <>
      <PageHeader
        title={type.name}
        subtitle={
          <>
            {type.code} {!type.isActive && <Tag className="!ms-2">Ngừng sử dụng</Tag>}
          </>
        }
        backHref="/administrator/request-types"
      />
      <RequestTypeTabs typeId={type.id} />
      {children}
    </>
  );
}
