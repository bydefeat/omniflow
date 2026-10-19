# Kiến trúc OmniFlow

Modular monolith trên Next.js App Router: một ứng dụng, một database, nghiệp vụ chia theo module domain. Nghiệp vụ gốc xem `docs.md` (Use Case, CDM, từ điển dữ liệu).

## 1. Route groups và URL

Folder có ngoặc như `(administrator)` là **route group**: **không xuất hiện trên URL**, chỉ dùng để gom route và gắn `layout.tsx` riêng.

Hệ quả:
- Hai group khác nhau **không được** có cùng đường dẫn. Ví dụ `(workspace)/dashboard` và `(administrator)/dashboard` đều ra `/dashboard`, Next.js sẽ báo lỗi.
- **Quy ước:** mọi group có một **folder con thật cùng tên** để tạo tiền tố URL: `(<tên>)/<tên>/...` → `/<tên>/...`. Ví dụ `(administrator)/administrator/users` → `/administrator/users`.
- Không có group `(public)`: đây là hệ thống nội bộ, mọi trang (trừ đăng nhập) đều cần session. Trang `/` chỉ chuyển hướng theo vai trò.

Tham khảo tài liệu route groups trong `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`.

| Group | Tác nhân (docs.md 2.1) | URL |
|---|---|---|
| `(authentication)` | User chưa đăng nhập | `/authentication/...` |
| `(workspace)` | Nhân viên (Requester) và Người phê duyệt (Approver) | `/workspace/...` |
| `(administrator)` | Quản trị viên | `/administrator/...` |

Người phê duyệt **kế thừa** Nhân viên (vẫn tạo đơn cho chính mình), nên không có portal riêng: mục `approvals/` nằm trong `(workspace)` và có kiểm tra quyền riêng, giống `advising/` trong `(lecturer)` của hcmue-portal.

## 2. Cây thư mục

