-- C4.3 녹음 촬영 직전 — 윤도현 C00003 1회기(오늘 16:00)를 **녹음하기 전** 상태로 되돌린다.
--
-- 이 회기는 C4.4 · C4.5를 위해 이미 끝났고(completed) 필드노트가 붙어 있다. 그대로 두면 전문가 앱이
-- "다가오는 일정"에서 이 회기를 빼고, 필드노트 홈에 `저장됨 · 이어서 녹음`을 띄운다 — 녹음 전 장면이 안 된다.
-- 폰 촬영이 끝나면 **반드시** `c43-restore.sql`로 되돌리고 나서 C4.4 · C4.5를 찍는다.
-- 전제: `c44-time-fix.sql`(오늘 16:00). 멱등.
update counseling_sessions cs set status = 'scheduled', completed_at = null
from schedules s where s.id = cs.schedule_id and s.title = 'C00003 - 1회기' and cs.deleted_at is null;

update counseling_session_participants p set attendance_status = 'scheduled', attended_at = null, is_consumed = false
from counseling_sessions cs join schedules s on s.id = cs.schedule_id
where p.session_id = cs.id and s.title = 'C00003 - 1회기';

update field_notes fn set deleted_at = now()
from schedules s where s.id = fn.schedule_id and s.title = 'C00003 - 1회기' and fn.deleted_at is null;

select cs.status, (select count(*) from field_notes fn where fn.schedule_id = s.id and fn.deleted_at is null) as notes
from counseling_sessions cs join schedules s on s.id = cs.schedule_id where s.title = 'C00003 - 1회기';
