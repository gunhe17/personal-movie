-- s05 되돌리기 — 승인된 변경 요청과 옮겨진 회기를 촬영 대기 상태로.
--
-- 승인은 **회기를 실제로 옮긴다**. 그래서 한 번 찍고 나면 `s05-setup.sql`을 다시 돌려도
-- 전제가 깨진다 — 회기가 이미 9/18 16:00에 있는데 요청도 9/18 16:00이라
-- 화면에 "9/17 10:00 → 9/18 16:00"이 아니라 같은 시각 두 개가 뜬다(실측 2026-09-11).
--
--   docker exec -i saas-postgres psql -U imomtae -d imomtae -f- < _scripts/s05-reset.sql
--   docker exec -i saas-postgres psql -U imomtae -d imomtae -f- < _scripts/s05-setup.sql
--
-- 되돌리는 것: `C00002 - 4회기` 일정을 **9/17 10:00**(UTC 01:00)로, 그 일정의 변경 요청 전부 삭제.
-- 건드리지 않는 것: 보호자 계정·person·앱 연결(멱등이라 setup이 다시 안 만든다) · s05-schedules.sql의 35건.

\set ON_ERROR_STOP on

delete from schedule_change_requests
where schedule_id in (select id from schedules where title = 'C00002 - 4회기' and deleted_at is null);

update schedules
   set "start" = timestamp '2026-09-17 01:00:00',
       "end"   = timestamp '2026-09-17 01:50:00',
       updated_at = now()
 where title = 'C00002 - 4회기' and deleted_at is null;

select '회기 '||to_char("start",'MM-DD HH24:MI')||' · 요청 '||
       (select count(*) from schedule_change_requests r where r.schedule_id = s.id)||'건' as 상태
from schedules s where title = 'C00002 - 4회기' and deleted_at is null;
