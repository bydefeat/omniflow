# Kế hoạch triển khai OmniFlow

Kế hoạch chi tiết theo lộ trình ở `ARCHITECTURE.md` mục 7. Mỗi giai đoạn có danh sách việc (kèm file) và tiêu chí xong. Làm tuần tự: giai đoạn sau dùng kết quả giai đoạn trước.

## 0. Hiện trạng (2026-10-19): đã xong cả 10 giai đoạn

- [x] Next.js 16.4.2, React 19.3, TypeScript, Tailwind 4; `next.config.ts` bật `cacheComponents`, `partialPrefetching`, `authInterrupts`, giới hạn body server action / proxy 11 MB.
- [x] Đã cài: antd 6, @ant-design/icons, @ant-design/nextjs-registry, motion, drizzle-orm + drizzle-kit + drizzle-zod, postgres (driver), better-auth, zod 4, zustand, @tanstack/react-query, @tanstack/react-table v9, @dnd-kit (core, sortable, utilities), uuidv7, tsx.
- [x] Đã bỏ zsa (viết cho zod 3, input `formData` hỏng với zod 4): server action dùng lớp bọc riêng ở `action.lib.ts` (cùng API `authedProcedure` / `roleProcedure`, trả `[data, error]`, nhận cả FormData). Không còn cần `.npmrc` `legacy-peer-deps`.
- [x] Hướng dẫn triển khai không dùng Docker ở `docs/DEPLOY.md` (systemd, nginx, sao lưu, file mẫu trong `deploy/`).
- [x] Toàn bộ 10 giai đoạn đã làm và kiểm thử, kết quả ở mục 4.
- [x] Đợt hoàn thiện sau audit: kiểm quyền ở từng trang quản trị (không chỉ layout), header bảo mật, trang lỗi / 404 tiếng Việt, nhật ký quản trị (`audit_logs`), giữ bản cũ và tệp đã gửi khi bổ sung (`request_revisions`, `attachments.removed_at`), chính sách mật khẩu + khóa tạm khi đăng nhập sai + thời hạn phiên, phân trang và lọc ở server cho chờ duyệt / lịch sử / thông báo, báo cáo theo giờ Việt Nam, log JSON, triển khai theo release (`scripts/deploy.sh`).
- [x] Ngoài đặc tả, đã làm thêm: in đơn, xuất CSV danh sách đơn (admin), nhắc lượt duyệt quá hạn SLA (`npm run sla:remind`, systemd timer), người dùng tự sửa họ tên, admin tạo / hủy ủy quyền thay người khác.

### Chạy dự án

```bash
npm install
cp .env.example .env            # điền secret (>= 32 ký tự) và mật khẩu admin seed
npm run db:migrate
npm run db:seed                 # phòng ban Ban Giám đốc + tài khoản admin
npm run db:seed -- --demo       # thêm 5 tài khoản demo (mật khẩu Omniflow@123) và 3 loại đơn
npm run dev
npm test                        # unit test quy trình duyệt
npm run build && npm run test:e2e   # e2e Playwright trên production build, cần DB vừa seed --demo
npm run mail:flush              # gửi email còn tồn trong hàng đợi (chạy định kỳ bằng systemd timer)
scripts/backup.sh               # sao lưu database + uploads/
```

Tài khoản demo: `ceo@`, `cfo@`, `truongphong.it@`, `ketoan@`, `nhanvien.it@` (đuôi `omniflow.local`). Quan hệ quản lý: nhân viên IT → trưởng phòng IT → CEO; kế toán → CFO → CEO.

## 1. Giả định đang dùng

Các chỗ thiếu trong `docs.md` (xem `ARCHITECTURE.md` mục 6) tạm chốt như sau. Đổi giả định nào thì sửa schema ở mục 2 trước khi làm giai đoạn 4.

