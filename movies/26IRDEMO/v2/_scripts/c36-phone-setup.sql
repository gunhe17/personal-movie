-- C3.6 앱에서 변경 요청 — 내담자 앱 일정 탭에 **다가오는 회기**가 하나 있어야 한다.
--
-- 시드의 C00002 회기는 전부 지난 것이고(C6.4 setup이 12회기를 6~9월로 깔았다) 앱 홈이
-- "다가오는 일정이 없어요"로 뜬다. 변경을 요청할 대상이 없으면 이 컷이 성립하지 않는다.
-- 그래서 다음 회기 하나(13회기)를 앞으로 둔다 — 계약 16회기 중 13번째다.
--
-- 멱등: 고정 UUID로 제 것만 지우고 다시 만든다(메모에 표식을 남기면 앱 화면에 그대로 뜬다).
do $$
declare
  v_case_id text; v_center_id text; v_client_id text; v_member_id text; v_room_id text;
  v_sched text := 'ca36e0de-0000-4000-8000-000000000036';
  v_sess  text := 'ca36e0de-0000-4000-8000-000000000136';
  v_start timestamp;
begin
  select cc.id, cc.center_id into v_case_id, v_center_id
  from counseling_cases cc where cc.case_code = 'C00002' and cc.deleted_at is null;
  if v_case_id is null then raise exception 'C00002가 없다'; end if;

  select ccp.participant_id into v_client_id from counseling_case_participants ccp
  where ccp.counseling_case_id = v_case_id and ccp.participant_type = 'client' limit 1;
  select s.member_id, s.room_id into v_member_id, v_room_id
  from counseling_sessions cs join schedules s on s.id = cs.schedule_id
  where cs.counseling_case_id = v_case_id and cs.deleted_at is null order by s.start desc limit 1;

  -- 2026-09-18 (금) 16:00 KST = 07:00 UTC. **날짜를 고정한다** — 조작 스크립트가
  -- 달력에서 `9월 18일`을 라벨로 짚기 때문에 상대 날짜로 두면 다른 날 돌릴 때 깨진다.
  v_start := timestamp '2026-09-18 07:00';

  delete from counseling_session_participants where session_id = v_sess;
  delete from counseling_sessions where id = v_sess;
  delete from schedules where id = v_sched;

  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, start, "end", memo)
  values (v_sched, v_center_id, v_member_id, v_room_id, 'counseling', 'C00002 - 13회기',
          v_start, v_start + interval '50 minutes', '');   -- 메모는 비운다 — 앱 일정 상세가 메모를 그대로 보여준다

  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number)
  values (v_sess, v_center_id, v_case_id, v_sched, 'scheduled', 13);

  insert into counseling_session_participants
    (id, center_id, session_id, participant_id, participant_type, attendance_status, is_consumed)
  values
    (gen_random_uuid()::text, v_center_id, v_sess, v_member_id, 'counselor', 'pending', false),
    (gen_random_uuid()::text, v_center_id, v_sess, v_client_id,  'client',    'pending', false);
end $$;

-- 앞선 판이 남긴 변경 요청은 지운다 — 남아 있으면 앱이 `요청 중`으로 열려 컷이 안 된다.
delete from schedule_change_requests
where schedule_id = 'ca36e0de-0000-4000-8000-000000000036';

select s.id, s.title, s.start, cs.status
from schedules s join counseling_sessions cs on cs.schedule_id = s.id
where s.id = 'ca36e0de-0000-4000-8000-000000000036';
