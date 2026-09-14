-- C4.3 · C4.4 · C4.5 회기 시각 — `_scripts/s06-setup.sql` 다음에 넣는다. 멱등.
--
-- ① UTC로 바로잡는다. s06-setup.sql은 `2026-09-09 16:00`(KST 뜻)을 UTC 칸에 넣어 회기 화면이 **새벽 01:00**으로 그렸다.
-- ② **오늘(촬영일 2026-09-14)로 옮긴다.** C4.3(전문가 앱)은 "오늘 기록할 일정"에서 이 회기를 골라 녹음한다 —
--    폰의 그 회기와 C4.4 필드노트 · C4.5 회기 상세가 같은 날 16:00이어야 한 편으로 붙는다.
--    16:00 KST = 07:00 UTC. v1 setup은 v1 테이크의 전제라 제자리에서 안 고치고 이 파일로 덮는다.
-- ③ 오늘의 채움 일정(`_scripts/s05-schedules.sql`의 9/14 넷)을 지운다 — 전문가 앱 홈이 그것들을 오늘 일정으로 보여준다.
--    C3.7(캘린더) 촬영이 끝난 뒤에만 넣는다. 되돌리려면 s05-schedules.sql을 다시 넣으면 된다(제목 자연키로 멱등).
delete from schedules
where deleted_at is null
  and start >= timestamp '2026-09-14 00:00' and start < timestamp '2026-09-14 15:00'
  and title in ('놀이치료 - 김민준','개인상담 - 박지우','놀이치료 - 김서연','언어치료 - 김서연')
  and not exists (select 1 from counseling_sessions cs where cs.schedule_id = schedules.id);

update schedules set start = timestamp '2026-09-14 07:00', "end" = timestamp '2026-09-14 07:50'
where title = 'C00003 - 1회기' and deleted_at is null;

update counseling_sessions cs set completed_at = timestamp '2026-09-14 07:50'
from schedules s
where s.id = cs.schedule_id and s.title = 'C00003 - 1회기' and cs.deleted_at is null and cs.completed_at is not null;

update counseling_session_participants p set attended_at = timestamp '2026-09-14 07:00'
from counseling_sessions cs join schedules s on s.id = cs.schedule_id
where p.session_id = cs.id and s.title = 'C00003 - 1회기' and p.attended_at is not null;

select s.title, s.start, s."end" from schedules s where s.title = 'C00003 - 1회기' and s.deleted_at is null;
