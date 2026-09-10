-- s04 되돌리기 (응시) — 바로링크로 제출한 검사를 **응시 전**으로 되돌린다.
--
-- 받는 쪽 테이크는 "문항을 답하고 제출한다"로 끝나므로, 매 판은 그 검사가 `pending`인 자리에서
-- 출발해야 한다. 한 번 제출하면 status가 `completed`가 되고 보고서 PDF와 document 행까지 생겨
-- 두 번째 판은 응시 화면 대신 완료 화면을 만난다.
--
--   docker exec -i saas-postgres psql -U imomtae -d imomtae -f- < _scripts/s04-task-reset.sql
--
-- 지우는 것: 그 task의 process(응답·채점) · report_payload · 보고서 document
-- 되돌리는 것: status → pending · completed_at NULL · report_document_id NULL · 보호자 공개 off
-- 건드리지 않는 것: 케이스(AC0002~4) · 바로링크 · 상담 기록. 그건 각각 s01 · s04-reset.sql · s04-setup.sql이다.
--
-- 대상은 **바로링크에 실린 검사**다 — 링크가 없으면 아무것도 하지 않는다.

\set ON_ERROR_STOP on

do $$
declare
  v_doc_ids varchar(36)[];
  v_n int;
begin
  select array_agg(t.report_document_id) into v_doc_ids
  from assessment_tasks t
  where t.report_document_id is not null
    and t.assessment_id in (select unnest(assessment_ids) from assessment_send_links)
    and t.case_id in (select case_id from assessment_send_links);

  update assessment_tasks t set
    status = 'pending',
    completed_at = null,
    report_document_id = null,
    report_payload = null,
    is_report_visible_to_guardian = false,
    process = '{}'::jsonb,
    updated_at = now()
  where t.assessment_id in (select unnest(assessment_ids) from assessment_send_links)
    and t.case_id in (select case_id from assessment_send_links);
  get diagnostics v_n = row_count;

  -- 보고서 문서는 task를 떼어낸 뒤에 지운다(참조 순서)
  if v_doc_ids is not null then
    delete from documents where id = any(v_doc_ids);
  end if;

  raise notice '검사 %건을 응시 전으로 · 보고서 문서 %건 삭제', v_n, coalesce(array_length(v_doc_ids, 1), 0);
end $$;

select t.status||' · 보고서 '||coalesce(t.report_document_id,'없음')||' · 공개 '||t.is_report_visible_to_guardian::text as 상태
from assessment_tasks t
where t.assessment_id in (select unnest(assessment_ids) from assessment_send_links)
  and t.case_id in (select case_id from assessment_send_links);
