"use client";

import { useEffect } from "react";

import { StatusPage } from "@/shared/components/ui/status-page";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <StatusPage
        status="500"
        title="Đã có lỗi xảy ra"
        subTitle="Hệ thống gặp sự cố khi hiển thị trang này. Vui lòng thử lại sau ít phút."
        onRetry={retry}
        homeHref="/"
      />
    </div>
  );
}
