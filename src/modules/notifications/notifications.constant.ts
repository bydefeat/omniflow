export const NOTIFICATION_TYPE_META = {
  APPROVAL_NEEDED: { label: "Chờ duyệt", color: "processing" },
  REQUEST_APPROVED: { label: "Đã duyệt", color: "success" },
  REQUEST_REJECTED: { label: "Bị từ chối", color: "error" },
  REQUEST_CANCELLED: { label: "Đã hủy", color: "default" },
  REQUEST_RETURNED: { label: "Cần bổ sung", color: "warning" },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE_META;
