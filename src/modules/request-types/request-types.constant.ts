import type { FieldType } from "./request-types.validation";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Văn bản ngắn",
  textarea: "Văn bản dài",
  number: "Số",
  date: "Ngày",
  dateRange: "Khoảng ngày",
  select: "Lựa chọn",
};

export const APPROVER_TYPE_LABELS = {
  MANAGER: "Quản lý trực tiếp của người làm đơn",
  ROLE: "Theo vai trò chức năng",
} as const;
