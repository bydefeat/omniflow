**TÀI LIỆU PHÂN TÍCH & THIẾT KẾ HỆ THỐNG THÔNG TIN**  
**HỆ THỐNG QUẢN LÝ YÊU CẦU & PHÊ DUYỆT NỘI BỘ**  
**(INTERNAL REQUEST & APPROVAL SYSTEM)**

**———————————————————————————————————**

*Tài liệu đặc tả: Sơ đồ Ca sử dụng (Use Case) • Mô hình Quan niệm (CDM) • Từ điển dữ liệu*  
*Ngày hoàn thiện: Tháng 10/2026*  
*Phiên bản: 1.0 (Full Specification)*

# CHƯƠNG 1: TỔNG QUAN HỆ THỐNG

Hệ thống Quản lý Yêu cầu và Phê duyệt Nội bộ là giải pháp số hóa quy trình nghiệp vụ văn phòng (BPMN) dành cho doanh nghiệp. Hệ thống giải quyết các bài toán sau:

- Chuyển đổi các loại đề xuất giấy (Nghỉ phép, Thanh toán, Tạm ứng, Mua sắm linh kiện IT, Công tác...) thành quy trình số minh bạch, tức thời.

- Thiết lập quy trình duyệt đa cấp tự động (Phê duyệt tuần tự qua Quản lý trực tiếp, Trưởng phòng chuyên môn, Ban Giám đốc).

- Hỗ trợ phân quyền người duyệt theo Quản lý trực tiếp hoặc theo Vai trò chức năng.

- Hỗ trợ ủy quyền phê duyệt (Delegation) khi cấp quản lý đi công tác hoặc nghỉ vắng mặt.

- Lưu trữ vết kiểm toán (Audit Trail) và tệp chứng từ đính kèm (hóa đơn, báo giá) chống thất lạc và gian lận.

# CHƯƠNG 2: MÔ HÌNH CA SỬ DỤNG (USE CASE DIAGRAM)

## 2.1. Phân loại Tác nhân (Actors)

Các tác nhân trong hệ thống có mối quan hệ phân cấp và kế thừa logic như sau:

| Tác nhân (Actor) | Phân loại | Mô tả vai trò trong hệ thống |
|---|---|---|
| Người dùng chung (User) | Tác nhân gốc | Tất cả cán bộ nhân viên có tài khoản: Đăng nhập, quản lý thông tin cá nhân, xem và nhận thông báo hệ thống. |
| Nhân viên (Employee/Requester) | Kế thừa User | Người khởi tạo đề xuất: Tạo đơn, nhập chi tiết hạng mục, đính kèm chứng từ, hủy đơn nháp, theo dõi tiến độ. |
| Người phê duyệt (Approver) | Kế thừa Nhân viên | Cấp quản lý (Team Lead, HOD, CFO, CEO): Xem đơn chờ duyệt, phê duyệt, từ chối kèm lý do, yêu cầu bổ sung, ủy quyền duyệt. |
| Quản trị viên (Admin) | Kế thừa User | Quản trị hệ thống: Quản lý phòng ban, tài khoản, cấu hình loại đơn đề xuất và thiết lập các bước quy trình phê duyệt. |

## 2.2. Danh sách Ca sử dụng (Use Cases) theo Phân hệ

| Mã UC | Tên Ca sử dụng | Tác nhân chính | Ghi chú quan hệ |
|---|---|---|---|
| UC-01 | Đăng nhập & Thông báo | User | Ca sử dụng chung toàn hệ thống |
| UC-02 | Tạo yêu cầu đề xuất mới | Nhân viên | <<include>> Chọn loại đơn; <<extend>> Nhập hạng mục, Tệp đính kèm |
| UC-03 | Theo dõi tiến độ & Lịch sử đơn | Nhân viên, Người duyệt | Xem dòng chảy các cấp đã duyệt hoặc đang chờ |
| UC-04 | Hủy đơn đề xuất | Nhân viên | Chỉ được hủy khi đơn đang ở trạng thái Chờ duyệt |
| UC-05 | Xem danh sách đơn chờ duyệt | Người phê duyệt | Lọc các đơn thuộc cấp của mình hoặc được ủy quyền |
| UC-06 | Phê duyệt đơn | Người phê duyệt | Chuyển đơn sang cấp tiếp theo hoặc hoàn tất duyệt |
| UC-07 | Từ chối đơn | Người phê duyệt | <<include>> Bắt buộc nhập lý do từ chối |
| UC-08 | Ủy quyền phê duyệt | Người phê duyệt | Ủy thác quyền duyệt trong một khoảng thời gian cụ thể |
| UC-09 | Cấu hình Loại đơn & Biểu mẫu | Quản trị viên | Cài đặt form nhập liệu động cho từng loại đề xuất |
| UC-10 | Thiết lập Quy trình & Bước duyệt | Quản trị viên | Cài đặt ma trận thứ tự các cấp duyệt (Step 1, Step 2...) |

