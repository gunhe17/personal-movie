-- s05 준비 — 이하준의 다음 회기(미래)와 보호자의 변경 요청 한 건을 만든다.
-- 내담자 앱은 촬영 대상이 아니므로 요청은 데이터로 넣는다. 승인 이후는 전부 제품이 진짜로 처리한다.
-- 보호자(이수진)에게 앱 계정(account+person)이 없어서 요청의 person_id를 채울 수 없다 —
-- 시드는 보호자 앱 연결을 만들지 않는다(center_links 0). 여기서 그 계정을 만든다.
-- 멱등: 같은 title/schedule/이메일의 것이 있으면 다시 만들지 않는다.

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

with ctx as (
  select (select id from centers where deleted_at is null limit 1) as center_id,
         (select id from counseling_cases where case_code='C00002' and deleted_at is null) as case_id,
         (select m.id from members m join persons p on p.id=m.person_id where p.name='정상담' and m.deleted_at is null) as member_id,
         (select id from rooms where deleted_at is null limit 1) as room_id,
         (select id from clients where name='이하준' and deleted_at is null) as client_id,
         (select id from clients where name='이수진' and deleted_at is null) as guardian_id
),
new_schedule as (
  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, "start", "end", created_at, updated_at)
  select gen_random_uuid()::text, center_id, member_id, room_id, 'counseling', 'C00002 - 4회기',
         timestamp '2026-09-17 01:00:00', timestamp '2026-09-17 01:50:00', now(), now()
  from ctx
  where not exists (select 1 from schedules where title='C00002 - 4회기' and deleted_at is null)
  returning id, center_id
),
sched as (
  select id, center_id from new_schedule
  union all
  select id, center_id from schedules where title='C00002 - 4회기' and deleted_at is null limit 1
),
new_session as (
  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number, created_at, updated_at)
  select gen_random_uuid()::text, s.center_id, c.case_id, s.id, 'scheduled', 4, now(), now()
  from sched s, ctx c
  where not exists (select 1 from counseling_sessions where schedule_id = s.id and deleted_at is null)
  returning id
)
insert into schedule_change_requests
  (id, center_id, schedule_id, person_id, client_id, status,
   current_start, current_end, requested_start, requested_end, reason, created_at, updated_at)
select gen_random_uuid()::text, s.center_id, s.id,
       (select p.id from persons p join accounts a on a.id=p.account_id where a.email='guardian.leesujin@mindscope.com'),
       c.client_id, 'pending',
       timestamp '2026-09-17 01:00:00', timestamp '2026-09-17 01:50:00',
       timestamp '2026-09-18 07:00:00', timestamp '2026-09-18 07:50:00',
       '그 시간에 학교 행사가 생겼어요. 다음 날 오후로 옮겨 주실 수 있을까요?',
       now(), now()
from sched s, ctx c
where not exists (select 1 from schedule_change_requests where schedule_id = s.id and status='pending' and deleted_at is null);
