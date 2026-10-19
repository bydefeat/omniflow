import { getReportData } from "@/modules/approvals/approvals.query";
import { ReportView } from "@/modules/approvals/components/report-view";

export default async function ReportsPage() {
  const data = await getReportData();
  return <ReportView data={data} />;
}