```
src/
├── proxy.ts                         # entry Next bắt buộc: ghép các proxy trong src/proxies/
├── proxies/
│   └── authentication.proxy.ts      # chưa có cookie session → /authentication/sign-in
│
├── app/                             # CHỈ routing: page/layout mỏng, gọi xuống shared + modules
│   ├── layout.tsx                   # root layout DUY NHẤT: <html>, <Suspense> + AntdRegistry layer, <Providers>
│   ├── page.tsx                     # /  → redirect theo role (role.constant.ts)
│   │
│   ├── (authentication)/
│   │   └── authentication/
│   │       ├── layout.tsx           # → <AuthenticationLayout>
│   │       ├── sign-in/page.tsx     # /authentication/sign-in            UC-01
│   │       ├── forgot-password/page.tsx
│   │       └── reset-password/page.tsx
│   │                                # KHÔNG có sign-up: tài khoản do admin tạo (UC quản lý tài khoản)
│   │
│   ├── (workspace)/                 # NHÂN VIÊN + NGƯỜI PHÊ DUYỆT
│   │   └── workspace/
│   │       ├── layout.tsx           # requireRole("employee") → <WorkspaceLayout>
│   │       ├── dashboard/           # /workspace/dashboard       đơn của tôi theo trạng thái, số đơn chờ duyệt
│   │       ├── requests/            # /workspace/requests        đơn của tôi                UC-03
│   │       │   ├── new/             # chọn loại đơn → form động                         UC-02
│   │       │   └── [requestId]/     # chi tiết + dòng thời gian duyệt, nút hủy          UC-03, UC-04
│   │       │       └── edit/        # khi đơn đang DRAFT, hoặc NEEDS_INFO (bổ sung & gửi lại)
│   │       ├── approvals/           # mục PHÊ DUYỆT
│   │       │   ├── layout.tsx       # canAccessApprovals(): có vai trò duyệt, đang được ủy quyền hoặc từng xử lý lượt
│   │       │   ├── page.tsx         # /workspace/approvals       đơn chờ tôi duyệt         UC-05
│   │       │   ├── [requestId]/     # xem đơn, phê duyệt / từ chối / yêu cầu bổ sung     UC-06, UC-07
│   │       │   └── history/         # các lượt tôi đã xử lý hoặc được duyệt thay
│   │       ├── delegations/         # ủy quyền đã tạo và được nhận                      UC-08
│   │       ├── notifications/       # UC-01
│   │       └── profile/
│   │
│   ├── (administrator)/             # QUẢN TRỊ VIÊN
│   │   └── administrator/
│   │       ├── layout.tsx           # requireRole("admin") → <AdministratorLayout>
│   │       ├── page.tsx             # /administrator             tổng quan, đơn quá hạn SLA
│   │       ├── departments/         # phòng ban
│   │       ├── users/               # tài khoản, vai trò, phòng ban, quản lý trực tiếp (sửa trong modal)
│   │       ├── request-types/       # loại đơn                                            UC-09
│   │       │   └── [typeId]/
│   │       │       ├── form/        # cấu hình trường nhập liệu động (kéo thả)           UC-09
│   │       │       └── steps/       # các bước duyệt theo thứ tự (kéo thả)               UC-10
│   │       ├── requests/            # giám sát toàn bộ đơn, xem audit trail
│   │       ├── reports/             # thống kê, tỷ lệ đúng SLA
│   │       ├── delegations/         # tạo / hủy ủy quyền thay người duyệt vắng mặt
│   │       └── audit-log/           # nhật ký thao tác quản trị (ai, lúc nào, đổi gì, IP)
│   │
│   └── api/
│       ├── auth/[...all]/route.ts   # handler của better-auth
│       ├── exports/requests/route.ts # xuất CSV danh sách đơn (chỉ admin)
│       └── files/[fileId]/route.ts  # tải tệp đính kèm, kiểm tra quyền trước khi trả file
│
├── modules/                         # NGHIỆP VỤ theo domain (bounded context), xem mục 3
│   ├── schema.ts                    # gom mọi *.schema.ts cho db.lib.ts và auth.lib.ts
│   ├── departments/                 # mỗi module, ví dụ requests/:
│   ├── users/                       #   requests.schema.ts      bảng Drizzle
│   ├── request-types/               #   requests.validation.ts  zod schema, dùng chung form client + action
│   ├── requests/                    #   requests.query.ts       hàm đọc dữ liệu (server)
│   ├── approvals/                   #   requests.action.ts      server action (action.lib.ts)
│   ├── delegations/                 #   requests.constant.ts    nhãn + màu trạng thái
│   ├── notifications/               #   components/             UI riêng của module
│   └── audit/                       # nhật ký quản trị: recordAudit() ghi trong cùng transaction
│
└── shared/                          # KHÔNG chứa nghiệp vụ; ai cũng import được
    ├── components/
    │   ├── providers.tsx            # "use client": QueryClientProvider, ConfigProvider (theme, vi_VN), antd App
    │   ├── layouts/                 # 3 layout độc lập, xem mục 4
    │   │   ├── authentication/
    │   │   ├── workspace/
    │   │   └── administrator/
    │   └── ui/                      # Logo, PageHeader, PageSkeleton, UserAvatarMenu, SortableList (dnd-kit)
    ├── constants/
    │   ├── theme.constant.ts        # bảng màu + antd ThemeConfig (nguồn màu DUY NHẤT)
    │   ├── navigation.constant.ts   # menu của từng portal (label, href, icon, access) — chỉ import từ client
    │   └── role.constant.ts         # vai trò truy cập + vai trò chức năng + trang đích sau login
    ├── libs/
    │   ├── env.lib.ts               # parse các biến DEFEAT_* bằng zod
    │   ├── db.lib.ts                # drizzle client (casing snake_case) + schema từ modules/schema.ts
    │   ├── schema.lib.ts            # helper cột dùng chung cho *.schema.ts: id() (uuidv7), timestamps
    │   ├── auth.lib.ts              # betterAuth() (server)
    │   ├── auth-client.lib.ts       # createAuthClient() (client)
    │   ├── session.lib.ts           # getSession(), requireSession(), requireRole() → forbidden()
    │   ├── role.lib.ts              # parseRoles(), hasRole(), getHomePath(), safeCallbackPath()
    │   ├── action.lib.ts            # authedProcedure, roleProcedure(role), ActionError
    │   ├── mail.lib.ts              # hàng đợi email_outbox: queueMail(), flushMailOutbox()
    │   ├── list-params.lib.ts       # đọc q / page từ searchParams, PAGE_SIZE
    │   ├── query-client.lib.ts      # tạo QueryClient (TanStack Query)
    │   ├── storage.lib.ts           # lưu / đọc file đính kèm: uploads/ hoặc S3/R2
    │   ├── db-error.lib.ts          # pgErrorCode() + mã lỗi Postgres (unique, FK, exclusion)
    │   ├── format.lib.ts            # formatMoney(), formatDate(), formatDateTime()
    │   └── navigation.lib.ts        # findActiveItem(): mục menu đang chọn
    ├── hooks/
    │   └── list-filters.hook.ts     # cập nhật bộ lọc danh sách lên URL
    └── stores/                      # zustand CHỈ cho state UI
        └── sidebar.store.ts         # export useSidebarStore
```

