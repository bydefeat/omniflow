# OmniFlow Enterprise
> **Internal Request & Approval Workflow Management System**  
> *Hệ thống Quản lý Yêu cầu và Luồng Phê duyệt Nội bộ Tự động hóa Đa cấp*

---

## Giới thiệu dự án (Overview)
**OmniFlow Enterprise** là giải pháp điều phối yêu cầu và quản lý phê duyệt đa cấp nội bộ doanh nghiệp. Hệ thống số hóa toàn bộ quy trình giấy tờ hành chính, quản lý ngân sách mua sắm, đề xuất nhân sự, nghỉ phép và cấp phát tài nguyên CNTT.

### Phân hệ chức năng chính (Core Modules):
1. **Requester / Employee Portal (Cổng tạo yêu cầu)**:
   - Danh mục biểu mẫu chuẩn hóa (Nghỉ phép, Mua sắm trang thiết bị, Đề xuất thanh toán, Tạm ứng công tác).
   - Theo dõi trạng thái yêu cầu theo thời gian thực (Draft, Pending, Approved, Rejected, Need More Info).
   - Đính kèm hồ sơ, chứng từ, hóa đơn điện tử và ghi chú chi tiết.
2. **Approval Action Center (Trung tâm xét duyệt & thẩm định)**:
   - Cơ chế duyệt tuần tự hoặc song song (Sequential / Parallel Approval Workflow).
   - Phê duyệt nhanh, từ chối kèm lý do bắt buộc, yêu cầu bổ sung thông tin hoặc ủy quyền phê duyệt.
   - Định tuyến theo hạn mức ngân sách và ma trận phân quyền phòng ban.
3. **Audit Trail & System Administration (Quản trị & Kiểm toán nội bộ)**:
   - Nhật ký kiểm toán toàn vẹn (Activity Timeline & Audit Log) lưu vết từng thao tác.
   - Thống kê thời gian xử lý trung bình (SLA Turnaround Time) và tỷ lệ phê duyệt.

---

## Công nghệ sử dụng (Tech Stack)
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS

---

## Hướng dẫn cài đặt (Getting Started)

1. Cài đặt các gói phụ thuộc:
```bash
npm install
```

2. Chạy môi trường phát triển:
```bash
npm run dev
```

3. Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

