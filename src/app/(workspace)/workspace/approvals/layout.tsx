import { forbidden } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import { canAccessApprovals } from "@/modules/approvals/approvals.query";
import { PageSkeleton } from "@/shared/components/ui/page-skeleton";
import { requireSession } from "@/shared/libs/session.lib";

async function ApprovalsGate({ children }: { children: ReactNode }) {
  const { user } = await requireSession();
  if (!(await canAccessApprovals(user.id))) forbidden();
  return children;
}

export default function Layout({ children }: LayoutProps<"/workspace/approvals">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApprovalsGate>{children}</ApprovalsGate>
    </Suspense>
  );
}
