import { StatusPage } from "@/shared/components/ui/status-page";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <StatusPage
        status="404"
        title="Không tìm thấy trang"
        subTitle="Trang hoặc dữ liệu bạn tìm không tồn tại, hoặc bạn không có quyền xem."
        homeHref="/"
      />
    </div>
  );
}
