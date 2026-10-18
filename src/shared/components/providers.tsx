"use client";

import "dayjs/locale/vi";

import { QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import { useState } from "react";

import { THEME } from "@/shared/constants/theme.constant";
import { makeQueryClient } from "@/shared/libs/query-client.lib";

dayjs.locale("vi");

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={THEME} locale={viVN}>
        <App>{children}</App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
