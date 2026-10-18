# Kế hoạch triển khai OmniFlow

Kế hoạch chi tiết theo lộ trình ở `ARCHITECTURE.md` mục 7. Mỗi giai đoạn có danh sách việc (kèm file) và tiêu chí xong. Làm tuần tự: giai đoạn sau dùng kết quả giai đoạn trước.

## 0. Hiện trạng (2026-10-19)

- [x] Next.js 16.4.2, React 19.3, TypeScript, Tailwind 4; `next.config.ts` bật `cacheComponents`, `partialPrefetching`.
- [x] Đã cài: antd 6, @ant-design/icons, @ant-design/nextjs-registry, motion, drizzle-orm + drizzle-kit + drizzle-zod, postgres (driver), better-auth, zod 4, zsa + zsa-react-query, zustand, @tanstack/react-query, @tanstack/react-table, @dnd-kit (core, sortable, utilities), uuidv7.
- [x] `.npmrc` có `legacy-peer-deps=true` (giống hcmue-portal): zsa 0.6 khai báo peer `zod@^3` nhưng **đã kiểm tra chạy đúng với zod 4** (parse input, trả lỗi `INPUT_PARSE_ERROR`, suy kiểu đúng).
- [ ] npm đang chặn script cài đặt của `esbuild`, `unrs-resolver`. Nếu `drizzle-kit` hoặc ESLint báo lỗi thiếu binary thì chạy `npm approve-scripts esbuild unrs-resolver`.
- [ ] `src/` vẫn là template mặc định của create-next-app.

## 1. Giả định đang dùng

Các chỗ thiếu trong `docs.md` (xem `ARCHITECTURE.md` mục 6) tạm chốt như sau. Đổi giả định nào thì sửa schema ở mục 2 trước khi làm giai đoạn 4.