### Quy ước đặt tên file

Tên file dạng `<tên>.<loại>.ts`, phần `<tên>` viết kebab-case. Trong `shared/` dùng số ít (`role.constant.ts`); trong `modules/` dùng đúng tên folder module (`requests.query.ts`). Nhìn đuôi file là biết loại, không phụ thuộc file nằm ở folder nào.

| Loại | Đuôi | Ví dụ | Export |
|---|---|---|---|
| Proxy | `*.proxy.ts` | `authentication.proxy.ts` | `authenticationProxy` |
| Lib | `*.lib.ts` | `env.lib.ts`, `action.lib.ts` | `env`, `authedProcedure` |
| Constant | `*.constant.ts` | `theme.constant.ts`, `requests.constant.ts` | `THEME`, `REQUEST_STATUS_META` |
| Store | `*.store.ts` | `sidebar.store.ts` | `useSidebarStore` |
| Drizzle schema | `*.schema.ts` | `requests.schema.ts` | các bảng `requests`, `requestItems`... |
| Zod schema | `*.validation.ts` | `requests.validation.ts` | `createRequestInput` |
| Ghi thông báo (server, không phải action) | `*.notify.ts` | `approvals.notify.ts` | `notify`, `sendOverdueReminders` |
| Query (đọc) | `*.query.ts` | `approvals.query.ts` | `getPendingApprovals()` |
| Server action (ghi) | `*.action.ts` | `approvals.action.ts` | `approveRequest` |
| Logic thuần | `*.service.ts` | `approvals.service.ts` | `resolveApprover()` |
| Component | `kebab-case.tsx`, **không** có đuôi loại | `approval-timeline.tsx` | `ApprovalTimeline` |

Ngoại lệ: file mà Next.js quy định tên (`proxy.ts`, `layout.tsx`, `page.tsx`, `route.ts`...) giữ nguyên tên gốc.

`*.validation.ts` tách khỏi `*.action.ts` vì file `"use server"` chỉ được export hàm async; form client cần import zod schema để validate trước khi gửi. `*.service.ts` là hàm thuần (không đọc DB, không `"use server"`), chỉ có ở module có logic đáng test riêng như `approvals`.

## 3. Modules

### Bản đồ module ↔ thực thể

| Module | Thực thể (docs.md 3.2) | Bảng Drizzle | Use case |
|---|---|---|---|
| `departments` | PHONG_BAN | `departments` | quản lý phòng ban |
| `users` | NGUOI_DUNG, VAI_TRO | mở rộng bảng `user` của better-auth: `departmentId`, `managerId`, `status`. Vai trò dùng trường `role` của plugin `admin` | UC-01, quản lý tài khoản |
| `request-types` | LOAI_YEU_CAU, BUOC_DUYET | `requestTypes`, `approvalSteps` | UC-09, UC-10 |
| `requests` | DON_YEU_CAU, HANG_MUC_CHI_TIET, TEP_DINH_KEM | `requests`, `requestItems`, `attachments`, `requestRevisions` (bản chụp nội dung mỗi lần bị trả về bổ sung; tệp đã gửi chỉ gỡ mềm bằng `removedAt`) | UC-02, UC-03 |
| `approvals` | LUOT_PHE_DUYET | `approvals` | UC-04 → UC-07, chuyển trạng thái đơn |
| `delegations` | UY_QUYEN | `delegations` | UC-08 |
| `notifications` | (không có trong CDM, từ UC-01) | `notifications` | UC-01 |
| `audit` | (không có trong CDM, yêu cầu vận hành) | `audit_logs` | nhật ký thao tác quản trị |

