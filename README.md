# OmniFlow

Hệ thống quản lý yêu cầu & phê duyệt nội bộ: nhân viên tạo đề xuất (nghỉ phép, thanh toán, mua sắm...), đơn đi qua các bước duyệt cấu hình sẵn, quản trị viên cấu hình loại đơn và theo dõi toàn bộ quy trình.

Không có đăng ký tài khoản: mọi tài khoản do quản trị viên cấp.

## Tính năng

**Nhân viên (`/workspace`)**
- Tạo đơn theo biểu mẫu động của từng loại đơn, hạng mục chi tiết tự cộng tiền, đính kèm PDF/ảnh/Word/Excel (kiểm tra nội dung tệp, tối đa 10 MB).
- Lưu nháp, gửi duyệt, hủy đơn đang chờ; khi bị yêu cầu bổ sung thì sửa và gửi lại (nội dung lần gửi trước và tệp đã gửi được giữ làm bằng chứng).
- Theo dõi dòng thời gian duyệt, thông báo trong ứng dụng và qua email.

**Người duyệt**
- Danh sách chờ duyệt lọc theo từ khóa, loại đơn, giao cho mình hoặc được ủy quyền, quá hạn SLA (UC-05).
- Duyệt, từ chối (bắt buộc lý do), yêu cầu bổ sung; lịch sử duyệt có lọc.
- Ủy quyền duyệt thay trong một khoảng thời gian (UC-08).

**Quản trị viên (`/administrator`)**
- Phòng ban, người dùng (vai trò, quản lý trực tiếp, khóa/mở khóa, đặt mật khẩu).
- Loại đơn: biểu mẫu kéo thả (UC-09), bước duyệt theo quản lý trực tiếp hoặc vai trò (UC-10), SLA.
- Giám sát toàn bộ đơn, giao lại lượt duyệt bị treo, báo cáo theo tháng và tỷ lệ đúng SLA.
- Nhật ký quản trị: ai đổi gì, lúc nào, từ IP nào.

**Bảo mật và vận hành**
- Kiểm tra quyền ở từng trang và từng server action; header bảo mật (CSP `frame-ancestors`, `nosniff`, HSTS khi chạy HTTPS).
- Mật khẩu tối thiểu 10 ký tự gồm chữ và số; khóa tạm 15 phút sau 5 lần đăng nhập sai; giới hạn tần suất theo IP.
- Hàng đợi email trong database (gửi lại khi SMTP lỗi), tệp lưu trên đĩa hoặc S3/Cloudflare R2.
- `/api/health`, log JSON, script triển khai theo release có rollback, sao lưu hằng ngày.

## Công nghệ

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Ant Design 6 · Tailwind CSS 4 · PostgreSQL 16 + Drizzle ORM · better-auth · Zod 4 · TanStack Query · dnd-kit · Playwright.

## Chạy trên máy

Cần Node.js 22 và PostgreSQL 16 (có extension `btree_gist`).

```bash
npm install
cp .env.example .env              # điền DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY (>= 32 ký tự) và DEFEAT_SEED_ADMIN_PASSWORD
npm run db:migrate
npm run db:seed -- --demo         # admin + 5 tài khoản demo (mật khẩu Omniflow@123) + 3 loại đơn mẫu
npm run dev                       # http://localhost:3000
```

Tài khoản demo (đuôi `@omniflow.local`): `nhanvien.it`, `truongphong.it`, `ketoan`, `cfo`, `ceo`. Admin là `DEFEAT_SEED_ADMIN_EMAIL` trong `.env`.

Các biến môi trường khác (SMTP, S3/R2, proxy, pool kết nối) xem bảng trong [docs/DEPLOY.md](docs/DEPLOY.md#3-mã-nguồn-và-cấu-hình).

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run lint` | ESLint |
| `npx next typegen && npx tsc --noEmit` | Kiểm tra kiểu (cần `typegen` cho route type) |
| `npm test` | Unit test (`src/**/*.test.ts`, chạy bằng `node:test`) |
| `npm run build && npm run test:e2e` | E2E Playwright trên bản production, cần DB đã `db:seed -- --demo` |
| `npm run db:generate -- --name <tên>` | Sinh migration sau khi sửa `*.schema.ts` |
| `npm run mail:flush` | Gửi email còn tồn trong hàng đợi |
| `scripts/backup.sh` | Sao lưu database và `uploads/` |

CI (`.github/workflows/ci.yml`) chạy audit dependency, lint, typecheck, unit test, rồi e2e với Postgres, SMTP giả và S3 giả (moto).

## Cấu trúc

```
src/
├── app/          route: (authentication), (workspace), (administrator), api/
├── modules/      nghiệp vụ theo domain: departments, users, request-types, requests,
│                 approvals, delegations, notifications, audit
└── shared/       UI, layout, lib dùng chung (auth, db, action, mail, storage, logger)
drizzle/          migration SQL
scripts/          seed, flush-mail, backup, deploy, e2e/
deploy/           systemd unit, nginx mẫu
```

## Tài liệu

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): kiến trúc, quy ước module, quy trình duyệt.
- [docs/PLAN.md](docs/PLAN.md): kế hoạch và hiện trạng triển khai.
- [docs/DEPLOY.md](docs/DEPLOY.md): triển khai trên Ubuntu không dùng Docker, cập nhật, sao lưu, khôi phục.
- `docs.md`: đặc tả nghiệp vụ (use case, CDM).
