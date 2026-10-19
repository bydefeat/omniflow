import { forbidden } from "next/navigation";

import { canAccessApprovals } from "@/modules/approvals/approvals.query";
import { requireSession } from "@/shared/libs/session.lib";

export default async function Layout({ children }: LayoutProps<"/workspace/approvals">) {
  const { user } = await requireSession();
  if (!(await canAccessApprovals(user.id))) forbidden();
  return children;
}