`MatKhau` của NGUOI_DUNG không nằm trong bảng `user`: better-auth lưu mật khẩu đã băm ở bảng `account`.

CDM không có khóa ngoại (đúng chuẩn Merise). Khóa ngoại được thêm khi viết `*.schema.ts` (mức PDM), suy ra từ bảng Mối kết hợp ở docs.md 3.1. Ví dụ "Tạo Đơn (1,1)-(0,n)" → `requests.requesterId` tham chiếu `user.id`.

### Hướng import

**Giữa các lớp (một chiều):** `app` → `modules` → `shared`. `shared` không import `modules` hay `app`. Ngoại lệ: `db.lib.ts`, `auth.lib.ts` và `mail.lib.ts` (hàng đợi `email_outbox`) là điểm nối, được import `modules/schema.ts` (chỉ bảng, không nghiệp vụ).

**Giữa các module:** khác hcmue-portal (module không import module), OmniFlow cho phép import có giới hạn, vì quy trình duyệt phải ghi nhiều bảng trong **một transaction** (gửi đơn = đổi trạng thái đơn + tạo lượt duyệt cấp 1 + tạo thông báo). Ghép ở `app` thì không giữ được transaction.

- Chỉ được import `*.schema.ts`, `*.query.ts`, `*.constant.ts`, `*.validation.ts` và `*.service.ts` của module khác. **Không** import `*.action.ts` hay `components/` của module khác.
- Ngoại lệ đã biết: `hasPendingRequests()` trong `request-types.query.ts` đọc bảng `requests` bằng SQL thô (ngược chiều mũi tên) để khóa sửa bước duyệt khi còn đơn chờ. Chỉ đọc, không import code của `requests`.
- Server action của module khác cần dùng trong component (ví dụ form tạo đơn ở `requests` cần `submitRequest` của `approvals`) thì page ở `app` truyền action đó xuống làm prop.
- Chỉ import theo chiều mũi tên dưới đây (không vòng):

```
departments ← users ← request-types ← requests ← approvals
                 ↑                                  │
                 └──────── delegations ←────────────┤
                           notifications ←──────────┘
```

- `audit` là module lá: không import module nào (`actor_id` không có khóa ngoại để tránh vòng `users` ↔ `audit`), mọi module có thao tác quản trị đều được gọi `recordAudit()` trong `audit.service.ts`, truyền `tx` để nhật ký và thay đổi cùng commit hoặc cùng rollback.
- Cần dữ liệu chéo chỉ để **hiển thị** (ví dụ trang chi tiết đơn = thông tin đơn + dòng thời gian duyệt) thì vẫn để `app` ghép: page gọi `getRequest()` của `requests` và `getApprovalTimeline()` của `approvals`.

### Quy trình duyệt (module `approvals`)

Đây là phần lõi. Mọi thay đổi trạng thái đơn **chỉ** đi qua `approvals.action.ts`; module `requests` chỉ tạo và sửa đơn nháp.

**Trạng thái đơn (`requests.status`):**

```
DRAFT ──submit──▶ PENDING ──duyệt bước cuối──▶ APPROVED
  │               │  ▲  ├──────từ chối────────▶ REJECTED
  │   yêu cầu bổ sung│  │gửi lại
  │               ▼  │
  │             NEEDS_INFO
  └──xóa nháp       └──────────hủy (PENDING hoặc NEEDS_INFO)──▶ CANCELLED
```

**Trạng thái lượt duyệt (`approvals.result`):** `WAITING` → `APPROVED` | `REJECTED` | `RETURNED` (yêu cầu bổ sung, bắt buộc nội dung); lượt đang `WAITING` chuyển `CANCELLED` khi người làm đơn hủy. Mỗi đơn có tối đa một lượt `WAITING` (unique index một phần); một bước có thể có nhiều lượt khi đơn được trả về rồi gửi lại.

