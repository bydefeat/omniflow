import { Button, Result } from "antd";
import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle="Tài khoản của bạn không được phép xem trang này."
        extra={
          <Link href="/">
            <Button type="primary">Về trang chính</Button>
          </Link>
        }
      />
    </div>
  );
}
