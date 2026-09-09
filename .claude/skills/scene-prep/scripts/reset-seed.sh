#!/usr/bin/env bash
# reset-seed.sh — 촬영/리허설 시작 상태로 되돌린다. 사이클마다 여기서 출발한다.
#
#   .claude/skills/scene-prep/scripts/reset-seed.sh --yes [--snapshot]
#
# 하는 일: DB를 시드 상태로 다시 만들고 → 로그인 상태 파일을 다시 만들고 → (선택) 시드 스냅샷을 박제.
# 재시드하면 계정 id가 바뀌어 기존 토큰이 죽으므로 _state/local-saas-*.json 재생성이 함께 가야 한다.
set -euo pipefail
cd "$(dirname "$0")/../../../../movies/26IRDEMO"

[ "${1:-}" = "--yes" ] || { cat <<'MSG'
DB를 통째로 다시 만든다 — 리허설·촬영으로 쌓인 데이터가 전부 사라진다.
확인했으면 --yes 를 붙여라.

  reset-seed.sh --yes [--snapshot]
    --snapshot   되돌린 뒤 _seed/saas-<날짜>.json 을 새로 박제 (촬영 세션 직전에만)
MSG
exit 1; }
shift
SNAP=0; [ "${1:-}" = "--snapshot" ] && SNAP=1

API_DIR=_tool/saas-center-platform/apps/api
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib     # WeasyPrint가 glib을 못 찾는다

docker ps --format '{{.Names}}' | grep -q saas-postgres || { echo "saas-postgres 가 없다 — pnpm db:up 먼저"; exit 1; }

echo "▶ 스키마 재생성 (마이그레이션 체인은 빈 DB에서 안 돈다 — init_db 가 정본)"
( cd "$API_DIR" && uv run python -m scripts.init_db >/dev/null && uv run alembic stamp head >/dev/null )

echo "▶ develop 시드"
( cd "$API_DIR" && uv run python -m scripts.seed.develop > /tmp/seed.log 2>&1 ) || { echo "시드 실패 — /tmp/seed.log"; exit 1; }

echo "▶ 로그인 상태 재생성 (계정 id가 바뀌어 기존 토큰이 죽었다)"
BASE=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['apps']['saas']['base'])" 2>/dev/null || echo http://localhost:3503)
PW=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['password'])")
for k in ${CAP_ACCOUNTS:-counselor1}; do
  EMAIL=$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['accounts']['$k']['email'])")
  CAP_EMAIL="$EMAIL" CAP_PASSWORD="$PW" \
    node ../../.claude/skills/capture-service/scripts/login.mjs --base "$BASE" --out "_state/local-saas-$k.json" >/dev/null 2>&1 \
    && echo "   _state/local-saas-$k.json" || echo "   ⚠ $k 로그인 실패 — 웹(3503)이 떠 있는지 확인"
done

if [ "$SNAP" = "1" ]; then
  echo "▶ 시드 스냅샷"
  ./_scripts/seed-snapshot.sh saas || true
fi

docker exec saas-postgres psql -U imomtae -d imomtae -tA -c "
select '✔ 센터 '||(select name from centers where deleted_at is null limit 1)
     ||' · 내담자 '||(select count(*) from clients where deleted_at is null)
     ||' · 기관 '||(select count(*) from institutions where deleted_at is null)
     ||' · 상담케이스 '||(select count(*) from counseling_cases where deleted_at is null)
     ||' · 검사케이스 '||(select count(*) from assessment_cases where deleted_at is null)
     ||' · 필드노트 '||(select count(*) from field_notes where deleted_at is null);"