## 2.3. Đặc tả Kịch bản Ca sử dụng Tiêu biểu

### Đặc tả UC-02: Tạo yêu cầu đề xuất mới

- **Tác nhân chính:** Nhân viên (Requester)
- **Tiền điều kiện:** Nhân viên đã đăng nhập thành công vào hệ thống.
- **Hậu điều kiện:** Đơn được lưu trữ thành công với trạng thái PENDING; hệ thống tạo lượt duyệt cấp 1 và gửi thông báo đến cấp quản lý tương ứng.
- **Luồng sự kiện chính:**
   1. Nhân viên chọn chức năng 'Tạo đề xuất mới' trên thanh menu.
   2. Hệ thống tải danh mục các loại đơn (Nghỉ phép, Thanh toán, Mua sắm...).
   3. Nhân viên chọn loại đơn cần tạo.
   4. Hệ thống tải biểu mẫu tương ứng và hiển thị lộ trình các cấp duyệt.
   5. Nhân viên điền tiêu đề, lý do và tải lên chứng từ đính kèm (nếu có).
   6. Đối với đơn tài chính/mua sắm: Nhân viên nhập danh sách các mặt hàng chi tiết (Tên món, số lượng, đơn giá); hệ thống tự cộng tổng tiền.
   7. Nhân viên nhấn nút 'Gửi duyệt'.
   8. Hệ thống kiểm tra tính hợp lệ của dữ liệu, ghi nhận đơn vào CSDL, khởi tạo bước duyệt 1 và gửi thông báo.
   9. Hệ thống thông báo thành công và chuyển về trang danh sách đề xuất của tôi.
- **Luồng rẽ nhánh / Ngoại lệ:**
   - 5a. Lưu nháp: Nhân viên chọn 'Lưu nháp' -> Đơn lưu ở trạng thái DRAFT, chưa kích hoạt lượt duyệt.
   - 8a. Thiếu thông tin: Bỏ trống ô bắt buộc -> Hệ thống báo lỗi viền đỏ và giữ nguyên dữ liệu đã nhập.

### Đặc tả UC-06 & UC-07: Phê duyệt / Từ chối đơn

- **Tác nhân chính:** Người phê duyệt (Approver)
- **Tiền điều kiện:** Có đơn đề xuất đang ở trạng thái WAITING tại cấp duyệt của người này.
- **Hậu điều kiện:** Bản ghi duyệt được cập nhật; đơn được chuyển tiếp sang bước sau hoặc kết thúc quy trình.
- **Luồng sự kiện chính:**
   1. Người duyệt truy cập danh sách 'Đơn chờ tôi duyệt'.
   2. Chọn xem chi tiết một đơn (nội dung giải trình, hóa đơn đính kèm, các cấp trước đã duyệt).
   3. Người duyệt nhấn nút 'Phê duyệt', nhập ý kiến nhận xét (tùy chọn) và bấm Xác nhận.
   4. Hệ thống cập nhật kết quả duyệt hiện tại thành APPROVED.
   5. Nếu còn bước duyệt sau: Hệ thống sinh lượt duyệt cho cấp tiếp theo và gửi thông báo.
   6. Nếu là bước duyệt cuối cùng: Hệ thống chuyển trạng thái đơn thành APPROVED và thông báo cho người làm đơn.
- **Luồng rẽ nhánh (Từ chối đơn):**
   - 3a. Người duyệt nhấn nút 'Từ chối' -> Hệ thống hiển thị hộp thoại bắt buộc nhập lý do từ chối.
   - 3b. Người duyệt nhập lý do và bấm Xác nhận -> Hệ thống cập nhật kết quả REJECTED, dừng toàn bộ quy trình duyệt và gửi thông báo từ chối kèm lý do cho người làm đơn.

# CHƯƠNG 3: MÔ HÌNH DỮ LIỆU QUAN NIỆM (CDM)

Mô hình Dữ liệu Quan niệm (CDM) phản ánh cấu trúc dữ liệu ở mức thuần túy nghiệp vụ. Tuân thủ chuẩn phương pháp luận thiết kế CSDL (Merise / PowerDesigner):

- Chỉ xác định các Thực thể, Thuộc tính và Mã định danh chính (Identifier - PK).

- TUYỆT ĐỐI KHÔNG CÓ KHÓA NGOẠI (Foreign Key) trong thực thể. Khóa ngoại chỉ được sinh ra khi chuyển dịch sang mô hình LDM / PDM.

- Mối quan hệ giữa các thực thể được diễn giải thông qua Mối kết hợp và Bản số (Cardinality: 0,1; 1,1; 0,n; 1,n).

