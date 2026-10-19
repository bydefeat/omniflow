export const APPROVAL_RESULT_META = {
  WAITING: { label: "Đang chờ", color: "processing" },
  APPROVED: { label: "Đã duyệt", color: "success" },
  REJECTED: { label: "Từ chối", color: "error" },
  RETURNED: { label: "Yêu cầu bổ sung", color: "warning" },
  CANCELLED: { label: "Đã hủy", color: "default" },
} as const;

export type ApprovalResult = keyof typeof APPROVAL_RESULT_META;
