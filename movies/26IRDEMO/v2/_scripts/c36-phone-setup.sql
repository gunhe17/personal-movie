-- C3.6 앱에서 변경 요청 — 내담자 앱 일정 탭에 **다가오는 14회기(9/18 금 16:00)**가 있고 변경 요청은 없어야 한다.
--
-- 회기 축(2026-09-14): 12회기 9/6 완료 → 13회기 9/13 노쇼(C7.3) → **14회기 9/18 16:00 → 9/22 17:00 요청(C3.6 · C3.7)**.
-- 14회기는 `c37-approve-setup.sql`이 만든다(그 파일은 대기 중인 요청까지 넣는다) → **그 뒤에 이 파일**로 요청을 지우고 시각을 되돌린다.
-- 옛 판(13회기를 따로 만들던 것)은 C7.3의 13회기와 겹쳐 버렸다.
-- 촬영 뒤 앱이 만든 요청이 C3.7이 받는 그 요청이다(웹 C3.7은 이미 찍었다).
-- 날짜는 고정 — 조작 스크립트가 달력에서 `9월 18일`을 라벨로 짚는다. 시각은 UTC(naive) = KST − 9h.
delete from schedule_change_requests where schedule_id = 'ca37e0de-0000-4000-8000-000000000037';

update schedules set start = timestamp '2026-09-18 07:00', "end" = timestamp '2026-09-18 07:50', updated_at = now()
where id = 'ca37e0de-0000-4000-8000-000000000037';

select s.title, s.start, cs.status,
       (select count(*) from schedule_change_requests r where r.schedule_id = s.id) as requests
from schedules s join counseling_sessions cs on cs.schedule_id = s.id
where s.id = 'ca37e0de-0000-4000-8000-000000000037';