| # | Giả định |
|---|---|
| G1 | Người dùng có `managerId` (tự tham chiếu) để giải bước `MANAGER` |
| G2 | Bước `ROLE` giao cho **vai trò chức năng** (`accountant`, `hr`, `cfo`, `ceo`...), khai báo trong `role.constant.ts`. Mọi người giữ vai trò đó cùng thấy lượt, ai duyệt trước thì nhận |
| G3 | Trạng thái đơn: `DRAFT`, `PENDING`, `NEEDS_INFO`, `APPROVED`, `REJECTED`, `CANCELLED`. "Yêu cầu bổ sung": người duyệt trả đơn kèm nội dung cần bổ sung (lượt `RETURNED`), người làm đơn sửa rồi gửi lại, đơn được duyệt lại từ bước đầu (nội dung có thể đã đổi nên các bước trước phải xác nhận lại) |
| G4 | Hủy được khi `DRAFT` hoặc `PENDING` (kể cả đã có cấp duyệt) |
| G5 | Ủy quyền có người ủy quyền và người được ủy quyền; xét lúc đọc/duyệt. Một người không có hai ủy quyền `ACTIVE` chồng thời gian |
| G6 | Khóa tài khoản (`LOCKED`) dùng `banned` của plugin `admin` better-auth, không thêm cột `status` riêng |
| G7 | Thông báo luôn có trong ứng dụng. Khi có `DEFEAT_SMTP_CONNECTION_URL` thì gửi thêm email (đặt lại mật khẩu, mọi thông báo duyệt), gửi sau khi transaction commit |
| G8 | Tệp đính kèm lưu ổ đĩa local (`uploads/`, đã gitignore), hoặc S3/R2/MinIO khi có `DEFEAT_S3_BUCKET_NAME`; tối đa 10 MB/tệp, chỉ PDF, ảnh, Excel, Word, kiểm tra cả đuôi tệp và chữ ký nội dung (chấp nhận cả `.xls` dạng HTML/XML do ERP xuất, `.doc` dạng RTF); loại MIME lưu theo đuôi tệp, không tin trình duyệt |
| G9 | SLA dùng để báo cáo, tô màu quá hạn và nhắc người duyệt **một lần** khi quá hạn; không tự động chuyển cấp |

## 2. Thiết kế database (PDM)

Suy ra từ CDM ở `docs.md` 3.1–3.2 cộng giả định G1–G9. Khóa chính là `text` sinh bằng `uuidv7` (trừ bảng của better-auth giữ nguyên). Mọi bảng có `createdAt`, `updatedAt` (`timestamptz`, mặc định `now()`), không liệt kê lại dưới đây.

Quy tắc chung: ràng buộc nào DB làm được (`unique`, `check`, khóa ngoại, cột tính toán) thì để DB làm, code không kiểm lại.

### `departments` — module `departments` (PHONG_BAN)

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | |
| `code` | varchar(20) | unique, not null | MaPB |
| `name` | varchar(100) | not null | TenPB |
| `phone` | varchar(15) | | SoDienThoai |

### `user` (better-auth) — module `users` (NGUOI_DUNG, VAI_TRO)

Bảng sinh bởi better-auth (`npx @better-auth/cli generate`), thêm cột qua `user.additionalFields`:

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `name` | text | not null | HoTen |
| `email` | text | unique | Email |
| `role` | text | plugin admin, nhiều role cách nhau dấu phẩy | VAI_TRO |
| `banned`, `banReason`, `banExpires` | | plugin admin | TrangThai (G6) |
| `employeeCode` | varchar(20) | unique, not null | MaNguoiDung |
| `departmentId` | text | FK → departments, not null | Thuộc Về (1,1) |
| `managerId` | text | FK → user, null | G1 |

Mật khẩu (MatKhau) nằm ở bảng `account` của better-auth. Index: `departmentId`, `managerId`.

### `request_types`, `approval_steps` — module `request-types` (LOAI_YEU_CAU, BUOC_DUYET)

`request_types`:

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | |
| `code` | varchar(30) | unique, not null | MaLoaiYeuCau |
| `name` | varchar(100) | not null | TenLoaiYeuCau |
| `description` | varchar(500) | | MoTa |
| `slaHours` | integer | not null, check > 0 | ThoiHanSLA |
| `hasLineItems` | boolean | mặc định false | đơn tài chính/mua sắm có hạng mục (UC-02 bước 6) |
| `formSchema` | jsonb | mặc định `[]` | form động UC-09 |
| `isActive` | boolean | mặc định true | ẩn loại đơn mà không xóa |

`approval_steps`:

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | MaBuocDuyet |
| `requestTypeId` | text | FK → request_types, on delete cascade | Gồm Các Bước |
| `stepOrder` | integer | not null, check > 0; unique (`requestTypeId`, `stepOrder`) | ThuTuBuoc |
| `name` | varchar(100) | not null | TenBuoc |
| `approverType` | enum `MANAGER`, `ROLE` | not null | KieuNguoiDuyet |
| `approverRole` | varchar(30) | check: `ROLE` ⇒ not null | G2 |

Không cho sửa hay xóa bước của loại đơn đang có đơn `PENDING` (kiểm tra trong cùng transaction, khóa dòng loại đơn). Lượt duyệt lưu bản chụp tên bước, đơn lưu bản chụp cả quy trình (`requests.snapshot`) nên sửa sau đó không làm sai lịch sử.

### `requests`, `request_items`, `attachments`, `request_counters` — module `requests`