| # | Giả định |
|---|---|
| G1 | Người dùng có `managerId` (tự tham chiếu) để giải bước `MANAGER` |
| G2 | Bước `ROLE` giao cho **vai trò chức năng** (`accountant`, `hr`, `cfo`, `ceo`...), khai báo trong `role.constant.ts`. Mọi người giữ vai trò đó cùng thấy lượt, ai duyệt trước thì nhận |
| G3 | Trạng thái đơn: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`. **Không** làm "yêu cầu bổ sung" ở bản 1.0 |
| G4 | Hủy được khi `DRAFT` hoặc `PENDING` (kể cả đã có cấp duyệt) |
| G5 | Ủy quyền có người ủy quyền và người được ủy quyền; xét lúc đọc/duyệt. Một người không có hai ủy quyền `ACTIVE` chồng thời gian |
| G6 | Khóa tài khoản (`LOCKED`) dùng `banned` của plugin `admin` better-auth, không thêm cột `status` riêng |
| G7 | Thông báo chỉ trong ứng dụng; email để sau |
| G8 | Tệp đính kèm lưu ổ đĩa local (`uploads/`, đã gitignore); tối đa 10 MB/tệp, chỉ PDF, ảnh, Excel, Word |
| G9 | SLA chỉ để báo cáo và tô màu quá hạn; không tự động chuyển cấp hay nhắc nhở |

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

Không cho sửa hay xóa bước của loại đơn đang có đơn `PENDING`. Lượt duyệt lưu bản chụp tên bước nên sửa sau đó không làm sai lịch sử.

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

### Giai đoạn 1 — Nền tảng

- [ ] `.env.example` với `DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL`, `DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY`, `DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL`, `DEFEAT_UPLOAD_DIRECTORY`; thêm `.env*.local` và `uploads/` vào `.gitignore`
- [ ] `src/shared/libs/env.lib.ts`: parse bằng zod, lỗi ngay khi khởi động nếu thiếu biến
- [ ] `src/shared/libs/db.lib.ts`: `drizzle(postgres(url), { schema })`, gom schema từ các module; giữ một client duy nhất khi dev (gắn vào `globalThis`)
- [ ] `drizzle.config.ts` (đọc schema `src/modules/**/*.schema.ts`, thư mục migration `drizzle/`); script `db:generate`, `db:migrate`, `db:studio` trong `package.json`
- [ ] Migration đầu tiên: `CREATE EXTENSION btree_gist`
- [ ] `src/shared/constants/theme.constant.ts`, `src/shared/components/providers.tsx` (QueryClientProvider), `src/shared/libs/query-client.lib.ts`
- [ ] `src/app/layout.tsx`: `AntdRegistry` + `ConfigProvider` (locale `vi_VN`) + `Providers`; xóa nội dung mẫu ở `page.tsx`, `globals.css`
- [ ] Cách chạy Postgres khi dev (`docker-compose.yml` một service `postgres:17`, hoặc ghi rõ dùng Postgres cài sẵn)

**Xong khi:** `npm run dev` lên trang trống có theme antd, `npm run db:migrate` chạy được trên DB rỗng, `npm run build` qua.

### Giai đoạn 2 — Xác thực và phân quyền

- [ ] `src/shared/constants/role.constant.ts`: `employee`, `approver`, `admin` + danh sách vai trò chức năng (G2) + trang đích sau đăng nhập
- [ ] `src/shared/libs/auth.lib.ts`: `betterAuth()` với drizzle adapter, `emailAndPassword` (tắt tự đăng ký), plugin `admin`, `user.additionalFields` (`employeeCode`, `departmentId`, `managerId`); truyền `secret`, `baseURL` từ env
- [ ] Sinh bảng auth vào `src/modules/users/users.schema.ts`, migrate
- [ ] `src/shared/libs/auth-client.lib.ts`, `src/app/api/auth/[...all]/route.ts`
- [ ] `src/shared/libs/session.lib.ts`: `getSession()`, `requireRole(role)` (không có session → sign-in; sai role → 403)
- [ ] `src/shared/libs/action.lib.ts`: `authedProcedure`, `roleProcedure(role)` bằng `createServerActionProcedure`; tài khoản bị khóa thì chặn
- [ ] `src/proxies/authentication.proxy.ts` + `src/proxy.ts`
- [ ] `src/shared/components/layouts/authentication/` và các trang sign-in, forgot-password, reset-password
- [ ] `src/app/page.tsx`: redirect theo role (bọc `<Suspense>` vì `cacheComponents`)
- [ ] Script seed `scripts/seed.ts`: một phòng ban, một tài khoản admin từ biến môi trường

**Xong khi:** đăng nhập admin seed → vào `/administrator`; chưa đăng nhập vào `/workspace/...` → về sign-in; tài khoản thường vào `/administrator` → 403; gọi action admin bằng tài khoản thường → lỗi `NOT_AUTHORIZED`.

### Giai đoạn 3 — Layouts

- [ ] `src/shared/constants/navigation.constant.ts`: menu workspace và administrator (label, href, icon, role cần có)
- [ ] `src/shared/stores/sidebar.store.ts`, `src/shared/hooks/media-query.hook.ts`
- [ ] `src/shared/components/ui/`: `logo.tsx`, `page-header.tsx`, `empty-state.tsx`, `user-avatar-menu.tsx` (đăng xuất)
- [ ] `src/shared/components/layouts/workspace/`: `index.tsx`, `sidebar.tsx`, `topbar.tsx`, `bottom-tabs.tsx`
- [ ] `src/shared/components/layouts/administrator/`: `index.tsx`, `sidebar.tsx` (menu chia nhóm, `ConfigProvider` con cho nền đậm), `header.tsx` (breadcrumb)
- [ ] `layout.tsx` + một `page.tsx` trống cho mỗi mục menu

**Xong khi:** đi hết menu cả hai portal không lỗi 404; thu gọn sidebar giữ trạng thái khi chuyển trang; dưới 768px workspace hiện thanh tab đáy; menu ẩn theo role.

### Giai đoạn 4 — Danh mục tổ chức (admin)

- [ ] Module `departments`: schema, validation, query (`listDepartments`), action (tạo / sửa / xóa; chặn xóa khi còn người dùng — FK đã chặn, chỉ cần dịch lỗi cho dễ hiểu), components (bảng, form trong `Modal`)
- [ ] Trang `/administrator/departments`
- [ ] Module `users`: query (`listUsers` có lọc phòng ban / vai trò / trạng thái, phân trang phía server), action (tạo tài khoản kèm mật khẩu tạm qua `auth.api.createUser`, sửa thông tin, gán vai trò, đổi quản lý, khóa / mở khóa). Chặn chọn quản lý tạo vòng (A quản lý B, B quản lý A)
- [ ] Trang `/administrator/users`, `/administrator/users/[userId]`
- [ ] `/workspace/profile`: xem thông tin, đổi mật khẩu

**Xong khi:** admin tạo được phòng ban, tạo nhân viên có quản lý, nhân viên đó đăng nhập được và đổi được mật khẩu; khóa tài khoản thì phiên hiện tại bị đăng xuất.

### Giai đoạn 5 — Cấu hình quy trình (UC-09, UC-10)

- [ ] Module `request-types`: schema 2 bảng, validation (gồm zod schema cho chính `formSchema`)
- [ ] Định nghĩa `formSchema`: mảng trường `{ key, label, type: text | textarea | number | date | dateRange | select, required, options? }`. Hàm `buildFormValidator(formSchema)` trả zod schema để validate `formData` (dùng ở cả client và server)
- [ ] Trang `/administrator/request-types`: danh sách, tạo, bật/tắt
- [ ] `/administrator/request-types/[typeId]/form`: thêm/sửa trường, sắp xếp bằng dnd-kit, xem trước form
- [ ] `/administrator/request-types/[typeId]/steps`: thêm bước (MANAGER hoặc ROLE + chọn vai trò), sắp xếp bằng dnd-kit; lưu lại `stepOrder` trong một transaction; chặn sửa khi loại đơn có đơn `PENDING`
- [ ] Seed mẫu: Nghỉ phép (1 bước MANAGER), Thanh toán (MANAGER → accountant → cfo, có hạng mục), Mua sắm IT (MANAGER → ceo, có hạng mục)

**Xong khi:** tạo được loại đơn có 3 trường và 2 bước, đổi thứ tự bằng kéo thả rồi tải lại trang vẫn đúng thứ tự.

### Giai đoạn 6 — Tạo đơn (UC-02)

- [ ] Module `requests`: schema 4 bảng, validation, query (`getRequest`, `listMyRequests`), action (`createDraft`, `updateDraft`, `deleteDraft`), `requests.constant.ts` (nhãn + màu trạng thái)
- [ ] `src/shared/libs/storage.lib.ts`: `saveFile`, `readFile`, `deleteFile` trên thư mục `DEFEAT_UPLOAD_DIRECTORY`; tên file trên đĩa là `uuidv7`, không dùng tên người dùng gửi lên
- [ ] Action upload tệp: kiểm tra loại và dung lượng (G8), chỉ chủ đơn và đơn còn `DRAFT`
- [ ] `src/app/api/files/[fileId]/route.ts`: cho tải nếu là người làm đơn, người duyệt có lượt trên đơn (kể cả qua ủy quyền), hoặc admin
- [ ] Component `request-form.tsx`: chọn loại → hiện form động + lộ trình các bước duyệt (antd `Steps`) + vùng tải tệp
- [ ] Component `line-items-table.tsx` (TanStack Table): thêm/xóa dòng, sửa ô, cột Thành tiền và dòng Tổng tự tính phía client để hiển thị
- [ ] Trang `/workspace/requests/new`, `/workspace/requests/[requestId]/edit`
- [ ] Lỗi validate hiện đỏ đúng trường, giữ nguyên dữ liệu đã nhập (UC-02 luồng 8a)

**Xong khi:** tạo đơn Thanh toán 3 hạng mục + 1 tệp, lưu nháp, mở lại sửa được; tổng tiền trong DB đúng bằng tổng cột tính toán; người khác tải tệp → 403.

### Giai đoạn 7 — Quy trình duyệt (UC-04 → UC-07)

- [ ] `approvals.service.ts` (hàm thuần): `resolveApprover(step, requester)`, `nextStep(steps, currentOrder)`, `canAct(approval, user, activeDelegations)`
- [ ] Test cho service bằng `node:test` (`approvals.service.test.ts`, cài `tsx` vào devDependencies, script `test`: `tsx --test src/**/*.test.ts`): bước MANAGER, bước ROLE, không có quản lý, duyệt thay qua ủy quyền, ủy quyền hết hạn, bước cuối
- [ ] `approvals.action.ts`: `submitRequest`, `approveRequest`, `rejectRequest`, `cancelRequest` — mỗi action một transaction, khóa dòng `FOR UPDATE` đơn và lượt, đúng bảng ở `ARCHITECTURE.md` mục 3; ghi `notifications` trong cùng transaction
- [ ] `approvals.query.ts`: `canAccessApprovals(userId)`, `getPendingApprovals(userId)` (lượt `WAITING` của tôi + của vai trò tôi giữ + của người đang ủy quyền cho tôi), `getApprovalHistory(userId)`, `getApprovalTimeline(requestId)`, `countPendingApprovals(userId)`
- [ ] Trang `/workspace/approvals` (bảng, tô đỏ lượt quá `dueAt`), `/workspace/approvals/[requestId]` (nội dung đơn, tệp, dòng thời gian, nút Duyệt / Từ chối; từ chối mở `Modal` bắt buộc lý do), `/workspace/approvals/history`
- [ ] `/workspace/requests/[requestId]`: chi tiết + `approval-timeline.tsx` + nút Hủy (xác nhận trước)

**Xong khi:** đơn Thanh toán đi hết 3 bước bởi 3 tài khoản khác nhau và thành `APPROVED`; từ chối ở bước 2 thì dừng và người làm đơn thấy lý do; hai tab cùng bấm duyệt một lượt → chỉ một lần thành công, tab kia báo "lượt đã được xử lý"; test service qua hết.

### Giai đoạn 8 — Theo dõi và thông báo (UC-01, UC-03)

- [ ] `/workspace/requests`: bảng đơn của tôi, lọc theo trạng thái / loại / thời gian
- [ ] `/workspace/dashboard`: số đơn theo trạng thái, 5 đơn gần nhất, số lượt chờ tôi duyệt
- [ ] Module `notifications`: query (`listNotifications`, `countUnread`), action (`markRead`, `markAllRead`)
- [ ] `notification-bell.tsx` trong topbar: TanStack Query + `zsa-react-query`, `refetchInterval` 30 giây, chỉ chạy khi tab đang mở
- [ ] Badge số lượt chờ duyệt trên menu Phê duyệt (cùng cơ chế)
- [ ] `/workspace/notifications`

**Xong khi:** người duyệt thấy badge tăng trong vòng 30 giây sau khi có đơn gửi tới; bấm thông báo mở đúng đơn và chuyển thành đã đọc.

### Giai đoạn 9 — Ủy quyền (UC-08)

- [ ] Module `delegations`: schema (exclusion constraint), validation, query (`listMyDelegations`, `getActiveDelegatorsFor(userId)`), action (`createDelegation`, `cancelDelegation`)
- [ ] Trang `/workspace/approvals/delegations`: tạo ủy quyền (chọn người, khoảng thời gian, lý do), danh sách kèm trạng thái (`EXPIRED` suy ra)
- [ ] Nối vào `canAccessApprovals`, `getPendingApprovals`, `canAct` của giai đoạn 7 (test service đã có trường hợp ủy quyền)
- [ ] Trang chi tiết lượt duyệt hiện "Duyệt thay <tên>" khi xử lý qua ủy quyền

**Xong khi:** A ủy quyền cho B từ hôm nay → B thấy cả lượt của A tạo từ trước; B duyệt thì audit ghi `actedById = B`, `onBehalfOfId = A`; tạo ủy quyền chồng thời gian → báo lỗi.

### Giai đoạn 10 — Giám sát và báo cáo (admin)

- [ ] `/administrator/requests`: mọi đơn, lọc phòng ban / loại / trạng thái / quá hạn; xem chi tiết và toàn bộ audit trail
- [ ] `/administrator/reports`: số đơn theo loại và trạng thái theo tháng, thời gian duyệt trung bình mỗi bước, tỷ lệ đúng SLA (tính bằng SQL, không kéo dữ liệu về rồi đếm)
- [ ] `/administrator` (tổng quan): đơn đang chờ, lượt quá hạn SLA, người duyệt đang ôm nhiều lượt nhất

**Xong khi:** số liệu báo cáo khớp với đếm tay trên dữ liệu seed.

## 4. Kiểm thử

- **Logic quy trình duyệt:** test `node:test` cho `approvals.service.ts` (giai đoạn 7). Đây là phần duy nhất có test tự động ở bản 1.0, vì sai ở đây là sai nghiệp vụ và khó thấy bằng mắt.
- **Ràng buộc dữ liệu:** để DB giữ (check, unique, FK, exclusion, cột tính toán), không viết test riêng.
- **Còn lại:** kiểm tra tay theo mục "Xong khi" của từng giai đoạn, trên dữ liệu seed.
- Trước khi kết thúc mỗi giai đoạn: `npm run lint` và `npm run build` phải qua.

## 5. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| zsa 0.6 chỉ khai báo hỗ trợ zod 3 (đang chạy được với zod 4) | Gặp lỗi kiểu khi dùng tính năng zod 4 mới → dùng `zod/v3` cho riêng input của action, hoặc bỏ zsa, viết procedure bằng tay (`action.lib.ts` là chỗ duy nhất phải sửa) |
| `cacheComponents` bắt mọi chỗ đọc session nằm trong `<Suspense>` | Làm đúng từ giai đoạn 2; build lỗi thì xem lại chỗ gọi `getSession()` |
| Giả định G1–G9 sai so với nghiệp vụ thật | Chốt với người viết `docs.md` **trước giai đoạn 4** (lúc bắt đầu tạo bảng nghiệp vụ) |
| Form động phức tạp dần (trường điều kiện, công thức) | Bản 1.0 chỉ 6 loại trường ở giai đoạn 5; thêm loại khi có loại đơn thật cần |
| Lưu tệp trên ổ đĩa local không dùng được khi chạy nhiều instance | `storage.lib.ts` là chỗ duy nhất đọc/ghi tệp; chuyển sang S3 / R2 chỉ sửa file này |
