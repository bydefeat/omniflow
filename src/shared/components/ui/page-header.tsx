"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  backHref?: string;
};

export function PageHeader({ title, subtitle, extra, backHref }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link href={backHref}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Quay lại" />
          </Link>
        )}
        <div className="min-w-0">
          <Typography.Title level={3} className="!mb-0">
            {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          )}
        </div>
      </div>
      {extra && <div className="flex flex-wrap gap-2">{extra}</div>}
    </div>
  );
}