| Action | Việc làm trong một transaction |
|---|---|
| `submitRequest` | Kiểm tra đơn là DRAFT của chính người gọi → khóa chia sẻ dòng loại đơn, chụp `formSchema`/`hasLineItems`/`slaHours`/bước duyệt vào `requests.snapshot` → `PENDING` → tạo lượt cho bước 1 → thông báo người duyệt |
| `approveRequest` | Khóa đơn rồi khóa lượt (`SELECT ... FOR UPDATE`), kiểm tra `WAITING` và đúng người duyệt → `APPROVED`. Bước kế tiếp lấy từ `snapshot`, không đọc cấu hình hiện tại. Hết bước: đơn `APPROVED`, thông báo người làm đơn |
| `rejectRequest` | Như trên, bắt buộc `YKienPhanHoi` (zod) → lượt `REJECTED`, đơn `REJECTED`, dừng quy trình, thông báo kèm lý do |
| `returnRequest` | Như `rejectRequest` nhưng lượt `RETURNED`, đơn `NEEDS_INFO`, báo người làm đơn kèm nội dung cần bổ sung |
| `resubmitRequest` | Chỉ người làm đơn, đơn `NEEDS_INFO`: kiểm tra biểu mẫu theo `snapshot` → `PENDING` → mở lượt mới từ bước đầu (nội dung có thể đã đổi nên các bước trước duyệt lại) |
| `cancelRequest` | Chỉ người làm đơn, đơn đang PENDING hoặc NEEDS_INFO → `CANCELLED`, các lượt `WAITING` → `CANCELLED`, báo người duyệt (kể cả người giữ vai trò và người được ủy quyền) |
| `reassignApproval` | Chỉ admin. Giao lượt `WAITING` cho một người cụ thể khi người duyệt bị khóa hoặc không còn ai giữ vai trò; ghi `reassignedById`, `reassignedAt` |

**Thứ tự khóa:** mọi action ghi đơn khóa dòng `requests` trước, rồi mới tới `approvals`, để không deadlock. Sửa / xóa nháp và thêm / xóa tệp khóa dòng đơn đang `DRAFT` trong transaction, nên không chạm được đơn vừa gửi.

**Xác định người duyệt** (`resolveApprover()` trong `approvals.service.ts`), chạy khi tạo mỗi lượt:
1. Bước có `KieuNguoiDuyet = MANAGER` → gán `approverId` = `managerId` của người làm đơn. Bước `ROLE` → gán `approverRole`, mọi người có vai trò đó đều thấy lượt này, ai xử lý trước thì lượt thuộc về người đó (khóa dòng chặn hai người cùng duyệt).
2. Không tìm được ai (không có quản lý, không ai giữ vai trò) → không cho gửi đơn, báo lỗi rõ cho người dùng (cấu hình thiếu), không tạo lượt treo.

**Ủy quyền xét lúc đọc và lúc duyệt, không xét lúc tạo lượt:** người B thấy và duyệt được lượt của A nếu A đang ủy quyền cho B (`ACTIVE`, `NgayBatDau ≤ now ≤ NgayKetThuc`). Khi B duyệt, lưu `actedById = B`, `onBehalfOfId = A`. Nhờ vậy lượt tạo trước khi ủy quyền vẫn chuyển cho B, và hết hạn ủy quyền thì tự trả về A.

Tiền luôn tính lại ở server (`ThanhTien = SoLuong × DonGia`, `TongTien = Σ ThanhTien`), không tin số client gửi lên. Mã đơn `REQ-<năm>-<số>` sinh trong transaction từ sequence của Postgres.

## 4. Layouts

### Nguyên tắc

- **3 layout độc lập**, mỗi layout một folder, **không import lẫn nhau** và không có "BaseLayout" chung.
- **Thứ duy nhất dùng chung là màu sắc:** tất cả đọc từ `shared/constants/theme.constant.ts`. Không hardcode mã màu trong layout.
- Phần dùng chung thật sự nhỏ (Logo, avatar menu) đặt ở `shared/components/ui/`. Phần thuộc module (chuông thông báo, badge số đơn chờ duyệt) do `app/.../layout.tsx` truyền vào qua prop `headerExtra` / `badges`, nên `shared` không import `modules`.
- `app/.../layout.tsx` chỉ làm 2 việc: kiểm tra quyền và render layout tương ứng.

