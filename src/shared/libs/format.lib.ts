import dayjs from "dayjs";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number | null | undefined) {
  return value == null || value === "" ? "—" : moneyFormatter.format(Number(value));
}

export function formatNumber(value: string | number | null | undefined) {
  return value == null || value === "" ? "—" : numberFormatter.format(Number(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—";
}

export function formatDate(value: Date | string | null | undefined) {
  return value ? dayjs(value).format("DD/MM/YYYY") : "—";
}
