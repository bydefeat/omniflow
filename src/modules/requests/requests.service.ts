import type { FormField } from "@/modules/request-types/request-types.validation";
import { formatDate, formatNumber } from "@/shared/libs/format.lib";

export function formatFieldValue(field: FormField, value: unknown) {
  if (value == null || value === "") return "—";
  switch (field.type) {
    case "number":
      return formatNumber(value as number);
    case "date":
      return formatDate(value as string);
    case "dateRange": {
      const [from, to] = value as [string, string];
      return `${formatDate(from)} – ${formatDate(to)}`;
    }
    default:
      return String(value);
  }
}

export function formatRequestCode(year: number, sequence: number) {
  return `REQ-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
