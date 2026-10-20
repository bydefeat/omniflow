export const DELEGATION_STATUS_META = {
  ACTIVE: { label: "Đang hiệu lực", color: "success" },
  UPCOMING: { label: "Sắp hiệu lực", color: "processing" },
  EXPIRED: { label: "Hết hạn", color: "default" },
  CANCELLED: { label: "Đã hủy", color: "default" },
} as const;

export const DELEGATION_STATUSES = ["ACTIVE", "UPCOMING", "EXPIRED", "CANCELLED"] as const;
export type DelegationStatus = (typeof DELEGATION_STATUSES)[number];