## 3.1. Bảng phân tích Mối kết hợp & Bản số (Cardinality)

| Tên Mối Kết Hợp | Thực thể A | Bản số | Thực thể B | Diễn giải ý nghĩa nghiệp vụ |
|---|---|---|---|---|
| Thuộc Về | PHONG_BAN | (1,1) - (1,n) | NGUOI_DUNG | Mỗi người dùng bắt buộc thuộc 1 phòng ban; 1 phòng ban có nhiều người dùng. |
| Đảm Nhiệm | VAI_TRO | (1,1) - (0,n) | NGUOI_DUNG | Mỗi người dùng được gán 1 vai trò quyền hạn chính trong hệ thống. |
| Tạo Đơn | NGUOI_DUNG | (1,1) - (0,n) | DON_YEU_CAU | 1 đơn tạo bởi đúng 1 người; 1 người có thể tạo nhiều đơn. |
| Phân Loại | LOAI_YEU_CAU | (1,1) - (0,n) | DON_YEU_CAU | Mỗi đơn bắt buộc thuộc về 1 loại yêu cầu cụ thể. |
| Gồm Các Bước | LOAI_YEU_CAU | (1,1) - (1,n) | BUOC_DUYET | Mỗi loại yêu cầu được cấu hình quy trình gồm 1 hoặc nhiều bước duyệt. |
| Chứa Hạng Mục | DON_YEU_CAU | (1,1) - (0,n) | HANG_MUC_CHI_TIET | Đơn có thể gồm nhiều dòng hàng hóa, chi phí chi tiết cấu thành tổng tiền. |
| Có Đính Kèm | DON_YEU_CAU | (1,1) - (0,n) | TEP_DINH_KEM | Đơn có thể tải lên nhiều file đính kèm chứng từ, hóa đơn. |
| Sinh Ra Lượt Duyệt | DON_YEU_CAU | (1,1) - (1,n) | LUOT_PHE_DUYET | Mỗi đơn khi gửi duyệt sẽ sinh ra 1 hoặc nhiều lượt duyệt theo cấp. |
| Thực Hiện Duyệt | NGUOI_DUNG | (1,1) - (0,n) | LUOT_PHE_DUYET | Một lượt duyệt do 1 người phụ trách xử lý (đồng ý hoặc từ chối). |
| Ủy Quyền | NGUOI_DUNG | (1,1) - (0,n) | UY_QUYEN | Người duyệt có thể tạo các đợt ủy quyền duyệt cho người khác khi vắng mặt. |

## 3.2. Từ điển Dữ liệu Chi tiết (Data Dictionary - 10 Thực thể)

### 1. Thực thể PHONG_BAN (Phòng Ban)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaPB | Mã phòng ban | VARCHAR(20) | Có (PK) | Mã viết tắt (VD: PB_IT, PB_HR) |
| TenPB | Tên phòng ban | NVARCHAR(100) | Có | Tên đầy đủ của phòng ban |
| SoDienThoai | Số điện thoại nội bộ | VARCHAR(15) | Không | Số máy nhánh văn phòng |

### 2. Thực thể VAI_TRO (Vai Trò)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaVaiTro | Mã vai trò | VARCHAR(20) | Có (PK) | ADMIN, APPROVER, STAFF |
| TenVaiTro | Tên vai trò | NVARCHAR(50) | Có | Quản trị viên, Người duyệt, Nhân viên |
| MoTa | Mô tả quyền hạn | NVARCHAR(255) | Không | Phạm vi các chức năng được thao tác |

### 3. Thực thể NGUOI_DUNG (Người Dùng)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaNguoiDung | Mã người dùng | VARCHAR(20) | Có (PK) | Mã nhân viên (VD: NV001, NV002) |
| HoTen | Họ và tên | NVARCHAR(100) | Có | Họ tên đầy đủ |
| Email | Email nội bộ | VARCHAR(100) | Có | Địa chỉ email định danh, duy nhất |
| MatKhau | Mật khẩu | VARCHAR(255) | Có | Mật khẩu băm (BCrypt/Argon2) |
| TrangThai | Trạng thái | VARCHAR(20) | Có | ACTIVE (Hoạt động), LOCKED (Khóa) |

### 4. Thực thể LOAI_YEU_CAU (Loại Yêu Cầu)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaLoaiYeuCau | Mã loại yêu cầu | VARCHAR(30) | Có (PK) | LEAVE, EXPENSE, ASSET_BUY |
| TenLoaiYeuCau | Tên loại yêu cầu | NVARCHAR(100) | Có | Nghỉ phép năm, Thanh toán công tác... |
| MoTa | Mô tả quy định | NVARCHAR(500) | Không | Hướng dẫn điều kiện làm đơn |
| ThoiHanSLA | Thời hạn xử lý (SLA) | INT | Có | Thời gian xử lý chuẩn (giờ, vd: 24h, 48h) |

