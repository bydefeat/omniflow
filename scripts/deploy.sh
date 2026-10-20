#!/usr/bin/env bash
set -euo pipefail
umask 027

APP_ROOT="$(readlink -f "${APP_ROOT:-/opt/omniflow}")"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SERVICE="${SERVICE:-omniflow}"
CHECK_URL="${CHECK_URL:-http://127.0.0.1:3000/authentication/sign-in}"

restart() {
  if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
    echo "Chưa cài $SERVICE.service, bỏ qua bước khởi động lại (lần triển khai đầu tiên)."
    return 0
  fi
  sudo systemctl restart "$SERVICE"
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "$CHECK_URL" 2>/dev/null; then
      echo "Ứng dụng đã sẵn sàng: $(readlink -f "$APP_ROOT/current")"
      return 0
    fi
    sleep 2
  done
  echo "Ứng dụng không trả lời $CHECK_URL sau 60 giây. Xem: journalctl -u $SERVICE -n 100" >&2
  return 1
}

completed_releases() {
  for dir in "$APP_ROOT"/releases/*/; do
    [[ -f "$dir.deployed" ]] && readlink -f "$dir"
  done | sort
}

if [[ "${1:-}" == "--rollback" ]]; then
  current="$(readlink -f "$APP_ROOT/current")"
  previous="$(completed_releases | grep -B1 -Fx "$current" | head -n1 || true)"
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

cleanup_failed() {
  echo "Triển khai thất bại, giữ nguyên bản đang chạy. Xóa $release" >&2
  rm -rf "$release"
}
trap cleanup_failed ERR

mkdir -p "$release" "$APP_ROOT/shared/uploads"
git -C "$APP_ROOT/repo" archive "$commit" | tar -x -C "$release"
echo "$commit" >"$release/REVISION"
ln -s "$APP_ROOT/shared/.env" "$release/.env"
ln -s "$APP_ROOT/shared/uploads" "$release/uploads"

cd "$release"
npm ci --no-audit --no-fund
npm run build
"$release/scripts/backup.sh"
npm run db:migrate
touch "$release/.deployed"
trap - ERR

ln -sfn "$release" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
restart

for dir in "$APP_ROOT"/releases/*/; do readlink -f "$dir"; done | sort | head -n "-$KEEP_RELEASES" | while read -r old; do
  [[ "$old" == "$(readlink -f "$APP_ROOT/current")" ]] || rm -rf "$old"
done
