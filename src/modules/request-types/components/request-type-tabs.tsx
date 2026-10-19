"use client";

import { Tabs } from "antd";
import { usePathname, useRouter } from "next/navigation";

export function RequestTypeTabs({ typeId }: { typeId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/administrator/request-types/${typeId}`;
  const active = pathname.endsWith("/form") ? "form" : pathname.endsWith("/steps") ? "steps" : "general";

  return (
    <Tabs
      activeKey={active}
      onChange={(key) => router.push(key === "general" ? base : `${base}/${key}`)}
      items={[
        { key: "general", label: "Thông tin chung" },
        { key: "form", label: "Biểu mẫu" },
        { key: "steps", label: "Bước duyệt" },
      ]}
    />
  );
}
