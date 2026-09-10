#!/usr/bin/env bash
# API E2E 실행기 — 반드시 이 스크립트로 실행한다.
#
# 개발 DB(imomtae)를 절대 건드리지 않도록 DATABASE_URL을 *_test DB로 강제한다.
# (get_uow가 전역 세션팩토리를 쓰므로 env 바인딩이 유일한 격리 수단.
#  tests/e2e/conftest.py에도 DB명 가드가 있어 이중 방어된다.)
#
# 사용:
#   bash scripts/run_e2e.sh                  # 전체 실행
#   bash scripts/run_e2e.sh -k clients -x    # pytest 인자 전달
#   E2E_DATABASE_URL=... bash scripts/run_e2e.sh   # test DB 직접 지정
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${E2E_DATABASE_URL:-}" ]; then
  MAIN_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)}"
  if [ -z "$MAIN_URL" ]; then
    echo "DATABASE_URL을 찾을 수 없습니다 (.env 또는 환경변수)" >&2
    exit 1
  fi
  E2E_DATABASE_URL="${MAIN_URL%/*}/imomtae_test"
fi

case "$E2E_DATABASE_URL" in
  *_test) ;;
  *)
    echo "E2E_DATABASE_URL은 반드시 _test로 끝나야 합니다: $E2E_DATABASE_URL" >&2
    exit 1
    ;;
esac

export DATABASE_URL="$E2E_DATABASE_URL"
export APP_ENV=development
export AI_WORKER_MODE=embedded
# 응답자(최종 응답 위임) 비활성 — e2e는 최종 문구를 단정하고 외부 LLM 호출 금지
export ASSISTANT_RESPONDER_MODEL=""
# 웹훅 서명 검증은 시크릿 미설정 시 명시 실패(503, P1 보안 결정) — e2e는 더미로 401 경로 검증
export TOSS_WEBHOOK_SECRET="${TOSS_WEBHOOK_SECRET:-e2e-dummy-webhook-secret}"

exec uv run pytest tests/e2e "$@"
