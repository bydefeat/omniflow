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

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const FILE_KINDS: Record<string, { extensions: string[]; matches: (bytes: Uint8Array) => boolean }> = {
  "application/pdf": { extensions: ["pdf"], matches: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  "image/png": { extensions: ["png"], matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  "image/jpeg": { extensions: ["jpg", "jpeg"], matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  "image/webp": {
    extensions: ["webp"],
    matches: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  },
  "application/msword": { extensions: ["doc"], matches: (b) => startsWith(b, OLE) },
  "application/vnd.ms-excel": { extensions: ["xls"], matches: (b) => startsWith(b, OLE) },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    matches: (b) => startsWith(b, ZIP) && contains(b, "word/"),
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: ["xlsx"],
    matches: (b) => startsWith(b, ZIP) && contains(b, "xl/"),
  },
};

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, i) => bytes[i] === byte);
}

function contains(bytes: Uint8Array, text: string) {
  const needle = [...text].map((c) => c.charCodeAt(0));
  for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (needle.every((byte, j) => bytes[i + j] === byte)) return true;
  }
  return false;
}

export function matchesFileKind(bytes: Uint8Array, mimeType: string, fileName: string) {
  const kind = FILE_KINDS[mimeType];
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(kind) && kind.extensions.includes(extension) && kind.matches(bytes);
}
