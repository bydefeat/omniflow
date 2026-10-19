"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "antd";

import { getMyPendingApprovalCount } from "../approvals.action";

export function PendingApprovalsBadge() {
  const { data = 0 } = useQuery({
    queryKey: ["approvals", "pending-count"],
    queryFn: async () => {
      const [count] = await getMyPendingApprovalCount();
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  return <Badge count={data} size="small" />;
}