### Bảng màu

Chưa có bộ nhận diện thương hiệu; tạm dùng màu mặc định của antd, đổi ở một chỗ khi có brand.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `primary` | `#1677FF` (antd mặc định, tạm) | Header, sidebar, nút chính, link |
| Neutral | Xám của antd | Nền nội dung, viền, chữ phụ |

**Màu trạng thái đơn** là thông tin quan trọng nhất trên giao diện, khai báo một lần ở `requests.constant.ts` và dùng qua antd `Tag` / `Badge`:

| Trạng thái | Màu antd | Nhãn |
|---|---|---|
| `DRAFT` | `default` | Nháp |
| `PENDING` | `processing` | Chờ duyệt |
| `APPROVED` | `success` | Đã duyệt |
| `REJECTED` | `error` | Từ chối |
| `CANCELLED` | `default` + gạch ngang | Đã hủy |

### Thiết kế từng layout

| Layout | Người dùng & thiết bị | Khung trang | Điểm riêng |
|---|---|---|---|
| **Authentication** | Mọi người, chưa đăng nhập | Chia đôi: trái là panel màu primary có logo và tên hệ thống; phải là form | Trên điện thoại bỏ panel trái |
| **Workspace** | Nhân viên, người duyệt; máy tính là chính, **người duyệt hay duyệt trên điện thoại** khi đi công tác | Máy tính: sidebar trái thu gọn được + topbar (nút "Tạo đề xuất", chuông thông báo có badge, avatar). Điện thoại: **thanh tab dưới đáy** (Tổng quan, Đơn của tôi, Tạo, Chờ duyệt, Thêm) | Menu "Phê duyệt" có badge số đơn chờ; chỉ hiện khi có quyền duyệt. Trang chi tiết đơn có thanh hành động Duyệt / Từ chối dính đáy màn hình trên điện thoại |
| **Administrator** | Quản trị viên, máy tính | Sidebar đậm, menu chia nhóm (Tổ chức: phòng ban, người dùng · Quy trình: loại đơn, bước duyệt · Giám sát: đơn, báo cáo) + header (breadcrumb, avatar) | Mật độ cao: bảng antd `size="small"`. Màn cấu hình form và bước duyệt dùng kéo thả |

### Cấu trúc một folder layout

```
shared/components/layouts/workspace/
├── index.tsx              # export WorkspaceLayout (server component)
├── sidebar.tsx            # "use client" — thu gọn/mở, đọc từ stores
├── topbar.tsx
└── bottom-tabs.tsx        # chỉ workspace có
```

Mỗi folder chỉ export `index.tsx`. Menu lấy từ `shared/constants/navigation.constant.ts`.

