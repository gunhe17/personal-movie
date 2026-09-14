-- C7.3 노쇼 → 차감 — 이하준 **13회기(9/13 · 촬영일 9/14의 어제)**를 예정 · 출결 미확인으로 둔다.
--
-- 옛 s09-setup.sql은 "5회기 9/9"였다 — C6.4 setup이 1~12회기를 6~9월로 깐 뒤로는 5회기(7월 완료)와 이름이 겹친다.
-- 회기 번호: 12회기(9/6 완료) → **13회기(9/13 노쇼)** → 14회기(9/18 → 9/22 변경 요청, c37-approve-setup.sql).
-- C6.4의 "끝난 회기 열둘"은 그대로다 — 13회기는 완료가 아니라 노쇼다.
--
-- 전제: c64-analysis-setup.sql(12회기). 멱등: 고정 UUID로 제 것만 지우고 다시 만든다(되돌리기도 이 파일 하나).
do $$
declare
  v_case_id text; v_center_id text; v_client_id text; v_member_id text; v_room_id text; v_start timestamp;
  v_sched text := 'ca73e0de-0000-4000-8000-000000000073';
  v_sess  text := 'ca73e0de-0000-4000-8000-000000000173';
begin
  select cc.id, cc.center_id into v_case_id, v_center_id
  from counseling_cases cc where cc.case_code = 'C00002' and cc.deleted_at is null;
  if v_case_id is null then raise exception 'C00002가 없다'; end if;

  select ccp.participant_id into v_client_id from counseling_case_participants ccp
  where ccp.counseling_case_id = v_case_id and ccp.participant_type = 'client' limit 1;
  -- 12회기와 같은 요일·시각, 한 주 뒤
  select s.member_id, s.room_id, date '2026-09-13' + s.start::time into v_member_id, v_room_id, v_start
  from counseling_sessions cs join schedules s on s.id = cs.schedule_id
  where cs.counseling_case_id = v_case_id and cs.deleted_at is null and s.title = 'C00002 - 12회기' limit 1;
  if v_start is null then raise exception '12회기가 없다 — c64-analysis-setup.sql 먼저'; end if;

  delete from counseling_session_participants where session_id = v_sess;
  delete from counseling_sessions where id = v_sess;
  delete from schedules where id = v_sched;

  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, start, "end", memo, created_at, updated_at)
  values (v_sched, v_center_id, v_member_id, v_room_id, 'counseling', 'C00002 - 13회기',
          v_start, v_start + interval '50 minutes', '', now(), now());

  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number, created_at, updated_at)
  values (v_sess, v_center_id, v_case_id, v_sched, 'scheduled', 13, now(), now());

  insert into counseling_session_participants
    (id, center_id, session_id, participant_id, participant_type, attendance_status, is_consumed, created_at, updated_at)
  values
    (gen_random_uuid()::text, v_center_id, v_sess, v_member_id, 'counselor', 'scheduled', false, now(), now()),
    (gen_random_uuid()::text, v_center_id, v_sess, v_client_id,  'client',    'scheduled', false, now(), now());
end $$;

-- 촬영 URL: /counseling/status/<case_id>?session=<session_id>
select cc.id as case_id, cs.id as session_id, s.title, s.start
from counseling_sessions cs join schedules s on s.id = cs.schedule_id
join counseling_cases cc on cc.id = cs.counseling_case_id
where cs.id = 'ca73e0de-0000-4000-8000-000000000173';
