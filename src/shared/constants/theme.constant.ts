import type { ThemeConfig } from "antd";

export const BRAND_COLORS = {
  primary: "#1677FF",
} as const;

export const THEME: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLORS.primary,
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    borderRadius: 8,
  },
};
