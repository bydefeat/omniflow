export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Object.fromEntries(dateTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
}

export function formatMoney(value: string | number | null | undefined) {
  return value == null || value === "" ? "—" : moneyFormatter.format(Number(value));
}

export function formatNumber(value: string | number | null | undefined) {
  return value == null || value === "" ? "—" : numberFormatter.format(Number(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}
