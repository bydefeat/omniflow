"use client";

import { useEffect } from "react";

import { StatusPage } from "@/shared/components/ui/status-page";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      status="500"
      title="Đã có lỗi xảy ra"
      subTitle="Hệ thống gặp sự cố khi hiển thị trang này. Vui lòng thử lại sau ít phút."
      onRetry={retry}
      homeHref="/workspace/dashboard"
    />
  );
}
