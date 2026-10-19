import { HOME_PATHS, ROLES } from "@/shared/constants/role.constant";

export function parseRoles(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

export function hasRole(role: string | null | undefined, wanted: string) {
  return parseRoles(role).includes(wanted);
}

export function serializeRoles(roles: string[]) {
  return [...new Set([ROLES.EMPLOYEE, ...roles])];
}

export function getHomePath(role: string | null | undefined) {
  return hasRole(role, ROLES.ADMIN) ? HOME_PATHS.admin : HOME_PATHS.default;
}

export function safeCallbackPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : null;
}
