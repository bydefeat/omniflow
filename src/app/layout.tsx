import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { Providers } from "@/shared/components/providers";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "OmniFlow",
  description: "Hệ thống quản lý yêu cầu & phê duyệt nội bộ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* AntdRegistry reads Math.random() during render; cacheComponents requires it inside Suspense. */}
        <Suspense fallback={null}>
          <AntdRegistry layer>
            <Providers>{children}</Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
