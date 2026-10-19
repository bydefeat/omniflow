export const ROLES = {
  EMPLOYEE: "employee",
  APPROVER: "approver",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const FUNCTIONAL_ROLES = [
  { value: "accountant", label: "Kế toán" },
  { value: "hr", label: "Nhân sự" },
  { value: "cfo", label: "Giám đốc tài chính" },
  { value: "ceo", label: "Tổng giám đốc" },
] as const;

export type FunctionalRole = (typeof FUNCTIONAL_ROLES)[number]["value"];

export const ROLE_LABELS: Record<Role | FunctionalRole, string> = {
  employee: "Nhân viên",
  approver: "Người phê duyệt",
  admin: "Quản trị viên",
  ...Object.fromEntries(FUNCTIONAL_ROLES.map((r) => [r.value, r.label])),
} as Record<Role | FunctionalRole, string>;

export const HOME_PATHS = {
  admin: "/administrator",
  default: "/workspace/dashboard",
} as const;

export const SIGN_IN_PATH = "/authentication/sign-in";
