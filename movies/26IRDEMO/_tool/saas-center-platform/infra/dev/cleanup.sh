#!/bin/bash
# ==============================================
# 개발 서버 정리 스크립트
# ==============================================
# 사용법:
#   ./cleanup.sh main                # main 환경 정리
#   ./cleanup.sh agent               # agent 환경 정리
#   ./cleanup.sh platform_admin      # platform_admin 환경 정리
#   ./cleanup.sh notification_system # notification_system 환경 정리
#   ./cleanup.sh all                 # 전체 정리 (DB 포함)
# ==============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.dev.yml"

DB_CONTAINER="saas-dev-db"
SHARED_NETWORK="saas-dev-network"
SHARED_VOLUME="saas-dev-pgdata"

BRANCHES=("main" "agent" "platform_admin" "notification_system")

# admin 앱이 있는 브랜치 (profile 정리용)
ADMIN_BRANCHES=("platform_admin")

log_info()  { echo "[INFO]  $(date '+%H:%M:%S') $*"; }
log_ok()    { echo "[OK]    $(date '+%H:%M:%S') $*"; }
log_warn()  { echo "[WARN]  $(date '+%H:%M:%S') $*"; }

has_admin() {
  local branch=$1
  for ab in "${ADMIN_BRANCHES[@]}"; do
    [[ "$ab" == "$branch" ]] && return 0
  done
  return 1
}

cleanup_branch() {
  local branch=$1
  local project="saas-dev-${branch}"

  log_info "${branch} 환경 정리 중..."

  # admin profile 포함 브랜치는 profile 지정하여 정리
  if has_admin "${branch}"; then
    docker compose -f "${COMPOSE_FILE}" -p "${project}" --profile admin down --remove-orphans --rmi local 2>/dev/null || true
  else
    docker compose -f "${COMPOSE_FILE}" -p "${project}" down --remove-orphans --rmi local 2>/dev/null || true
  fi

  log_ok "${branch} 환경 정리 완료"
}

cleanup_all() {
  log_warn "========================================="
  log_warn "전체 개발 환경을 정리합니다"
  log_warn "DB 데이터도 삭제됩니다!"
  log_warn "========================================="

  read -r -p "계속하시겠습니까? (y/N): " confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
    echo "취소됨"
    exit 0
  fi

  # 1. 모든 브랜치 환경 정리
  for branch in "${BRANCHES[@]}"; do
    cleanup_branch "${branch}"
  done

  # 2. DB 컨테이너 정리
  if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log_info "DB 컨테이너 정리..."
    docker stop "${DB_CONTAINER}" 2>/dev/null || true
    docker rm "${DB_CONTAINER}" 2>/dev/null || true
  fi

  # 3. 공유 볼륨 삭제
  if docker volume inspect "${SHARED_VOLUME}" &>/dev/null; then
    log_info "DB 볼륨 삭제..."
    docker volume rm "${SHARED_VOLUME}" 2>/dev/null || true
  fi

  # 4. 공유 네트워크 삭제
  if docker network inspect "${SHARED_NETWORK}" &>/dev/null; then
    log_info "공유 네트워크 삭제..."
    docker network rm "${SHARED_NETWORK}" 2>/dev/null || true
  fi

  log_ok "전체 정리 완료"
}

# ==============================================
# 메인
# ==============================================
if [ $# -eq 0 ]; then
  echo "사용법: $0 <branch|all>"
  echo ""
  echo "브랜치:  main, agent, platform_admin, notification_system"
  echo "전체:    all (DB 포함 전체 삭제)"
  exit 1
fi

case "$1" in
  all)
    cleanup_all
    ;;
  main|agent|platform_admin|notification_system)
    cleanup_branch "$1"
    ;;
  *)
    echo "알 수 없는 옵션: $1"
    echo "사용 가능: main, agent, platform_admin, notification_system, all"
    exit 1
    ;;
esac