## 5. Quyết định chính

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Kiến trúc | Modular monolith: một app Next.js, module theo domain trong `src/modules/` | Một nhóm, một database, quy trình duyệt cần transaction xuyên bảng. Ranh giới module rõ để sau này tách được nếu cần |
| Root layout | Chỉ 1 file `app/layout.tsx` | Nhiều root layout thì chuyển portal phải tải lại toàn trang |
| Theme | 1 `ConfigProvider` ở root đọc `theme.constant.ts`; layout cần chỉnh thì lồng `ConfigProvider` con | Màu chỉ khai báo một chỗ |
| Slug URL | Tiếng Anh (`/workspace/requests`) | Đồng bộ với tên code |
| Phân quyền | 3 lớp: `authentication.proxy.ts` chỉ xem có cookie session; `layout.tsx` gọi `requireRole()` để dựng khung portal; **mỗi `page.tsx` tự gọi `requireRole()` / kiểm tra quyền** trước khi đọc dữ liệu. Action kiểm tra lại qua `authedProcedure` / `roleProcedure` | Khi điều hướng phía client, Next 16 chỉ render segment thay đổi nên layout không chạy lại: chỉ kiểm ở layout thì người có cookie hợp lệ phát lại request RSC của trang quản trị là đọc được dữ liệu (`authz.spec.ts` tái hiện). Action là API công khai nên phải tự kiểm tra |
| Vai trò | Plugin `admin` của better-auth, một user nhiều role (`employee`, `approver`, `admin`). Mọi tài khoản đều có `employee` | Đúng quan hệ kế thừa ở docs.md 2.1. Admin cũng tạo đơn được |
| Quyền mục Phê duyệt | `canAccessApprovals()` đặt ở `approvals.query.ts`, không ở `shared` | Phụ thuộc dữ liệu ủy quyền, là nghiệp vụ |
| Sau đăng nhập | `admin` → `/administrator`, còn lại → `/workspace/dashboard` (khai báo ở `role.constant.ts`) | |
| Server action | Lớp bọc riêng ở `action.lib.ts`: `authedProcedure` / `roleProcedure(role)` cho session và vai trò, `.input(zodSchema)` (hoặc `{ type: "formData" }`) cho dữ liệu, trả `[data, error]`; lỗi nghiệp vụ ném `ActionError(code, message)` | Validate và kiểm quyền một chỗ, lỗi trả về có kiểu, không phụ thuộc thư viện viết cho zod 3 |
| Dữ liệu server | Mặc định: server component gọi `*.query.ts`. **TanStack Query chỉ dùng** cho dữ liệu client cần tự làm mới (chuông thông báo, số đơn chờ duyệt), `queryFn` gọi thẳng action zsa | Không đồng bộ một dữ liệu ở hai nơi khi không cần |
| Múi giờ | Mọi ngày giờ hiển thị qua `format.lib.ts`, cố định `Asia/Ho_Chi_Minh` bằng `Intl.DateTimeFormat` | Server (thường chạy UTC) và trình duyệt ra cùng một chuỗi: đúng giờ Việt Nam và không lỗi hydration |
| Component antd trong server component | Chỉ dùng export có tên (`Button`, `Tag`); không dùng `X.Y` (`Layout.Content`...) hay icon — đặt trong component `"use client"` | Từ server, client component chỉ là tham chiếu theo tên export; thuộc tính tĩnh thành `undefined` |
| State UI | `zustand` chỉ giữ state UI (sidebar, bộ lọc đang chọn) | |
| Bảng | antd `Table` cho mọi bảng danh sách. **TanStack Table** chỉ cho bảng hạng mục chi tiết sửa trực tiếp (thêm/xóa dòng, cột Thành tiền tự tính) | antd Table đủ cho bảng đọc; bảng sửa inline cần kiểm soát dòng/ô mà antd làm cồng kềnh |
| Kéo thả | dnd-kit cho sắp xếp bước duyệt (UC-10) và trường form (UC-09) | |
| Animation | Motion cho chuyển trạng thái nhỏ (dòng thời gian duyệt, toast); không animate bảng dữ liệu | |
| Form động (UC-09) | `requestTypes.formSchema` (jsonb) mô tả các trường; `requests.formData` (jsonb) lưu giá trị. Server dựng zod schema từ `formSchema` để validate | Thêm loại đơn không cần migration |
| Tệp đính kèm | Lưu qua `storage.lib.ts` (ổ đĩa local, hoặc S3 khi cấu hình `DEFEAT_S3_*`), kiểm tra đuôi và chữ ký nội dung tệp, chỉ tải được qua `api/files/[fileId]` có kiểm quyền | Hóa đơn, báo giá là dữ liệu nhạy cảm, không để URL công khai |
| Audit trail | Bảng `approvals` là vết kiểm toán: ai, lúc nào, kết quả, ý kiến, duyệt thay ai. Không xóa, không sửa lượt đã xử lý | Yêu cầu chống gian lận ở docs.md chương 1 |
| Bản chụp quy trình | Lúc gửi, `requests.snapshot` giữ biểu mẫu, cờ hạng mục, SLA và các bước; chi tiết đơn, dòng thời gian và bước kế tiếp đều đọc từ đây | Admin sửa loại đơn sau đó không làm đổi đơn đang chạy hay đã xong |
| Biến môi trường | Tiền tố `DEFEAT_*`, xem `.env.example`, parse ở `env.lib.ts`. SMTP (`DEFEAT_SMTP_CONNECTION_URL`) và S3 (`DEFEAT_S3_*`) tùy chọn | Giống hcmue-portal. better-auth phải truyền `secret`, `baseURL` khi khởi tạo |
| `cacheComponents` | Đang bật: code đọc `cookies()`/`headers()` phải nằm trong `<Suspense>` | Nếu không, build sẽ lỗi |

