#!/usr/bin/env bash
# s03 되돌리기 — 박지우 종합보고서를 "AI 초안 생성 전"으로.
#
# 시드는 이미 초안이 생성된 상태(status=under_review, 종합 소견·제언 source=ai)로 만든다.
# 그 화면에서는 `AI 초안 생성`을 눌러도 아무것도 안 바뀐다 — 모드가 `fill_empty`라
# **빈 섹션만** 채우기 때문이다(services.py:132-136). 그래서 두 섹션을 비우고 draft로 돌린다.
# source를 'clinician'으로 두면 안 된다 — 그 섹션은 AI가 절대 건드리지 않는다(:129-130).
set -euo pipefail
RID="${1:-8d34306a-c0d7-4cbb-9234-8b176e5255fe}"
docker exec mindbom-postgres psql -U mindbom -d mindbom -q -c "
update comprehensive_reports set
  status='draft', ai_draft=null, ai_model_version=null, ai_generated_at=null,
  confirmed_by=null, confirmed_at=null, report_generated_at=null,
  sections=(select jsonb_agg(case when s->>'key' in ('comprehensive_opinion','recommendations')
                                  then jsonb_set(s, '{body}', '\"\"') else s end order by ord)
            from comprehensive_reports r2, jsonb_array_elements(r2.sections) with ordinality t(s, ord)
            where r2.id='$RID')
where id='$RID';"
docker exec mindbom-postgres psql -U mindbom -d mindbom -t -c "
select status||' · 빈 섹션 '||(select count(*) from jsonb_array_elements(sections) s where coalesce(s->>'body','')='')
from comprehensive_reports where id='$RID';"