`requests` (DON_YEU_CAU):

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | |
| `code` | varchar(30) | unique, null khi `DRAFT` | MaDon, sinh lúc gửi |
| `requesterId` | text | FK → user, not null | Tạo Đơn |
| `requestTypeId` | text | FK → request_types, not null | Phân Loại |
| `departmentId` | text | FK → departments | phòng ban lúc gửi, để báo cáo |
| `title` | varchar(200) | not null | TieuDe |
| `reason` | text | not null | LyDo |
| `formData` | jsonb | mặc định `{}` | form động |
| `totalAmount` | numeric(18,2) | null nếu loại đơn không có hạng mục | TongTien |
| `status` | enum (G3) | mặc định `DRAFT` | TrangThai |
| `submittedAt` | timestamptz | | NgayTao (thời điểm gửi) |
| `completedAt` | timestamptz | | lúc duyệt xong / từ chối / hủy |
| `snapshot` | jsonb | null khi và chỉ khi `DRAFT` | bản chụp `formSchema`, `hasLineItems`, `slaHours`, các bước duyệt lúc gửi |

Index: (`requesterId`, `status`), (`status`, `submittedAt`).

`request_items` (HANG_MUC_CHI_TIET):

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | MaHangMuc |
| `requestId` | text | FK → requests, on delete cascade | Chứa Hạng Mục |
| `sortOrder` | integer | not null | |
| `name` | varchar(200) | not null | TenHangMuc |
| `unit` | varchar(20) | not null | DonViTinh |
| `quantity` | numeric(10,2) | check > 0 | SoLuong |
| `unitPrice` | numeric(18,2) | check ≥ 0 | DonGia |
| `amount` | numeric(18,2) | **cột tính toán** `quantity * unit_price` (generated stored) | ThanhTien |

`attachments` (TEP_DINH_KEM):

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | MaTep |
| `requestId` | text | FK → requests, on delete cascade | Có Đính Kèm |
| `fileName` | varchar(255) | not null | TenTep |
| `storageKey` | varchar(500) | not null | DuongDan (khóa nội bộ, không phải URL công khai) |
| `mimeType` | varchar(100) | not null | |
| `sizeBytes` | integer | check > 0 | |
| `uploadedById` | text | FK → user | |
| `uploadedAt` | timestamptz | mặc định now() | NgayTaiLen |

`request_counters`: (`year` integer PK, `lastNumber` integer). Lúc gửi đơn: `INSERT ... ON CONFLICT (year) DO UPDATE SET last_number = last_number + 1 RETURNING last_number` trong cùng transaction → `REQ-2026-0001`. Số reset theo năm và không nhảy số khi transaction lỗi.

### `approvals` — module `approvals` (LUOT_PHE_DUYET)

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | MaLuotDuyet |
| `requestId` | text | FK → requests, not null | Sinh Ra Lượt Duyệt |
| `stepOrder` | integer | not null; unique (`requestId`, `stepOrder`) | ThuTuDuyet |
| `stepName` | varchar(100) | not null | bản chụp tên bước |
| `approverId` | text | FK → user, null | Thực Hiện Duyệt (bước MANAGER) |
| `approverRole` | varchar(30) | null; check: đúng một trong `approverId` / `approverRole` có giá trị | bước ROLE (G2) |
| `actedById` | text | FK → user, null | người thực sự bấm nút |
| `onBehalfOfId` | text | FK → user, null | duyệt thay ai (G5) |
| `result` | enum `WAITING`, `APPROVED`, `REJECTED`, `CANCELLED` | mặc định `WAITING` | KetQua |
| `comment` | varchar(500) | check: `REJECTED` ⇒ not null | YKienPhanHoi |
| `dueAt` | timestamptz | not null | lúc tạo + `slaHours` |
| `decidedAt` | timestamptz | | NgayQuyetDinh |

Thêm `reassignedById` (FK → user) và `reassignedAt`: admin giao lại lượt đang `WAITING` cho người khác.

Index: (`approverId`, `result`), (`approverRole`, `result`). Lượt đã xử lý không bao giờ bị sửa hay xóa (audit trail).

### `delegations` — module `delegations` (UY_QUYEN)

| Cột | Kiểu | Ràng buộc | Từ CDM |
|---|---|---|---|
| `id` | text | PK | MaUyQuyen |
| `delegatorId` | text | FK → user, not null | Ủy Quyền (người ủy quyền) |
| `delegateId` | text | FK → user, not null; check ≠ `delegatorId` | người được ủy quyền (G5) |
| `startsAt` | timestamptz | not null | NgayBatDau |
| `endsAt` | timestamptz | not null; check > `startsAt` | NgayKetThuc |
| `reason` | varchar(255) | not null | LyDo |
| `status` | enum `ACTIVE`, `CANCELLED` | mặc định `ACTIVE` | TrangThai |

`EXPIRED` không lưu mà suy ra khi đọc (`ACTIVE` và `endsAt < now()`), để không cần job cập nhật. Chống chồng thời gian: exclusion constraint `EXCLUDE USING gist (delegator_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'ACTIVE')`, cần extension `btree_gist`.

### `notifications` — module `notifications` (bổ sung, UC-01)

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | text | PK |
| `userId` | text | FK → user, on delete cascade |
| `type` | varchar(30) | `APPROVAL_NEEDED`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `REQUEST_CANCELLED` |
| `title` | varchar(200) | not null |
| `href` | varchar(300) | link tới đơn |
| `readAt` | timestamptz | null = chưa đọc |

