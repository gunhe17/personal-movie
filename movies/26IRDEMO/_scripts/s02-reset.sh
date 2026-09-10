#!/usr/bin/env bash
# s02 되돌리기 — 윤도현 로샤를 "실시 직전"으로.
#
# 시드 기본값은 s03 기준이다: `seed.py`가 status=confirmed로 만들고
# `seed_content.py`가 반응 22 · 영역 22 · 카드 10 · 촉구 2를 채운다(배터리·종합보고서의 재료).
# s02는 그 검사를 **반응 0 · created**에서 시작해야 하므로 매 리허설·촬영 전에 이걸 돌린다.
#
# ⚠️ **s03은 이것의 반대 상태를 쓴다.** s03 촬영 지점(로샤 confirmed · 반응 22)에서 이걸 돌리면 s03이 깨진다.
#    같은 DB를 다른 작업이 쓰고 있으면 먼저 확인하고 돌린다.
#
# 왜 재시드가 아니라 이 스크립트인가:
#   - 마인드봄 전체 재시드는 exam id를 바꿔 촬영 URL이 죽고, 같은 DB를 쓰는 다른 작업을 깬다
#   - 검사는 note(자연키)로 찾는다 — 재시드해도 id 하드코딩처럼 죽지 않는다
#   - docker exec는 이 기계에서 권한이 막혀 있다. psql로 직접 붙는다
#
# 지우는 것: 영역 · 반응 · 촉구 · 카드 실시기록 · 세션
# 되돌리는 것: examinations.status confirmed → created, started_at/completed_at NULL
#   (`/collect`는 status로 잠기지 않지만 **쓰기가 막힌다** —
#    rorschach/services.py `_ensure_editable`(80-95) · CreateResponse(217-220)가
#    `is_confirmed(status)`면 400. `state_machine.py:101` CONFIRMED_STATUSES.
#    세션까지 지우면 화면이 `startSession`으로 created → in_progress를 직접 밟는다
#    — 실제 실시와 같은 경로다. FreeAssociation.svelte:433)
set -euo pipefail

NOTE="${1:-seed:yun-rorschach}"
export PGPASSWORD=mindbom_dev
PSQL=(psql -h localhost -p 4501 -U mindbom -d mindbom -q)
# 이 기계에 psql이 없으면 컨테이너 안의 것을 쓴다(2026-09-10 밤부터 docker exec가 열렸다)
command -v psql >/dev/null 2>&1 || PSQL=(docker exec -e PGPASSWORD -i mindbom-postgres psql -U mindbom -d mindbom -q)

# 검사가 없으면 조용히 아무것도 안 하는 대신 멈춘다 — 재시드 직후 note가 바뀌면 여기서 걸린다
[ "$("${PSQL[@]}" -t -A -c "select count(*) from examinations where note='$NOTE'")" = "1" ] \
  || { echo "note='$NOTE' 인 검사가 정확히 1건이 아니다 — 시드를 확인하라" >&2; exit 1; }

"${PSQL[@]}" -c "
delete from rorschach_regions              where session_id in (select id from rorschach_sessions where examination_id in (select id from examinations where note='$NOTE'));
delete from rorschach_responses            where session_id in (select id from rorschach_sessions where examination_id in (select id from examinations where note='$NOTE'));
delete from rorschach_interventions        where session_id in (select id from rorschach_sessions where examination_id in (select id from examinations where note='$NOTE'));
delete from rorschach_card_administrations where session_id in (select id from rorschach_sessions where examination_id in (select id from examinations where note='$NOTE'));
delete from rorschach_sessions             where examination_id in (select id from examinations where note='$NOTE');
update examinations set status='created', started_at=null, completed_at=null where note='$NOTE';
"

"${PSQL[@]}" -t -c "
select '검사 '||e.id||' · status '||e.status
     ||' · 반응 '||(select count(*) from rorschach_responses r join rorschach_sessions s on s.id=r.session_id where s.examination_id=e.id)
     ||' · 영역 '||(select count(*) from rorschach_regions g join rorschach_sessions s on s.id=g.session_id where s.examination_id=e.id)
     ||' · 촉구 '||(select count(*) from rorschach_interventions i join rorschach_sessions s on s.id=i.session_id where s.examination_id=e.id)
     ||' · 카드 '||(select count(*) from rorschach_card_administrations c join rorschach_sessions s on s.id=c.session_id where s.examination_id=e.id)
     ||' · 세션 '||(select count(*) from rorschach_sessions s where s.examination_id=e.id)
from examinations e where e.note='$NOTE';"
