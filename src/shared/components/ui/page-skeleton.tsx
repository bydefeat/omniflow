"use client";

import { Card, Skeleton } from "antd";

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton active title={{ width: 240 }} paragraph={{ rows: 1, width: 320 }} />
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    </div>
  );
}
