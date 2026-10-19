# Triển khai OmniFlow (không dùng Docker)

Hướng dẫn cho một máy chủ Ubuntu 24.04 chạy cả ứng dụng và PostgreSQL. Ứng dụng chạy bằng `systemd`, nginx đứng trước làm HTTPS. Các file mẫu nằm trong `deploy/`.

Hệ thống **không có đăng ký tài khoản**: mọi tài khoản do quản trị viên tạo ở `/administrator/users`. Tài khoản quản trị đầu tiên tạo bằng `db:seed`.

## 1. Cài phần mềm

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16 (gói này đã có extension btree_gist mà migration cần)
sudo apt-get install -y postgresql-16 nginx certbot python3-certbot-nginx
```

## 2. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER omniflow WITH PASSWORD 'đổi-mật-khẩu-này';
CREATE DATABASE omniflow OWNER omniflow;
\c omniflow
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
```

`btree_gist` cần quyền superuser nên tạo trước ở đây; migration dùng `CREATE EXTENSION IF NOT EXISTS` nên chạy lại không lỗi.

## 3. Mã nguồn và cấu hình

```bash
sudo useradd --system --create-home --home-dir /opt/omniflow omniflow
sudo -u omniflow git clone https://github.com/bydefeat/omniflow.git /opt/omniflow
cd /opt/omniflow
sudo -u omniflow cp .env.example .env
sudo -u omniflow chmod 600 .env
```

Điền `.env`:

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL` | Có | `postgres://omniflow:<mật khẩu>@localhost:5432/omniflow` |
| `DEFEAT_BETTER_AUTH_SESSION_SIGNING_SECRET_KEY` | Có | Chuỗi ngẫu nhiên ≥ 32 ký tự: `openssl rand -hex 32` |
| `DEFEAT_BETTER_AUTH_PUBLIC_APPLICATION_BASE_URL` | Có | URL công khai, ví dụ `https://omniflow.example.com` |
| `DEFEAT_SEED_ADMIN_EMAIL`, `DEFEAT_SEED_ADMIN_PASSWORD` | Lần đầu | Tài khoản quản trị đầu tiên; xóa mật khẩu khỏi `.env` sau khi seed |
| `DEFEAT_SMTP_CONNECTION_URL` | Nên có | `smtps://user:pass@smtp.example.com:465`. Không có thì không gửi email (quên mật khẩu sẽ hướng dẫn liên hệ quản trị viên) |
| `DEFEAT_MAIL_SENDER_ADDRESS` | Không | `OmniFlow <no-reply@example.com>` |
| `DEFEAT_S3_BUCKET_NAME` | Không | Có giá trị thì lưu tệp đính kèm lên S3/R2 thay vì `uploads/` |
| `DEFEAT_S3_ENDPOINT_URL` | Với R2/MinIO | R2: `https://<account-id>.r2.cloudflarestorage.com` |
| `DEFEAT_S3_REGION` | Với AWS | Ví dụ `ap-southeast-1`; R2 để trống (dùng `auto`) |
| `DEFEAT_S3_ACCESS_KEY_ID`, `DEFEAT_S3_SECRET_ACCESS_KEY` | Với S3/R2 | Khóa truy cập chỉ có quyền trên bucket này |
| `DEFEAT_CLIENT_IP_HEADERS` | Sau proxy | `x-real-ip` khi dùng file nginx mẫu |
| `DEFEAT_TRUSTED_PROXIES` | Không | IP của proxy nếu muốn đọc chuỗi `x-forwarded-for` |

Bucket S3/R2 phải **riêng tư**: tệp chỉ tải được qua `/api/files/<id>` sau khi kiểm quyền.

## 4. Build, migrate, seed

```bash
cd /opt/omniflow
sudo -u omniflow npm ci
sudo -u omniflow npm run db:migrate
sudo -u omniflow npm run db:seed      # chỉ lần đầu: phòng ban Ban Giám đốc + tài khoản quản trị
sudo -u omniflow npm run build
```

Không chạy `db:seed -- --demo` trên máy thật (tạo tài khoản demo với mật khẩu chung).

## 5. Chạy bằng systemd

