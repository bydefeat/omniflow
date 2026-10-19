import { NodeIndexOutlined } from "@ant-design/icons";

import { BRAND_COLORS } from "@/shared/constants/theme.constant";

type LogoProps = {
  inverted?: boolean;
  size?: "default" | "large";
};

export function Logo({ inverted = false, size = "default" }: LogoProps) {
  const large = size === "large";

  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span
        className={`inline-flex items-center justify-center rounded-lg ${large ? "size-10 text-xl" : "size-8 text-base"}`}
        style={{
          background: inverted ? "#FFFFFF" : BRAND_COLORS.primary,
          color: inverted ? BRAND_COLORS.primary : "#FFFFFF",
        }}
      >
        <NodeIndexOutlined />
      </span>
      <span
        className={large ? "text-2xl" : "text-lg"}
        style={{ color: inverted ? "#FFFFFF" : undefined }}
      >
        OmniFlow
      </span>
    </span>
  );
}
