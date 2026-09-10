#!/usr/bin/env bash
# _seed/<앱>-<날짜>.json 을 만든다 — 촬영 대상 제품의 시드 상태 박제.
# meta.json이 이 파일의 sha256을 남기므로, 재시드해서 id가 바뀌면 테이크가 서로 다른 촬영본이 된다.
#   ./_scripts/seed-snapshot.sh saas       → _seed/saas-2026-09-09.json
#   ./_scripts/seed-snapshot.sh mindbom    → _seed/mindbom-2026-09-09.json
set -euo pipefail
cd "$(dirname "$0")/.."
app="${1:-saas}"
out="_seed/${app}-${2:-$(date +%F)}.json"
mkdir -p _seed
[ -f "$out" ] && { echo "이미 있음 (덮어쓰기 금지): $out"; exit 1; }

case "$app" in
saas)
  container=saas-postgres; user=imomtae; db=imomtae; port=3501
  query="
select jsonb_pretty(jsonb_build_object(
  'app', 'saas-center-platform', 'seed', 'scripts.seed.develop',
  'center', (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from centers where deleted_at is null),
  'members', (select jsonb_agg(jsonb_build_object('id',m.id,'name',p.name) order by p.name) from members m join persons p on p.id=m.person_id where m.deleted_at is null),
  'clients', (select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'birth',birth_date) order by name) from clients where deleted_at is null),
  'rooms', (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from rooms where deleted_at is null),
  'programs', (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from programs where deleted_at is null),
  'counseling_cases', (select jsonb_agg(jsonb_build_object('id',id,'code',case_code) order by case_code) from counseling_cases where deleted_at is null),
  'assessment_cases', (select jsonb_agg(jsonb_build_object('id',id,'code',case_code) order by case_code) from assessment_cases where deleted_at is null),
  'field_notes', (select count(*) from field_notes where deleted_at is null)
));" ;;
mindbom)
  container=mindbom-postgres; user=mindbom; db=mindbom; port=4501
  # 검사 시각은 담지 않는다 — seed.py가 재실행마다 '지금' 기준으로 다시 맞추므로
  # 시각까지 넣으면 같은 데이터에도 sha256이 매번 달라진다. id와 상태만 박는다.
  query="
select jsonb_pretty(jsonb_build_object(
  'app', 'mindbom', 'seed', 'scripts.seed (cast.py 배역)',
  'institution', (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from institutions where deleted_at is null),
  'members', (select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role) order by name) from members where deleted_at is null),
  'clients', (select jsonb_agg(jsonb_build_object('id',id,'name',name,'birth',birth_date) order by name) from clients where deleted_at is null),
  'examinations', (select jsonb_agg(jsonb_build_object('id',id,'note',note,'type',exam_type,'status',status) order by note) from examinations where deleted_at is null)
));" ;;
*) echo "모르는 앱: $app (saas | mindbom)"; exit 1 ;;
esac

# docker exec 대신 psql 직결 — 이 기계에서는 docker exec 권한이 막혀 있다.
if [ "$app" = saas ]; then
  PGPASSWORD=$(python3 -c "import urllib.parse
for l in open('_tool/saas-center-platform/apps/api/.env'):
    if l.startswith('DATABASE_URL='):
        print(urllib.parse.unquote(urllib.parse.urlparse(l.split('=',1)[1].strip().replace('postgresql+asyncpg','postgresql')).password))")
else
  PGPASSWORD=mindbom_dev
fi
export PGPASSWORD
# 호스트에 psql이 깔려 있지 않을 수 있다 — 그때는 컨테이너 것을 쓴다(reset-seed.sh와 같은 방식).
if command -v psql >/dev/null 2>&1; then
  psql -h localhost -p "$port" -U "$user" -d "$db" -tA -c "$query" > "$out"
else
  docker exec -e PGPASSWORD "$container" psql -U "$user" -d "$db" -tA -c "$query" > "$out"
fi

[ -s "$out" ] || { rm -f "$out"; echo "빈 결과 — DB가 떠 있고 시드가 돌았는지 확인 (accounts.json의 apps.$app.seed)"; exit 1; }
echo "$out  sha256=$(shasum -a 256 "$out" | cut -c1-12)"
