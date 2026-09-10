#!/bin/bash
# ==============================================
# 개발 서버 배포 스크립트
# ==============================================
# 사용법:
#   ./deploy.sh main
#   ./deploy.sh agent
#   ./deploy.sh platform_admin
#   ./deploy.sh notification_system
#   ./deploy.sh db          # DB만 시작 (최초 1회)
#   ./deploy.sh status      # 전체 상태 확인
# ==============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.dev.yml"

# ==============================================
# 브랜치별 포트 매핑
# ==============================================
declare -A WEB_PORTS=(
  ["main"]="3000"
  ["agent"]="3100"
  ["platform_admin"]="3200"
  ["notification_system"]="3300"
)

declare -A API_PORTS=(
  ["main"]="3500"
  ["agent"]="3600"
  ["platform_admin"]="3700"
  ["notification_system"]="3800"
)

declare -A DB_NAMES=(
  ["main"]="saas_main"
  ["agent"]="saas_agent"
  ["platform_admin"]="saas_platform_admin"
  ["notification_system"]="saas_notification_system"
)

# admin 앱은 platform_admin 브랜치에서만 사용
declare -A ADMIN_PORTS=(
  ["platform_admin"]="3400"
)

DB_CONTAINER="saas-dev-db"
DB_HOST="saas-dev-db"
SHARED_NETWORK="saas-dev-network"
SHARED_VOLUME="saas-dev-pgdata"

# .env.dev 탐색 순서: 서버 고정 경로 → 로컬 (스크립트 옆)
if [ -f "/opt/saas-dev/.env.dev" ]; then
  ENV_FILE="/opt/saas-dev/.env.dev"
else
  ENV_FILE="${SCRIPT_DIR}/.env.dev"
fi

# ==============================================
# 헬퍼 함수
# ==============================================
load_env() {
  if [ -f "${ENV_FILE}" ]; then
    log_info ".env.dev 로드: ${ENV_FILE}"
    set -a
    source "${ENV_FILE}"
    set +a
  else
    log_error ".env.dev 파일이 없습니다: ${ENV_FILE}"
    log_error "  cp .env.dev.example .env.dev 후 값을 채워주세요."
    exit 1
  fi
}
log_info()  { echo "[INFO]  $(date '+%H:%M:%S') $*"; }
log_error() { echo "[ERROR] $(date '+%H:%M:%S') $*" >&2; }
log_ok()    { echo "[OK]    $(date '+%H:%M:%S') $*"; }

ensure_network() {
  if ! docker network inspect "${SHARED_NETWORK}" &>/dev/null; then
    log_info "공유 네트워크 생성: ${SHARED_NETWORK}"
    docker network create "${SHARED_NETWORK}"
  fi
}

ensure_volume() {
  if ! docker volume inspect "${SHARED_VOLUME}" &>/dev/null; then
    log_info "공유 볼륨 생성: ${SHARED_VOLUME}"
    docker volume create "${SHARED_VOLUME}"
  fi
}

ensure_db() {
  ensure_network
  ensure_volume

  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log_info "DB 컨테이너 이미 실행 중"
    return 0
  fi

  log_info "PostgreSQL 시작..."
  docker run -d \
    --name "${DB_CONTAINER}" \
    --network "${SHARED_NETWORK}" \
    --restart unless-stopped \
    -v "${SHARED_VOLUME}:/var/lib/postgresql/data" \
    -v "${SCRIPT_DIR}/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh" \
    -p "5432:5432" \
    -e POSTGRES_USER=mindscope \
    -e POSTGRES_PASSWORD=mindscope_dev \
    -e POSTGRES_DB=saas_main \
    --health-cmd="pg_isready -U mindscope" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-retries=5 \
    postgres:16-alpine

  log_info "DB 헬스체크 대기..."
  local retries=0
  while [ $retries -lt 30 ]; do
    if docker exec "${DB_CONTAINER}" pg_isready -U mindscope &>/dev/null; then
      log_ok "DB 준비 완료"
      return 0
    fi
    sleep 2
    retries=$((retries + 1))
  done

  log_error "DB 시작 실패 (타임아웃)"
  exit 1
}

ensure_branch_db() {
  local db_name=$1
  log_info "Database 확인: ${db_name}"

  docker exec "${DB_CONTAINER}" psql -U mindscope -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${db_name}'" \
    | grep -q 1 \
    || docker exec "${DB_CONTAINER}" psql -U mindscope -d postgres -c \
      "CREATE DATABASE ${db_name} OWNER mindscope"

  log_ok "Database 준비: ${db_name}"
}

