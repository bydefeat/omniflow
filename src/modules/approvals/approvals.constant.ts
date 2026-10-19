import { readPage, readParam } from "@/shared/libs/list-params.lib";

export const APPROVAL_RESULT_META = {
  WAITING: { label: "Đang chờ", color: "processing" },
  APPROVED: { label: "Đã duyệt", color: "success" },
  REJECTED: { label: "Từ chối", color: "error" },
  RETURNED: { label: "Yêu cầu bổ sung", color: "warning" },
  CANCELLED: { label: "Đã hủy", color: "default" },
} as const;

export type ApprovalResult = keyof typeof APPROVAL_RESULT_META;

type SearchParams = Record<string, string | string[] | undefined>;

export const PENDING_SCOPE_OPTIONS = [
  { value: "mine", label: "Giao cho tôi" },
  { value: "delegated", label: "Được ủy quyền duyệt thay" },
] as const;

export const HISTORY_RESULTS = ["APPROVED", "REJECTED", "RETURNED"] as const;

export function readPendingFilters(params: SearchParams) {
  const scope = PENDING_SCOPE_OPTIONS.find((o) => o.value === readParam(params, "scope"))?.value;
  return {
    q: readParam(params, "q"),
    typeId: readParam(params, "typeId"),
    scope,
    overdue: readParam(params, "overdue") === "1" ? ("1" as const) : undefined,
    page: readPage(params),
  };
}

export function readHistoryFilters(params: SearchParams) {
  const result = readParam(params, "result");
  return {
    q: readParam(params, "q"),
    result: HISTORY_RESULTS.find((r) => r === result),
    page: readPage(params),
  };
}
