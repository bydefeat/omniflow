export type RequestStatus = "DRAFT" | "PENDING" | "NEEDS_INFO" | "APPROVED" | "REJECTED" | "CANCELLED";

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  DRAFT: { label: "Nháp", color: "default" },
  PENDING: { label: "Chờ duyệt", color: "processing" },
  NEEDS_INFO: { label: "Cần bổ sung", color: "warning" },
  APPROVED: { label: "Đã duyệt", color: "success" },
  REJECTED: { label: "Từ chối", color: "error" },
  CANCELLED: { label: "Đã hủy", color: "default" },
};

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_MAX_COUNT = 20;
