import { REQUEST_STATUS_META, readRequestFilters } from "@/modules/requests/requests.constant";
import { EXPORT_ROW_LIMIT, exportRequests } from "@/modules/requests/requests.query";
import { ROLES } from "@/shared/constants/role.constant";
import { toCsv } from "@/shared/libs/csv.lib";
import { formatDateTime } from "@/shared/libs/format.lib";
import { hasRole } from "@/shared/libs/role.lib";
import { getSession } from "@/shared/libs/session.lib";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Phiên đăng nhập đã hết hạn", { status: 401 });
  if (!hasRole(session.user.role, ROLES.ADMIN)) return new Response("Không có quyền truy cập", { status: 403 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { page: _page, ...filters } = readRequestFilters(params);
  const rows = await exportRequests(filters);
  if (rows.length > EXPORT_ROW_LIMIT) {
    return new Response(`Quá ${EXPORT_ROW_LIMIT.toLocaleString("vi-VN")} đơn khớp bộ lọc. Hãy lọc hẹp hơn rồi xuất lại.`, {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const csv = toCsv(
    ["Mã đơn", "Tiêu đề", "Loại đơn", "Mã NV", "Người đề xuất", "Phòng ban", "Trạng thái", "Tổng tiền", "Ngày gửi", "Hoàn tất"],
    rows.map((r) => [
      r.code,
      r.title,
      r.typeName,
      r.requesterCode,
      r.requesterName,
      r.departmentName,
      REQUEST_STATUS_META[r.status].label,
      r.totalAmount,
      formatDateTime(r.submittedAt),
      r.completedAt ? formatDateTime(r.completedAt) : "",
    ]),
  );
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="don-yeu-cau-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
