-- s05 보조 시드 — 캘린더의 일간·주간·월간이 빈 화면이 아니게 채운다.
-- 시드는 9월에 6건뿐이라 주간·월간이 텅 빈다. 실제 센터의 한 주처럼 보이게 얹는다.
--
-- 시각은 UTC(naive) = KST − 9h. 운영시간 MON~FRI 09:00–19:00 KST(= 00:00–10:00 UTC), 점심 12–13 KST.
-- **9/18(금) 16:00 KST(=07:00 UTC)는 비워 둔다** — s05가 승인할 요청 시각이다.
--   그 자리가 차면 approve 핸들러의 가용 슬롯 검사에 걸려 요청이 반려로 넘어가고 409가 난다.
-- 멱등: title 자연키.
insert into schedules (id, center_id, member_id, room_id, schedule_type, title, "start", "end", created_at, updated_at)
select gen_random_uuid()::text, ctx.c, ctx.m, ctx.r, v.typ, v.title,
       v.st::timestamp, v.st::timestamp + (v.mins || ' minutes')::interval, now(), now()
from (select (select id from centers where deleted_at is null limit 1) c,
             (select m.id from members m join persons p on p.id=m.person_id where p.name='정상담' and m.deleted_at is null) m,
             (select id from rooms where deleted_at is null limit 1) r) ctx,
(values
  -- 9/14 월
  ('놀이치료 - 김민준','counseling','2026-09-14 01:00',50),
  ('개인상담 - 박지우','counseling','2026-09-14 02:00',50),
  ('놀이치료 - 김서연','counseling','2026-09-14 05:00',50),
  ('언어치료 - 김서연','counseling','2026-09-14 06:00',50),
  -- 9/15 화
  ('개인상담 - 김영희','counseling','2026-09-15 01:00',50),
  ('검사 - 홍시우','assessment','2026-09-15 04:00',90),
  ('놀이치료 - 이하준','counseling','2026-09-15 06:00',50),
  -- 9/16 수
  ('부모상담 - 이수진','counseling','2026-09-16 00:00',50),
  ('놀이치료 - 김민준','counseling','2026-09-16 01:00',50),
  ('검사 - 장서아','assessment','2026-09-16 05:00',90),
  -- 9/17 목 (이하준 4회기가 10:00 KST에 있다)
  ('개인상담 - 박지우','counseling','2026-09-17 02:00',50),
  ('놀이치료 - 김서연','counseling','2026-09-17 06:00',50),
  -- 9/18 금 — 16:00 KST(07:00 UTC)만 비운다
  ('놀이치료 - 김민준','counseling','2026-09-18 00:00',50),
  ('개인상담 - 김영희','counseling','2026-09-18 01:00',50),
  ('검사 - 윤도현','assessment','2026-09-18 02:00',90),
  ('부모상담 - 김철수','counseling','2026-09-18 04:00',50),
  ('놀이치료 - 이하준','counseling','2026-09-18 05:00',50),
  ('개인상담 - 박지우','counseling','2026-09-18 08:00',50),
  ('언어치료 - 김서연','counseling','2026-09-18 09:00',50),
  -- 9/21~9/25
  ('놀이치료 - 김민준','counseling','2026-09-21 01:00',50),
  ('개인상담 - 박지우','counseling','2026-09-21 05:00',50),
  ('검사 - 홍시우','assessment','2026-09-22 02:00',90),
  ('놀이치료 - 이하준','counseling','2026-09-22 06:00',50),
  ('부모상담 - 이수진','counseling','2026-09-23 01:00',50),
  ('놀이치료 - 김서연','counseling','2026-09-23 05:00',50),
  ('개인상담 - 김영희','counseling','2026-09-24 02:00',50),
  ('검사 - 장서아','assessment','2026-09-24 05:00',90),
  ('놀이치료 - 김민준','counseling','2026-09-25 01:00',50),
  ('개인상담 - 박지우','counseling','2026-09-25 06:00',50),
  -- 9/28~9/30
  ('놀이치료 - 이하준','counseling','2026-09-28 01:00',50),
  ('부모상담 - 김철수','counseling','2026-09-28 05:00',50),
  ('검사 - 윤도현','assessment','2026-09-29 02:00',90),
  ('놀이치료 - 김서연','counseling','2026-09-29 06:00',50),
  ('개인상담 - 김영희','counseling','2026-09-30 01:00',50),
  ('놀이치료 - 김민준','counseling','2026-09-30 05:00',50)
) as v(title, typ, st, mins)
where not exists (
  select 1 from schedules s where s.title = v.title and s."start" = v.st::timestamp and s.deleted_at is null
);
