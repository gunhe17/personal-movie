-- C3.7 겹침 확인 → 승인 — C3.6에서 보호자가 보낸 **바로 그 요청**을 웹이 받는다.
--
-- C3.6 촬영본(v2/s03-일정/raw/s03_phone_request_t02)의 요청: 9월 18일(금) 16:00 → 9월 22일(화) 17:00, 사유 칸 없음.
-- 옛 s05-setup.sql은 "4회기 9/17 10:00 → 9/18 16:00"이라 C6.4 setup의 12회기 축과 이름이 겹치고 C3.6과도 안 이어졌다.
-- 회기 번호: 12회기(9/6 완료) → 13회기(9/13 노쇼, C7.3 · c73-noshow-setup.sql) → **14회기(이 요청)**.
--   폰 촬영본은 회기 번호를 화면에 안 보여서 13 → 14로 옮겨도 이어진다.
--
-- 전제: c64-analysis-setup.sql(12회기). 캘린더 채움은 _scripts/s05-schedules.sql을 같이 넣는다(9/22 17:00 KST는 비어 있다).
-- 멱등: 고정 UUID로 제 것만 지우고 다시 만든다. 시각은 UTC(naive) = KST − 9h.

-- ① 보호자 앱 계정 — 요청의 person_id가 필요하다(s05-setup.sql 앞부분과 같다)
insert into accounts (id, provider, email, password, token_version, is_active, is_verified, created_at, updated_at)
select gen_random_uuid()::text, 'local', 'guardian.leesujin@mindscope.com',
       (select password from accounts where email='counselor1@mindscope.com'), 0, true, true, now(), now()
where not exists (select 1 from accounts where email='guardian.leesujin@mindscope.com');

insert into persons (id, account_id, name, phone, birth, gender, is_certified, created_at, updated_at)
select gen_random_uuid()::text, a.id, c.name, coalesce(c.phone,'01044440000'), c.birth_date, c.gender, true, now(), now()
from accounts a, clients c
where a.email='guardian.leesujin@mindscope.com' and c.name='이수진' and c.deleted_at is null
  and not exists (select 1 from persons where account_id=a.id);

update clients set person_id = (select p.id from persons p join accounts a on a.id=p.account_id where a.email='guardian.leesujin@mindscope.com')
where name='이수진' and deleted_at is null and person_id is null;

-- ② 14회기(9/18 16:00 KST)와 대기 중인 변경 요청
do $$
declare
  v_case_id text; v_center_id text; v_client_id text; v_member_id text; v_room_id text; v_person text;
  v_sched text := 'ca37e0de-0000-4000-8000-000000000037';
  v_sess  text := 'ca37e0de-0000-4000-8000-000000000137';
  v_req   text := 'ca37e0de-0000-4000-8000-000000000237';
begin
  select cc.id, cc.center_id into v_case_id, v_center_id
  from counseling_cases cc where cc.case_code = 'C00002' and cc.deleted_at is null;
  if v_case_id is null then raise exception 'C00002가 없다'; end if;

  select ccp.participant_id into v_client_id from counseling_case_participants ccp
  where ccp.counseling_case_id = v_case_id and ccp.participant_type = 'client' limit 1;
  select s.member_id, s.room_id into v_member_id, v_room_id
  from counseling_sessions cs join schedules s on s.id = cs.schedule_id
  where cs.counseling_case_id = v_case_id and cs.deleted_at is null and s.title = 'C00002 - 12회기' limit 1;
  select p.id into v_person from persons p join accounts a on a.id = p.account_id
  where a.email = 'guardian.leesujin@mindscope.com';

  delete from schedule_change_requests where id = v_req or schedule_id = v_sched;
  delete from counseling_session_participants where session_id = v_sess;
  delete from counseling_sessions where id = v_sess;
  delete from schedules where id = v_sched;

  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, start, "end", memo, created_at, updated_at)
  values (v_sched, v_center_id, v_member_id, v_room_id, 'counseling', 'C00002 - 14회기',
          timestamp '2026-09-18 07:00', timestamp '2026-09-18 07:50', '', now(), now());

  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number, created_at, updated_at)
  values (v_sess, v_center_id, v_case_id, v_sched, 'scheduled', 14, now(), now());

  insert into counseling_session_participants
    (id, center_id, session_id, participant_id, participant_type, attendance_status, is_consumed, created_at, updated_at)
  values
    (gen_random_uuid()::text, v_center_id, v_sess, v_member_id, 'counselor', 'pending', false, now(), now()),
    (gen_random_uuid()::text, v_center_id, v_sess, v_client_id,  'client',    'pending', false, now(), now());

  -- 사유는 비운다 — 앱에는 사유 입력이 없다(C3.6 실측). 확인 시트가 그 자리다.
  insert into schedule_change_requests
    (id, center_id, schedule_id, person_id, client_id, status,
     current_start, current_end, requested_start, requested_end, reason, created_at, updated_at)
  values (v_req, v_center_id, v_sched, v_person, v_client_id, 'pending',
          timestamp '2026-09-18 07:00', timestamp '2026-09-18 07:50',
          timestamp '2026-09-22 08:00', timestamp '2026-09-22 08:50',
          null, now(), now());
end $$;

select s.title, s.start, r.status, r.requested_start
from schedule_change_requests r join schedules s on s.id = r.schedule_id
where r.id = 'ca37e0de-0000-4000-8000-000000000237';
