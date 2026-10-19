import { Logo } from "@/shared/components/ui/logo";
import { BRAND_COLORS } from "@/shared/constants/theme.constant";

export function AuthenticationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside
        className="hidden w-5/12 flex-col justify-between p-12 text-white lg:flex"
        style={{ background: BRAND_COLORS.primary }}
      >
        <Logo inverted size="large" />
        <div className="space-y-4">
          <h1 className="text-3xl leading-tight font-semibold">
            Quản lý yêu cầu &amp; phê duyệt nội bộ
          </h1>
          <p className="max-w-md text-base text-white/80">
            Tạo đề xuất, theo dõi tiến độ và phê duyệt nhiều cấp trên một nền
            tảng minh bạch.
          </p>
        </div>
        <p className="text-sm text-white/60">
          © {new Date().getFullYear()} OmniFlow
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 lg:hidden">
          <Logo size="large" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
