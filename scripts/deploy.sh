#!/usr/bin/env bash
# Triển khai một phiên bản mới vào thư mục release riêng rồi mới chuyển symlink `current`,
# nên bản đang chạy không bị ghi đè giữa chừng và quay lại bản trước chỉ cần đổi symlink.
#
#   scripts/deploy.sh [ref]          # mặc định origin/main
#   scripts/deploy.sh --rollback     # quay về release liền trước
#
# Cấu trúc trên máy chủ (APP_ROOT mặc định /opt/omniflow):
#   repo/            bản clone git, chỉ dùng để fetch
#   shared/.env      cấu hình dùng chung mọi release
#   shared/uploads/  tệp đính kèm khi lưu trên đĩa
#   releases/<thời điểm>/
#   current -> releases/<thời điểm>
set -euo pipefail
umask 027

APP_ROOT="${APP_ROOT:-/opt/omniflow}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SERVICE="${SERVICE:-omniflow}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

restart() {
  if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
    echo "Chưa cài $SERVICE.service, bỏ qua bước khởi động lại (lần triển khai đầu tiên)."
    return 0
  fi
  sudo systemctl restart "$SERVICE"
  for _ in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      echo "Ứng dụng đã sẵn sàng: $(readlink -f "$APP_ROOT/current")"
      return 0
    fi
    sleep 2
  done
  echo "Ứng dụng không trả lời $HEALTH_URL sau 60 giây. Xem: journalctl -u $SERVICE -n 100" >&2
  return 1
}

if [[ "${1:-}" == "--rollback" ]]; then
  current="$(readlink -f "$APP_ROOT/current")"
  previous="$(ls -1d "$APP_ROOT"/releases/*/ | sed 's#/$##' | sort | grep -B1 -Fx "$current" | head -n1)"
  if [[ -z "$previous" || "$previous" == "$current" ]]; then
    echo "Không có release nào trước $current" >&2
    exit 1
  fi
  echo "Quay về $previous (migration đã chạy KHÔNG được hoàn tác; chỉ dùng khi bản mới không đổi schema hoặc đổi tương thích ngược)"
  ln -sfn "$previous" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
  restart
  exit 0
fi

REF="${1:-origin/main}"
stamp="$(date +%Y%m%d-%H%M%S)"
release="$APP_ROOT/releases/$stamp"

git -C "$APP_ROOT/repo" fetch --prune origin
commit="$(git -C "$APP_ROOT/repo" rev-parse --verify "$REF^{commit}")"
echo "Triển khai $REF ($commit) vào $release"

mkdir -p "$release" "$APP_ROOT/shared/uploads"
git -C "$APP_ROOT/repo" archive "$commit" | tar -x -C "$release"
echo "$commit" >"$release/REVISION"
ln -s "$APP_ROOT/shared/.env" "$release/.env"
ln -s "$APP_ROOT/shared/uploads" "$release/uploads"

cleanup_failed() {
  echo "Triển khai thất bại, giữ nguyên bản đang chạy. Xóa $release" >&2
  rm -rf "$release"
}
trap cleanup_failed ERR

cd "$release"
npm ci --no-audit --no-fund
npm run build
"$release/scripts/backup.sh"
npm run db:migrate
trap - ERR

ln -sfn "$release" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
restart

ls -1d "$APP_ROOT"/releases/*/ | sed 's#/$##' | sort | head -n "-$KEEP_RELEASES" | while read -r old; do
  [[ "$old" == "$(readlink -f "$APP_ROOT/current")" ]] || rm -rf "$old"
done
