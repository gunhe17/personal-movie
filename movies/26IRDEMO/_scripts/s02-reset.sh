#!/usr/bin/env bash
# s02 되돌리기 — 윤도현 로샤를 "반응 0 · 촉구 없음"으로.
# 마인드봄 전체 재시드 없이 이 검사만 되돌린다(재시드하면 exam id가 바뀌어 URL이 죽는다).
set -euo pipefail
EX="${1:-519ea1b3-8975-40c9-b666-f4195be64ee1}"
docker exec mindbom-postgres psql -U mindbom -d mindbom -q -c "
with s as (select id from rorschach_sessions where examination_id='$EX')
delete from rorschach_regions where response_id in (select r.id from rorschach_responses r where r.session_id in (select id from s));
delete from rorschach_interventions where session_id in (select id from rorschach_sessions where examination_id='$EX');
delete from rorschach_responses where session_id in (select id from rorschach_sessions where examination_id='$EX');
"
docker exec mindbom-postgres psql -U mindbom -d mindbom -t -c "
select '반응 '||(select count(*) from rorschach_responses r join rorschach_sessions s on s.id=r.session_id where s.examination_id='$EX')
     ||' · 촉구 '||(select count(*) from rorschach_interventions i join rorschach_sessions s on s.id=i.session_id where s.examination_id='$EX');"