Index: (`userId`, `readAt`).

## 3. Các giai đoạn

### Giai đoạn 1 — Nền tảng ✅ (2026-10-19)

- [x] `.env.example` (4 biến `DEFEAT_*`), `.env` local (gitignored, secret sinh ngẫu nhiên); `.gitignore` thêm `!.env.example`, `/uploads`
- [x] `src/shared/libs/env.lib.ts`: parse bằng zod, lỗi ngay khi khởi động nếu thiếu biến
- [x] `src/shared/libs/db.lib.ts`: `drizzle(postgres(url), { schema, casing: "snake_case" })`, một pool duy nhất khi dev (`globalThis`)
- [x] `src/shared/libs/schema.lib.ts`: helper `id()` (uuidv7), `timestamps`
- [x] **Schema cả 7 module theo mục 2** (14 bảng gồm 4 bảng better-auth), gom ở `src/modules/schema.ts`
- [x] `drizzle.config.ts`; script `db:generate`, `db:migrate`, `db:studio`
- [x] Migration `0000_init.sql` (sinh tự động) + `0001_delegations_no_overlap.sql` (viết tay: `btree_gist` + exclusion constraint), đã chạy trên DB `omniflow`
- [x] Đã thử trên DB: cột `amount` tự tính; các check (đơn PENDING phải có mã, bước ROLE phải có vai trò, từ chối phải có lý do, lượt chỉ một người/vai trò, không tự ủy quyền) và ủy quyền chồng thời gian đều bị chặn
- [x] `theme.constant.ts`, `query-client.lib.ts`, `providers.tsx` (QueryClient, ConfigProvider `vi_VN`, dayjs `vi`, antd `App`)
- [x] `src/app/layout.tsx`: font Inter (có subset `vietnamese`), `<Suspense>` + `AntdRegistry layer`; `globals.css` xếp `@layer antd` giữa preflight và utilities
- [x] Postgres: dùng Postgres 18 cài sẵn trên máy (`localhost:5432`), không cần Docker

**Đã kiểm:** `npm run build`, `tsc --noEmit`, `npm run lint` đều qua; truy vấn qua `db.lib.ts` chạy được.

### Giai đoạn 2 — Xác thực và phân quyền ✅ (2026-10-19)

- [x] `role.constant.ts` (`employee`, `approver`, `admin`, 4 vai trò chức năng, nhãn tiếng Việt, trang đích) + `role.lib.ts` (`parseRoles`, `hasRole`, `getHomePath`, `safeCallbackPath` chống open redirect)
- [x] `auth.lib.ts`: drizzle adapter, id `uuidv7`, `emailAndPassword` (tắt tự đăng ký, tối thiểu 8 ký tự, đặt lại mật khẩu thì thu hồi mọi phiên), `additionalFields`, plugin `admin` (role mặc định `employee`), `nextCookies`
- [x] Bảng auth viết tay ở `users.schema.ts` khớp với better-auth: seed và đăng nhập ghi/đọc đúng
- [x] `auth-client.lib.ts` (kèm `adminClient`), route `api/auth/[...all]`
- [x] `session.lib.ts`: `getSession()` (cache theo request), `requireSession()`, `requireRole()` → `forbidden()`; bật `experimental.authInterrupts`, thêm `app/forbidden.tsx`
- [x] `action.lib.ts`: `authedProcedure` (`NOT_AUTHORIZED`), `roleProcedure(role)` (`FORBIDDEN`)
- [x] `src/proxy.ts` + `authentication.proxy.ts`: không có cookie phiên → sign-in kèm `callbackURL`. Không đẩy người có cookie ra khỏi trang đăng nhập (cookie hết hạn sẽ gây vòng lặp); trang sign-in tự kiểm tra phiên thật
- [x] `AuthenticationLayout` + trang sign-in, forgot-password, reset-password; form ở `modules/users/components/`
- [x] `app/page.tsx`: chuyển hướng theo role
- [x] `scripts/seed.ts` (`npm run db:seed`): phòng ban `PB_BGD` + admin (`employee,admin`) từ `DEFEAT_SEED_ADMIN_*`, chạy lại không tạo trùng
- [x] Layout tạm cho `/workspace` và `/administrator` (chỉ `requireRole`), giai đoạn 3 thay bằng layout thật

**Đã kiểm trên production build** (`npm start` + curl): chưa đăng nhập → 307 về sign-in kèm `callbackURL`; admin vào `/administrator` được, `/` chuyển về `/administrator`; nhân viên vào `/administrator` → trang 403, gọi API admin → 403; khóa nhân viên → mọi phiên bị xóa, phiên cũ bị đẩy về sign-in, đăng nhập lại → `BANNED_USER`; `callbackURL=//evil.com` bị bỏ qua.

