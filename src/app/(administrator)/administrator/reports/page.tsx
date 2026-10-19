import { getReportData } from "@/modules/approvals/approvals.query";
import { ReportView } from "@/modules/approvals/components/report-view";
import { ROLES } from "@/shared/constants/role.constant";
import { requireRole } from "@/shared/libs/session.lib";

export default async function ReportsPage() {
  await requireRole(ROLES.ADMIN);
  const data = await getReportData();
  return <ReportView data={data} />;
}