## 6. Điểm cần chốt lại trong docs.md

Khi ánh xạ CDM sang code, các chỗ sau trong `docs.md` chưa đủ để cài đặt. Kiến trúc trên đang giả định như cột "Đề xuất":

| Chỗ thiếu | Ảnh hưởng | Đề xuất |
|---|---|---|
| Không có quan hệ "quản lý trực tiếp" giữa NGUOI_DUNG | Bước `KieuNguoiDuyet = MANAGER` không biết ai duyệt | Thêm `managerId` (tự tham chiếu) vào người dùng |
| BUOC_DUYET kiểu `ROLE` không nói vai trò nào, phạm vi nào | Không xác định được người duyệt | Thêm `approverRole` (VD: `ACCOUNTANT`, `CFO`) và `approverUserId` (tùy chọn); cần chốt có lọc theo phòng ban không |
| `DON_YEU_CAU.TrangThai` thiếu `DRAFT` dù UC-02 có "Lưu nháp" | | Thêm `DRAFT` |
| Bảng tác nhân có "yêu cầu bổ sung" nhưng không có UC hay trạng thái tương ứng | | **Đã làm:** trạng thái `NEEDS_INFO`, lượt `RETURNED`, bổ sung & gửi lại thì duyệt lại từ bước đầu |
| UC-04 chỉ cho hủy khi "Chờ duyệt" | Đơn nháp không xóa được | Cho hủy cả DRAFT; hoặc chỉ cho hủy PENDING khi chưa có ai duyệt |
| UY_QUYEN chỉ có một mối kết hợp với NGUOI_DUNG | Không biết ủy quyền cho ai | Hai quan hệ: người ủy quyền và người được ủy quyền |
| LUOT_PHE_DUYET chưa gắn với người duyệt gốc khi duyệt thay | Audit không biết lượt này duyệt thay ai | Thêm `onBehalfOfId` |
| Form động (UC-09) không có thuộc tính lưu cấu hình form và dữ liệu form | | `formSchema` / `formData` kiểu jsonb |
| THONG_BAO không có trong CDM dù UC-01 cần | | Thêm thực thể thông báo |

## 7. Lộ trình triển khai

1. **Nền tảng:** cài antd, drizzle, better-auth, zod, zsa, zustand, TanStack Query/Table, dnd-kit, motion. Viết `env.lib.ts`, `db.lib.ts`, `drizzle.config.ts`, `theme.constant.ts`, gắn `ConfigProvider` + `Providers` ở root layout.
2. **Auth:** `auth.lib.ts`, `auth-client.lib.ts`, `session.lib.ts`, `action.lib.ts`, route `api/auth`, `src/proxy.ts` + `authentication.proxy.ts`, `AuthenticationLayout` và trang sign-in / forgot-password / reset-password.
3. **Layouts:** `WorkspaceLayout`, `AdministratorLayout` cùng `navigation.constant.ts`, mỗi portal một trang trống.
4. **Danh mục (admin):** phòng ban, người dùng (vai trò, quản lý trực tiếp), seed tài khoản admin đầu tiên.
5. **Cấu hình quy trình (admin):** loại đơn, form động, bước duyệt kéo thả (UC-09, UC-10). Phải có thì nhân viên mới có loại đơn để tạo.
6. **Tạo đơn (nhân viên):** form động, bảng hạng mục, tệp đính kèm, lưu nháp (UC-02).
7. **Quy trình duyệt:** `submitRequest`, `approveRequest`, `rejectRequest`, `cancelRequest`, `resolveApprover()` kèm test; trang chờ duyệt và chi tiết (UC-04 → UC-07).
8. **Theo dõi và thông báo:** dòng thời gian duyệt, đơn của tôi, chuông thông báo (UC-01, UC-03).
9. **Ủy quyền** (UC-08) và đưa vào `resolveApprover()`.
10. **Giám sát và báo cáo** cho admin: toàn bộ đơn, audit trail, đơn quá hạn SLA.