**Ghi chú:**
- Với Cache Components, `redirect()`/`forbidden()` chạy trong phần stream nên mã HTTP vẫn là 200; nội dung trả về là trang 403 hoặc lệnh chuyển hướng, không lộ dữ liệu.
- Email (G7): `sendResetPassword` gửi qua `mail.lib.ts` (nodemailer) khi có `DEFEAT_SMTP_CONNECTION_URL`. Không có SMTP: ngoài production thì in liên kết ra log; ở production không in token, trang quên mật khẩu hướng dẫn liên hệ quản trị viên.
- `roleProcedure` chưa thử qua action thật; sẽ thử khi có action đầu tiên ở giai đoạn 4.
- Kiểu `role` của better-auth chỉ nhận `user`/`admin`, nên khi tạo người dùng truyền role qua `data.role` (xem `seed.ts`).
- Lỗi build hay gặp: icon `@ant-design/icons` chỉ dùng được trong component có `"use client"`; không dùng `new Date()`/`Math.random()` lúc render ở server component.

### Giai đoạn 3 — Layouts ✅

- [x] `navigation.constant.ts` (menu workspace có cờ `access`: `approvals` / `delegations`; menu admin chia nhóm), `navigation.lib.ts` (`findActiveItem`: khớp đường dẫn dài nhất)
- [x] `sidebar.store.ts` (zustand `persist`, `skipHydration` + `rehydrate()` trong `useEffect` để không lệch hydration)
- [x] `ui/`: `logo.tsx`, `page-header.tsx`, `user-avatar-menu.tsx` (hồ sơ, chuyển portal, đăng xuất), `page-skeleton.tsx`, `sortable-list.tsx` (dnd-kit)
- [x] `layouts/workspace/`: sidebar thu gọn được, topbar (nút "Tạo đề xuất", chuông thông báo, avatar), tab đáy + drawer "Thêm" dưới 768px; ẩn/hiện bằng Tailwind (`hidden md:block`) nên không cần hook `useMediaQuery`
- [x] `layouts/administrator/`: sidebar tối chia nhóm (thu về 0 dưới `lg`), header có breadcrumb
- [x] Layout nhận phần của module qua prop (`headerExtra` = chuông thông báo, `badges` = số lượt chờ duyệt) nên `shared` không import `modules`
- [x] `loading.tsx` cho 2 portal

### Giai đoạn 4 — Danh mục tổ chức ✅

- [x] `departments`: validation, query (kèm số người), action thêm/sửa/xóa (trùng mã → `CONFLICT`, còn người → `PRECONDITION_FAILED`), trang quản lý
- [x] `users`: tạo tài khoản qua `auth.api.createUser`, sửa thông tin/vai trò/quản lý (chặn vòng quản lý, chặn admin tự gỡ quyền admin, id không tồn tại → `NOT_FOUND`), khóa/mở khóa (chặn tự khóa), đặt mật khẩu mới; bảng lọc theo tên/phòng ban/vai trò
- [x] Sửa người dùng bằng modal ngay trên danh sách, không làm trang `/administrator/users/[userId]` riêng
- [x] `/workspace/profile`: xem thông tin, đổi mật khẩu (đăng xuất các phiên khác)

### Giai đoạn 5 — Cấu hình quy trình (UC-09, UC-10) ✅

- [x] `request-types`: schema, validation (`formFieldSchema`, `buildFormValidator()` dùng ở cả client và server), query, action
- [x] `/administrator/request-types` (tạo, bật/tắt), `/[typeId]` (thông tin chung), `/[typeId]/form` (form builder kéo thả, 6 kiểu trường), `/[typeId]/steps` (bước duyệt kéo thả, lưu cả danh sách trong một transaction, khóa khi loại đơn còn đơn `PENDING`)
- [x] Seed demo: Nghỉ phép (1 bước), Thanh toán công tác (QL → Kế toán → CFO, có hạng mục), Mua sắm thiết bị IT (QL → CEO, có hạng mục)

### Giai đoạn 6 — Tạo đơn (UC-02) ✅

- [x] `requests`: schema, validation, query, action `createDraft` / `updateDraft` / `deleteDraft`; tổng tiền tính bằng SQL từ cột `amount` (cột tính toán), không tin số client gửi
- [x] Form tạo đơn: chọn loại → form động, bảng hạng mục (TanStack Table v9: `useTable` + `tableFeatures({})` + `table.FlexRender`), lộ trình duyệt, tệp đính kèm; "Lưu nháp" chỉ bắt buộc loại/tiêu đề/lý do, "Gửi duyệt" kiểm tra đủ
- [x] Tệp đính kèm: `uploadAttachment` là **server action thường** (tự kiểm tra phiên + zod, trả `[data, error]` như zsa) vì zsa `type: "formData"` hỏng với zod 4; lưu ở `uploads/` qua `storage.lib.ts`, tên file trên đĩa là uuidv7
- [x] `api/files/[fileId]`: chỉ người làm đơn, người duyệt liên quan (kể cả qua ủy quyền) hoặc admin tải được; PDF/ảnh mở inline, còn lại tải về; tên file tiếng Việt mã hóa RFC 5987