show_status() {
  echo ""
  echo "========================================="
  echo "  개발 서버 상태"
  echo "========================================="
  echo ""

  # DB 상태
  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "  DB (PostgreSQL)    : 실행 중 (port 5432)"
  else
    echo "  DB (PostgreSQL)    : 중지됨"
  fi
  echo ""

  # 브랜치별 상태
  for branch in main agent platform_admin notification_system; do
    local project="saas-dev-${branch}"
    local web_port="${WEB_PORTS[$branch]}"
    local api_port="${API_PORTS[$branch]}"

    local api_status="중지됨"
    local web_status="중지됨"
    local admin_status=""

    if docker ps --format '{{.Names}}' | grep -q "${project}-api"; then
      api_status="실행 중 (port ${api_port})"
    fi
    if docker ps --format '{{.Names}}' | grep -q "${project}-web"; then
      web_status="실행 중 (port ${web_port})"
    fi

    # admin 앱이 있는 브랜치만 표시
    if [[ -n "${ADMIN_PORTS[$branch]+x}" ]]; then
      local admin_port="${ADMIN_PORTS[$branch]}"
      admin_status="중지됨"
      if docker ps --format '{{.Names}}' | grep -q "${project}-admin"; then
        admin_status="실행 중 (port ${admin_port})"
      fi
    fi

    printf "  %-18s : API %-28s  WEB %s\n" "${branch}" "${api_status}" "${web_status}"
    if [[ -n "${admin_status}" ]]; then
      printf "  %-18s   ADMIN %s\n" "" "${admin_status}"
    fi
  done

  echo ""
  echo "========================================="
}

# ==============================================
# 배포 함수
# ==============================================
deploy_branch() {
  local branch=$1

  if [[ -z "${WEB_PORTS[$branch]+x}" ]]; then
    log_error "알 수 없는 브랜치: ${branch}"
    echo "사용 가능: main, agent, platform_admin, notification_system"
    exit 1
  fi

  local web_port="${WEB_PORTS[$branch]}"
  local api_port="${API_PORTS[$branch]}"
  local db_name="${DB_NAMES[$branch]}"
  local project="saas-dev-${branch}"

  # admin 앱 포트 (해당 브랜치에만 존재)
  local admin_port="${ADMIN_PORTS[$branch]:-}"

  log_info "========================================="
  log_info "배포 시작: ${branch}"
  log_info "  WEB:   http://localhost:${web_port}"
  log_info "  API:   http://localhost:${api_port}"
  if [[ -n "${admin_port}" ]]; then
    log_info "  ADMIN: http://localhost:${admin_port}"
  fi
  log_info "  DB:    ${db_name}"
  log_info "========================================="

  # 0. 환경변수 로드
  load_env

  # 1. DB 보장
  ensure_db
  ensure_branch_db "${db_name}"

  # 2. 기존 컨테이너 정리 (DB 제외)
  log_info "기존 컨테이너 정리..."
  docker compose -f "${COMPOSE_FILE}" -p "${project}" down --remove-orphans 2>/dev/null || true

  # 3. 이미지 빌드 + 배포
  log_info "이미지 빌드 및 배포..."
  export BRANCH_TAG="${branch}"
  export WEB_PORT="${web_port}"
  export API_PORT="${api_port}"
  export ADMIN_PORT="${admin_port:-3000}"  # profiles로 제어하므로 기본값만 설정
  export DB_NAME="${db_name}"
  export DB_HOST="${DB_HOST}"
  export JWT_SECRET_KEY="${JWT_SECRET_KEY:-dev-secret-key-change-me}"

  # DB는 별도 컨테이너로 관리하므로 api, web, migrate만 실행
  docker compose -f "${COMPOSE_FILE}" -p "${project}" \
    --profile migration \
    run --rm --build migrate

  # admin 앱이 있는 브랜치: admin profile 포함
  if [[ -n "${admin_port}" ]]; then
    docker compose -f "${COMPOSE_FILE}" -p "${project}" \
      --profile admin \
      up -d --build api web admin
  else
    docker compose -f "${COMPOSE_FILE}" -p "${project}" \
      up -d --build api web
  fi

  log_ok "========================================="
  log_ok "배포 완료: ${branch}"
  log_ok "  WEB:   http://localhost:${web_port}"
  log_ok "  API:   http://localhost:${api_port}/docs"
  if [[ -n "${admin_port}" ]]; then
    log_ok "  ADMIN: http://localhost:${admin_port}"
  fi
  log_ok "========================================="
}

# ==============================================
# 메인
# ==============================================
if [ $# -eq 0 ]; then
  echo "사용법: $0 <branch|db|status>"
  echo ""
  echo "브랜치:  main, agent, platform_admin, notification_system"
  echo "유틸:    db (DB만 시작), status (상태 확인)"
  exit 1
fi

case "$1" in
  db)
    ensure_db
    log_ok "DB 준비 완료"
    ;;
  status)
    show_status
    ;;
  *)
    deploy_branch "$1"
    ;;
esac
