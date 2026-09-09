-- s09 준비 — 이하준의 '지난 회기' 한 건(예정 상태)을 만든다. 그것을 촬영에서 노쇼로 처리한다.
-- 시드의 회기 셋은 전부 완료·참석이라 상태를 바꿀 수 없다(완료 회기는 청구·차감의 앵커라 잠긴다).
-- 시각은 UTC(naive). 2026-09-09 01:00 UTC = 10:00 KST — 어제 오전.
with ctx as (
  select (select id from centers where deleted_at is null limit 1) c,
         (select id from counseling_cases where case_code='C00002' and deleted_at is null) case_id,
         (select m.id from members m join persons p on p.id=m.person_id where p.name='정상담' and m.deleted_at is null) mid,
         (select id from rooms where deleted_at is null limit 1) rid,
         (select id from clients where name='이하준' and deleted_at is null) cid
), ns as (
  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, "start", "end", created_at, updated_at)
  select gen_random_uuid()::text, c, mid, rid, 'counseling', 'C00002 - 5회기',
         timestamp '2026-09-09 01:00:00', timestamp '2026-09-09 01:50:00', now(), now()
  from ctx where not exists (select 1 from schedules where title='C00002 - 5회기' and deleted_at is null)
  returning id, center_id
), sch as (
  select id, center_id from ns
  union all select id, center_id from schedules where title='C00002 - 5회기' and deleted_at is null limit 1
), nsess as (
  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number, created_at, updated_at)
  select gen_random_uuid()::text, s.center_id, c.case_id, s.id, 'scheduled', 5, now(), now()
  from sch s, ctx c
  where not exists (select 1 from counseling_sessions where schedule_id=s.id and deleted_at is null)
  returning id, center_id
), sess as (
  select id, center_id from nsess
  union all select cs.id, cs.center_id from counseling_sessions cs join sch s on s.id=cs.schedule_id where cs.deleted_at is null limit 1
)
insert into counseling_session_participants (id, center_id, session_id, participant_id, participant_type, attendance_status, is_consumed, created_at, updated_at)
select gen_random_uuid()::text, se.center_id, se.id, c.cid, 'client', 'scheduled', false, now(), now()
from sess se, ctx c
where not exists (select 1 from counseling_session_participants where session_id=se.id and participant_id=c.cid and deleted_at is null);