### Giai đoạn 7 — Quy trình duyệt (UC-04 → UC-07) ✅

- [x] `approvals.service.ts` + 16 unit test (`npm test`)
- [x] `submitRequest`, `approveRequest`, `rejectRequest`, `cancelRequest`: một transaction mỗi action, `SELECT ... FOR UPDATE`, ghi thông báo trong cùng transaction; mã đơn `REQ-<năm>-<số>` từ `request_counters`
- [x] Không ai tự duyệt đơn của mình (kể cả khi giữ vai trò của bước, kể cả qua ủy quyền của chính mình). Bước không tìm được người duyệt → lỗi rõ ràng, transaction rollback, không tạo lượt treo
- [x] Trang chờ duyệt (tô đỏ quá hạn), chi tiết đơn + thanh Duyệt/Từ chối (dính đáy trên điện thoại), lịch sử duyệt; trang đơn của tôi có dòng thời gian (Motion) và nút hủy
- [x] G4 điều chỉnh: đơn nháp thì **xóa** (`deleteDraft`), chỉ đơn `PENDING` mới **hủy** (ràng buộc DB yêu cầu đơn khác `DRAFT` phải có mã)

### Giai đoạn 8 — Theo dõi và thông báo (UC-01, UC-03) ✅

- [x] Đơn của tôi (lọc trạng thái/loại/từ khóa), tổng quan (thống kê theo trạng thái, 5 đơn gần nhất, thẻ "đơn chờ bạn duyệt")
- [x] Chuông thông báo và badge "Chờ tôi duyệt": TanStack Query gọi server action, `refetchInterval` 30 giây; trang thông báo, đánh dấu đã đọc
- [x] Không dùng `zsa-react-query`: `useQuery` gọi thẳng action zsa là đủ (package vẫn còn trong `package.json`, gỡ được)

### Giai đoạn 9 — Ủy quyền (UC-08) ✅

- [x] `delegations`: tạo (chỉ người có quyền duyệt: có vai trò duyệt hoặc có cấp dưới), hủy; trùng thời gian → exclusion constraint → `CONFLICT`; trạng thái `EXPIRED`/`UPCOMING` suy ra khi đọc
- [x] Ủy quyền xét lúc đọc/duyệt; audit ghi `actedById` + `onBehalfOfId`; thông báo gửi cả người được ủy quyền đang hiệu lực

### Giai đoạn 10 — Giám sát và báo cáo ✅

- [x] `/administrator`: đơn đang chờ, lượt quá hạn SLA, số người dùng/phòng ban/loại đơn, hàng đợi theo người duyệt và nhóm vai trò
- [x] `/administrator/requests` (+ chi tiết, dòng thời gian), `/administrator/reports` (theo loại × trạng thái, 6 tháng gần nhất, thời gian xử lý trung bình theo bước, tỷ lệ đúng SLA; tính bằng SQL)

## 4. Kiểm thử

**Unit test** (`npm test`, `node:test` qua `tsx`): 20/20 qua — 16 cho `approvals.service.ts`, 4 cho `format.lib.ts` (chạy cả với `TZ=UTC` và `TZ=America/New_York`).

**Kiểm tra toàn diện (2026-10-19), tất cả đều qua:**

| Lớp | Kết quả |
|---|---|
| Dựng từ đầu | Database mới → `db:migrate` → `db:seed` → `db:seed -- --demo` (chạy 2 lần không tạo trùng) → `build` → `start` → 3 bộ kiểm thử đầu-cuối qua, log server 0 lỗi |
| Tĩnh | `tsc`, `lint`, 0 comment, `drizzle-kit generate` không lệch schema, `drizzle-kit check` sạch |
| Schema better-auth | So với `@better-auth/cli generate`: đủ cột, đúng tên; khác biệt có chủ đích (`timestamptz`, `employee_code` varchar unique, khóa ngoại) |
| Kiến trúc | `shared` không import `modules` (trừ `db.lib`, `auth.lib`); không module nào import `action`/`components` của module khác; mọi cạnh import đi đúng chiều mũi tên |
| Bảo mật | 27/27 server action có kiểm quyền (12 `adminProcedure`, 14 `authedProcedure`, 1 `getSession()`; nay là 28/28 sau khi thêm `reassignApproval`); mọi route portal chưa đăng nhập → 307 về sign-in, `api/files` → 401; không có `dangerouslySetInnerHTML`/`eval`/`any`; `.env` không vào git; `npm audit --omit=dev`: 0 lỗ hổng |

Rà soát code lần này tìm và sửa thêm 3 lỗi: ngày giờ định dạng theo múi giờ của server (lệch 7 giờ và lỗi hydration khi deploy lên server UTC) → cố định `Asia/Ho_Chi_Minh`; `DndContext` sinh id khác nhau giữa server và trình duyệt → truyền `id` từ `useId()`; bản nháp thuộc loại đơn đã tắt mở ra trống trơn → hiện cảnh báo và chỉ cho xóa nháp.

