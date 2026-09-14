-- C4.3 폰 촬영 뒤 — `c43-pre-record.sql`이 되돌린 윤도현 C00003 1회기를 **녹음이 끝난** 상태로 복원한다.
-- 2026-09-14 실측값 그대로: 회기 completed(07:50 UTC) · 참여자 둘 attended(07:00) · 차감 true · 필드노트 살림.
-- C4.4 · C4.5는 이 상태 위에서 찍는다. 멱등.
update counseling_sessions cs set status = 'completed', completed_at = timestamp '2026-09-14 07:50'
from schedules s where s.id = cs.schedule_id and s.title = 'C00003 - 1회기' and cs.deleted_at is null;

update counseling_session_participants p set attendance_status = 'attended', attended_at = timestamp '2026-09-14 07:00', is_consumed = true
from counseling_sessions cs join schedules s on s.id = cs.schedule_id
where p.session_id = cs.id and s.title = 'C00003 - 1회기';

update field_notes fn set deleted_at = null
from schedules s where s.id = fn.schedule_id and s.title = 'C00003 - 1회기' and fn.deleted_at is not null;

select cs.status, (select count(*) from field_notes fn where fn.schedule_id = s.id and fn.deleted_at is null) as notes
from counseling_sessions cs join schedules s on s.id = cs.schedule_id where s.title = 'C00003 - 1회기';
