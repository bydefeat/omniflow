"use client";

import { Button, Result } from "antd";
import Link from "next/link";

type Props = {
  status: "404" | "500";
  title: string;
  subTitle: string;
  onRetry?: () => void;
  homeHref?: string;
};

export function StatusPage({ status, title, subTitle, onRetry, homeHref = "/" }: Props) {
  return (
    <Result
      status={status}
      title={title}
      subTitle={subTitle}
      extra={
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button type="primary" onClick={onRetry}>
              Thử lại
            </Button>
          )}
          <Link href={homeHref}>
            <Button type={onRetry ? "default" : "primary"}>Về trang chính</Button>
          </Link>
        </div>
      }
    />
  );
}