**Kiểm thử đầu-cuối trên production build** (`next build` + `next start`, gọi server action qua HTTP với header `Next-Action`, đăng nhập bằng tài khoản demo), cả ba bộ đều qua:

| Bộ | Nội dung |
|---|---|
| Luồng nghiệp vụ (48 kiểm tra) | Tổng tiền 5.000.000 đúng; tệp: upload PDF, chặn `.exe`, chủ đơn tải được, người lạ 404, chưa đăng nhập bị chặn, tên tiếng Việt đúng; gửi duyệt ra `REQ-2026-0001`, gửi lại bị chặn; duyệt 3 cấp tới `APPROVED`; **hai lần bấm duyệt đồng thời chỉ một lần thành công**; từ chối bắt buộc lý do, dừng quy trình; hủy đơn chờ; ủy quyền + duyệt thay ghi đúng audit; ủy quyền trùng thời gian bị chặn; không tự duyệt đơn mình; phân quyền trang |
| Action quản trị (22 kiểm tra) | Nhân viên gọi action admin → `FORBIDDEN`; phòng ban trùng mã / còn người; tạo tài khoản (chuẩn hóa email, mã NV, vai trò), trùng email, vai trò lạ; vòng quản lý, tự quản lý, tự khóa, id không tồn tại; biểu mẫu trùng mã trường / lựa chọn rỗng; khóa bước khi còn đơn chờ; bước ROLE thiếu vai trò |
| Render trang (21 trang) | Mọi trang của 2 portal render đủ nội dung ở server, log server không lỗi |

Kiểm thử đầu-cuối tìm ra và đã sửa 3 lỗi: zsa `type: "formData"` hỏng với zod 4; `Layout.Content` dùng trong server component thành `undefined` (mọi trang phải render lại ở client); `updateUser` với id không tồn tại báo thành công.

**Các script trên nằm ngoài repo.** Bộ e2e trong repo ở mục 4.1.

### 4.1. E2E trong repo (`scripts/e2e/`, Playwright)

Chạy: DB mới → `db:migrate` → `db:seed -- --demo` → `npm run build` → `npm run test:e2e` (tự `npm start` nếu cổng 3000 trống). Trình duyệt có sẵn thì truyền `E2E_CHROMIUM_PATH`. Đặt `DEFEAT_SMTP_CONNECTION_URL=smtp://127.0.0.1:2525` (cho cả server và lệnh test) thì e2e tự bật SMTP sink và chạy thêm test email; đặt các biến `DEFEAT_S3_*` thì chạy trên S3 (CI dùng moto). Kết quả: 38 qua + 1 bỏ qua khi có SMTP và S3; 36 qua + 3 bỏ qua ở cấu hình mặc định. CI (`.github/workflows/ci.yml`) chạy lint, tsc, unit test và e2e với Postgres, moto và SMTP sink cho mỗi PR.