```bash
sudo cp deploy/omniflow.service deploy/omniflow-mail.service deploy/omniflow-mail.timer \
        deploy/omniflow-backup.service deploy/omniflow-backup.timer /etc/systemd/system/
sudo mkdir -p /var/backups/omniflow && sudo chown omniflow /var/backups/omniflow
sudo systemctl daemon-reload
sudo systemctl enable --now omniflow omniflow-mail.timer omniflow-backup.timer
```

- `omniflow.service`: ứng dụng ở `127.0.0.1:3000`. Nếu `which npm` không phải `/usr/bin/npm` thì sửa `ExecStart` trong các file `.service`.
- `omniflow-mail.timer`: mỗi 5 phút gửi email còn tồn (email lỗi được thử lại tối đa 8 lần, giãn dần).
- `omniflow-backup.timer`: 02:30 hằng ngày chạy `scripts/backup.sh`, giữ 14 ngày.

Xem log: `journalctl -u omniflow -f`.

## 6. nginx và HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/omniflow   # sửa tên miền trong file
sudo ln -s /etc/nginx/sites-available/omniflow /etc/nginx/sites-enabled/
sudo certbot --nginx -d omniflow.example.com
sudo nginx -t && sudo systemctl reload nginx
```

`client_max_body_size 11m` khớp giới hạn tệp 10 MB của ứng dụng. nginx đặt `X-Real-IP`, nên đặt `DEFEAT_CLIENT_IP_HEADERS=x-real-ip` để giới hạn đăng nhập tính theo từng người dùng.

### Chính sách đăng nhập (đã cài sẵn, không cần cấu hình)

- Mật khẩu mới (admin tạo, đổi, đặt lại) tối thiểu 10 ký tự, có cả chữ và số. Mật khẩu cũ ngắn hơn vẫn đăng nhập được.
- Sai mật khẩu 5 lần trong 15 phút thì email đó bị khóa đăng nhập 15 phút. Admin mở sớm bằng cách đặt mật khẩu mới hoặc mở khóa tài khoản.
- Phiên đăng nhập hết hạn sau 3 ngày không dùng (tự gia hạn mỗi 12 giờ khi đang dùng). Đổi vai trò, khóa tài khoản hoặc đặt mật khẩu mới đều đăng xuất mọi phiên của người đó.

## 7. Cập nhật phiên bản

```bash
cd /opt/omniflow
sudo -u omniflow scripts/backup.sh
sudo -u omniflow git pull
sudo -u omniflow npm ci
sudo -u omniflow npm run db:migrate
sudo -u omniflow npm run build
sudo systemctl restart omniflow
```

## 8. Sao lưu và khôi phục

`scripts/backup.sh` tạo `omniflow-<thời điểm>.dump` (định dạng custom của `pg_dump`) và `uploads-<thời điểm>.tar.gz` nếu tệp lưu trên đĩa. Tệp trên S3/R2 không nằm trong bản sao lưu này; bật versioning hoặc sao chép bucket ở phía nhà cung cấp.

Nên chép thư mục `/var/backups/omniflow` sang máy khác (ví dụ `rclone` hoặc `rsync` theo lịch).

Khôi phục:

```bash
sudo systemctl stop omniflow
sudo -u postgres dropdb omniflow && sudo -u postgres createdb -O omniflow omniflow
sudo -u postgres psql -d omniflow -c 'CREATE EXTENSION IF NOT EXISTS btree_gist'
pg_restore --no-owner -d "postgres://omniflow:<mật khẩu>@localhost:5432/omniflow" /var/backups/omniflow/omniflow-<thời điểm>.dump
sudo -u omniflow tar -xzf /var/backups/omniflow/uploads-<thời điểm>.tar.gz -C /opt/omniflow   # nếu có
sudo systemctl start omniflow
```

## 9. Bảo vệ nhánh `main` trên GitHub

Settings → Branches → Add branch ruleset (hoặc Branch protection rule) cho `main`:

- Require a pull request before merging.
- Require status checks to pass: chọn `checks` và `e2e` (hai job của `.github/workflows/ci.yml`).
- Require branches to be up to date before merging.
- Block force pushes.