### 5. Thực thể BUOC_DUYET (Bước Duyệt Quy Trình)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaBuocDuyet | Mã bước duyệt | VARCHAR(30) | Có (PK) | Mã định danh bước kỹ thuật |
| ThuTuBuoc | Thứ tự bước | INT | Có | Thứ tự xử lý tuần tự (1, 2, 3...) |
| TenBuoc | Tên bước | NVARCHAR(100) | Có | VD: Quản lý trực tiếp duyệt, Kế toán kiểm tra |
| KieuNguoiDuyet | Kiểu người duyệt | VARCHAR(20) | Có | MANAGER (QL trực tiếp), ROLE (Vai trò) |

### 6. Thực thể DON_YEU_CAU (Đơn Yêu Cầu Đề Xuất)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaDon | Mã đơn yêu cầu | VARCHAR(30) | Có (PK) | Mã sinh tự động (REQ-2026-0001) |
| TieuDe | Tiêu đề yêu cầu | NVARCHAR(200) | Có | Tóm tắt nội dung đề xuất |
| LyDo | Lý do / Giải trình | NTEXT | Có | Nội dung giải trình chi tiết |
| TongTien | Tổng số tiền | DECIMAL(18,2) | Không | Tổng giá trị (đơn thanh toán/mua sắm) |
| TrangThai | Trạng thái đơn | VARCHAR(20) | Có | PENDING, APPROVED, REJECTED, CANCELLED |
| NgayTao | Ngày giờ gửi đơn | DATETIME | Có | Thời điểm gửi đơn lên hệ thống |

### 7. Thực thể HANG_MUC_CHI_TIET (Hạng Mục Chi Tiết)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaHangMuc | Mã hạng mục | VARCHAR(30) | Có (PK) | Mã dòng chi tiết |
| TenHangMuc | Tên hàng hóa / chi phí | NVARCHAR(200) | Có | VD: Bàn phím không dây, Vé máy bay |
| DonViTinh | Đơn vị tính | NVARCHAR(20) | Có | Cái, Bộ, Vé, Ngày, Tháng |
| SoLuong | Số lượng | DECIMAL(10,2) | Có | Số lượng (> 0) |
| DonGia | Đơn giá | DECIMAL(18,2) | Có | Đơn giá 1 đơn vị |
| ThanhTien | Thành tiền | DECIMAL(18,2) | Có | ThanhTien = SoLuong * DonGia |

### 8. Thực thể TEP_DINH_KEM (Tệp Đính Kèm)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaTep | Mã tệp | VARCHAR(30) | Có (PK) | Mã tệp hệ thống |
| TenTep | Tên file gốc | NVARCHAR(255) | Có | VD: hoa_don_vat.pdf, bao_gia.xlsx |
| DuongDan | Đường dẫn lưu trữ | VARCHAR(500) | Có | Đường dẫn URL lưu tệp trên server |
| NgayTaiLen | Ngày tải lên | DATETIME | Có | Thời điểm upload tệp |

### 9. Thực thể LUOT_PHE_DUYET (Lượt Phê Duyệt)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaLuotDuyet | Mã lượt duyệt | VARCHAR(30) | Có (PK) | Mã lượt duyệt |
| ThuTuDuyet | Lần duyệt thứ mấy | INT | Có | Cấp duyệt số mấy (1, 2, 3) |
| KetQua | Kết quả thao tác | VARCHAR(20) | Có | WAITING, APPROVED, REJECTED |
| YKienPhanHoi | Ý kiến / Lý do từ chối | NVARCHAR(500) | Không | Bắt buộc nếu KetQua = REJECTED |
| NgayQuyetDinh | Ngày giờ quyết định | DATETIME | Không | Thời điểm người duyệt ấn nút |

### 10. Thực thể UY_QUYEN (Ủy Quyền Phê Duyệt)

| Thuộc tính | Diễn giải | Kiểu dữ liệu | Bắt buộc | Ghi chú / Miền giá trị |
|---|---|---|---|---|
| MaUyQuyen | Mã đợt ủy quyền | VARCHAR(30) | Có (PK) | Mã ủy quyền |
| NgayBatDau | Ngày bắt đầu | DATETIME | Có | Thời điểm bắt đầu có hiệu lực |
| NgayKetThuc | Ngày kết thúc | DATETIME | Có | Thời điểm hết hạn ủy quyền |
| LyDo | Lý do ủy quyền | NVARCHAR(255) | Có | Đi công tác nước ngoài, nghỉ phép... |
| TrangThai | Trạng thái | VARCHAR(20) | Có | ACTIVE, EXPIRED, CANCELLED |