| File | Nội dung |
|---|---|
| `auth.spec.ts` | Chưa đăng nhập → sign-in kèm `callbackURL`; `callbackURL=/%09/evil` không đưa ra ngoài; `callbackURL` hợp lệ được giữ; không có SMTP thì trang quên mật khẩu hướng dẫn liên hệ admin; admin đặt mật khẩu → phiên cũ bị đăng xuất; sai 5 lần → khóa tạm, admin đặt mật khẩu → mở; đổi vai trò → đăng xuất; mật khẩu yếu bị từ chối |
| `request-flow.spec.ts` | Trên trình duyệt: lưu nháp khi dòng hạng mục trống, số lượng `2,5` × `1.500.000` = 3.750.000 khớp DB, upload PDF, gửi, 3 người duyệt qua UI. Đơn đang chờ không đổi khi admin sửa biểu mẫu / tắt hạng mục; sửa bước bị chặn |
| `concurrency.spec.ts` | Giữ khóa dòng để tái hiện chính xác: sửa nháp / xóa nháp / xóa tệp / sửa bước duyệt trùng lúc gửi đơn đều bị chặn; duyệt và hủy cùng lúc không lỗi server. Đã thử gỡ khóa trong code thì các test tương ứng fail |
| `reassign.spec.ts` | Khóa người giữ vai trò duy nhất → tổng quan admin báo lượt treo → giao lại qua UI → người mới nhận thông báo và duyệt được; hủy đơn báo cho người giữ vai trò và người được họ ủy quyền |
| `mobile.spec.ts` | 8 trang workspace ở 390×844: không tràn ngang, thanh tab đáy hiển thị; "Đơn chờ tôi duyệt" hiện dạng thẻ dưới 768px |
| `drag-drop.spec.ts` | Kéo thả bằng chuột đổi thứ tự trường biểu mẫu và bước duyệt, lưu đúng thứ tự vào DB |
| `mail.spec.ts` | Quên mật khẩu → email thật tới SMTP sink → mở liên kết → đặt mật khẩu mới → đăng nhập được; người duyệt nhận email khi có đơn chờ; `mail:flush` gửi email tồn, SMTP lỗi thì hẹn gửi lại |
| `return.spec.ts` | Người duyệt yêu cầu bổ sung (bắt buộc nội dung) → người làm đơn thấy thông báo, bổ sung tệp, sửa lý do, gửi lại → đơn duyệt lại từ bước đầu; hủy khi chờ bổ sung báo cho người đã yêu cầu; hủy khi đang chờ bổ sung; gửi lại hai lần bị chặn; tệp đã gửi chỉ gỡ mềm, bản trước xem được |
| `authz.spec.ts` | Nhân viên mở trực tiếp hoặc phát lại request điều hướng RSC của trang quản trị không thấy dữ liệu; mọi action quản trị trả FORBIDDEN; header bảo mật; 404 tiếng Việt; tiêu đề trang |
| `audit.spec.ts` | Tạo / sửa / xóa phòng ban ghi nhật ký kèm diff, trang nhật ký lọc được |
| `extras.spec.ts` | Tự sửa họ tên (endpoint `update-user` của better-auth bị tắt); admin xuất CSV theo bộ lọc, nhân viên bị chặn; in đơn ẩn khung portal; admin tạo / hủy ủy quyền thay, trùng thời gian bị chặn, có nhật ký |
| `sla.spec.ts` | Chạy `sla:remind` thật: chưa quá hạn không nhắc, quá hạn nhắc đúng một lần, giao lại thì nhắc người mới |
| `lists.spec.ts` | Chờ duyệt lọc theo từ khóa, ủy quyền, quá hạn; lịch sử lọc theo kết quả; thông báo lọc chưa đọc; báo cáo tháng chạy được |
| `followups.spec.ts` | Lọc và phân trang ở server theo URL; người chỉ được ủy quyền vào trang ủy quyền; người ủy quyền thấy lượt được duyệt thay trong lịch sử; nháp cũ lưu được sau khi biểu mẫu đổi; tệp giả PDF bị từ chối; lỗi rõ cho id không tồn tại, phòng ban sai, quản lý bị khóa |

**Chưa kiểm:** portal admin trên điện thoại (thiết kế cho máy tính); gửi email qua dịch vụ SMTP thật và S3 thật (đã kiểm với SMTP sink và moto).

## 5. Rủi ro và lưu ý

| Rủi ro | Cách xử lý |
|---|---|
| Server action tự viết (`action.lib.ts`) | Lỗi không lường trước được ghi log và trả `INTERNAL_SERVER_ERROR`, không lộ chi tiết ra client; lỗi điều hướng của Next (`redirect`, `notFound`) được ném lại nguyên vẹn |
| Server component dùng component antd | Chỉ dùng export có tên (`Button`, `Tag`); **không** dùng `X.Y` (`Layout.Content`, `Descriptions.Item`...) và không dùng icon trong server component — đặt chúng trong component `"use client"` |
| `cacheComponents` | Không dùng `new Date()` / `Math.random()` khi render ở phần tĩnh. Layout portal đọc session bên trong `<Suspense>` và mỗi trang có `loading.tsx`, nên `next dev` không còn cảnh báo "uncached data"; trang mới cũng cần `loading.tsx` |
| Rate limit đăng nhập của better-auth (production) | Lưu trong bảng `rate_limit` nên có hiệu lực chung khi chạy nhiều instance; script tự động cần đợi rồi thử lại. Thêm giới hạn theo email + IP (`sign_in_failures`): lượt thử được đếm nguyên tử trước khi kiểm mật khẩu nên gửi song song không vượt quá 5 lượt / 15 phút; admin gỡ khóa ở danh sách người dùng. Chạy sau nhiều tầng proxy thì cấu hình `advanced.ipAddress` trong `auth.lib.ts` theo hạ tầng, nếu không mọi người dùng có thể dùng chung một hạn mức |
| Danh sách lớn | Người dùng, đơn, chờ duyệt, lịch sử duyệt, thông báo và nhật ký quản trị đều lọc, phân trang ở server theo `searchParams` (20 dòng/trang) |
| Lưu tệp | Mặc định ổ đĩa local (`uploads/`), không dùng được khi chạy nhiều instance; đặt `DEFEAT_S3_*` để dùng S3/R2/MinIO (`storage.lib.ts`) |
| Email (G7) | Hàng đợi `email_outbox` ghi trong cùng transaction với thông báo; gửi sau khi phản hồi xong, lỗi thì thử lại tối đa 8 lần giãn dần; `npm run mail:flush` (systemd timer 5 phút) gửi nốt phần còn tồn |
| Giả định G1–G9 | Vẫn cần chốt với người viết `docs.md`; schema đang theo các giả định này |
