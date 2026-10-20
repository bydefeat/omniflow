export const AUDIT_ACTION_LABELS = {
  USER_CREATED: "Tạo tài khoản",
  USER_UPDATED: "Sửa tài khoản",
  USER_LOCKED: "Khóa tài khoản",
  USER_UNLOCKED: "Mở khóa tài khoản",
  USER_PASSWORD_SET: "Đặt lại mật khẩu",
  USER_SIGN_IN_UNLOCKED: "Gỡ khóa tạm đăng nhập",
  DEPARTMENT_CREATED: "Tạo phòng ban",
  DEPARTMENT_UPDATED: "Sửa phòng ban",
  DEPARTMENT_DELETED: "Xóa phòng ban",
  REQUEST_TYPE_CREATED: "Tạo loại đơn",
  REQUEST_TYPE_UPDATED: "Sửa loại đơn",
  REQUEST_TYPE_ACTIVATED: "Bật loại đơn",
  REQUEST_TYPE_DEACTIVATED: "Tắt loại đơn",
  FORM_SCHEMA_SAVED: "Lưu biểu mẫu",
  APPROVAL_STEPS_SAVED: "Lưu bước duyệt",
  APPROVAL_REASSIGNED: "Giao lại người duyệt",
  DELEGATION_CREATED: "Tạo ủy quyền thay",
  DELEGATION_CANCELLED: "Hủy ủy quyền",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;
