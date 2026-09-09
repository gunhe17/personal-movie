-- s09 되돌리기 — 노쇼 처리된 5회기를 '예정 · 출결 미확인'으로 되돌린다.
-- 행을 지우지 않으므로 sessionId가 그대로 유지된다(촬영 URL을 다시 만들 필요가 없다).
-- 리허설·촬영을 다시 돌리기 전에 이것만 넣으면 된다. s09-setup.sql은 행이 없을 때만 필요하다.
update counseling_sessions
   set status = 'scheduled', updated_at = now()
 where schedule_id in (select id from schedules where title = 'C00002 - 5회기' and deleted_at is null);

update counseling_session_participants
   set attendance_status = 'scheduled', is_consumed = false, memo = null,
       attended_at = null, updated_at = now()
 where session_id in (
   select cs.id from counseling_sessions cs
     join schedules s on s.id = cs.schedule_id
    where s.title = 'C00002 - 5회기' and s.deleted_at is null and cs.deleted_at is null);
