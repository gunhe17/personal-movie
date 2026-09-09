-- s08 준비 — 케어보드에 **다른 구성원이 남긴 메모** 한 건.
--
-- 장면의 축은 "메모를 남기면 다른 사람이 본다"다. 그 왕복을 화면 하나에 세우려면
-- 시작 시점에 이미 남의 발화가 스트림에 있어야 한다 — 그것이 이 파일이 만드는 것이고,
-- 정상담의 답(촬영 중 UI로 작성)과 김원장의 재답(촬영 중 API로 작성)은 실제로 만들어진다.
--
-- 작성자는 **김원장(관리자 · access_level=all)** 이어야 한다. 최치료·박접수로는 못 쓴다 —
-- COUNSELOR는 access_level=own이라 담당이 아닌 이하준의 보드에 접근 자체가 404다
-- (list_care_board_stream.py:112 assert_client_accessible, 쓰기 경로도 같은 게이트).
--
-- 시각은 **UTC(naive)** 다. 웹은 그 값을 그대로 로컬 시각으로 그린다(view-model.ts:70).
-- 그래서 절대 시각을 박지 않고 `지금 - 40분`으로 넣는다 — 촬영이 몇 시에 돌든
-- 정상담이 그 자리에서 쓰는 메모(=API의 utc_now)보다 항상 앞서고, 같은 날짜 구분선에 붙는다.
--
-- 적용:   docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s08-setup.sql
-- 되돌리기: 파일 맨 아래 블록 (리허설·촬영을 반복하려면 매번 되돌린다)

with ctx as (
  select (select id from centers where deleted_at is null limit 1) center_id,
         (select id from clients where name='이하준' and deleted_at is null) client_id,
         (select m.id from members m join persons p on p.id=m.person_id
           where p.name='김원장' and m.deleted_at is null) author_id,
         (now() at time zone 'utc') - interval '40 minutes' as at
), memo as (
  insert into care_memos (id, center_id, client_id, author_id, body, created_at, updated_at)
  select gen_random_uuid()::text, center_id, client_id, author_id,
         '하준이 건 다음 주 사례회의 안건으로 올릴게요. 최근 회기에서 달라진 점 한 줄만 남겨주세요.',
         at, at
  from ctx
  where not exists (select 1 from care_memos where deleted_at is null)
  returning id, center_id, client_id, author_id, body, created_at
)
-- 메모는 care_memos에 저장되고, 스트림에 뜨는 것은 그 스냅샷인 care_board_entries 행이다.
-- 컬럼 구성은 write_care_board.py:_record_memo_entry(:181-199)와 같다 — kind=memo ·
-- share_class=internal(센터 내부 발화 · 내담자와 타 센터에는 나가지 않는다) · body는 300자 절삭본.
insert into care_board_entries
  (id, center_id, client_id, kind, occurred_at, source_table, source_id,
   actor_id, share_class, body, pinned, created_at, updated_at)
select gen_random_uuid()::text, center_id, client_id, 'memo', created_at, 'care_memos', id,
       author_id, 'internal', left(body, 300), false, created_at, created_at
from memo;

-- ── 되돌리기 (리허설·촬영 뒤 선행 상태로) ────────────────────────────────
-- 시드 기준선은 care_memos 0행 · kind='memo' 엔트리 0행이다. 그래서 통째로 지운다.
-- 촬영 중 정상담이 고정한 핀도 그 엔트리와 함께 사라진다.
--
--   docker exec saas-postgres psql -U imomtae -d imomtae -c \
--     "delete from care_board_entries where source_table='care_memos'; delete from care_memos;"
--
-- 읽음 기준선(care_board_reads)도 도크를 열 때마다 갱신된다. 되돌리려면:
--   docker exec saas-postgres psql -U imomtae -d imomtae -c \
--     "update care_board_reads set last_seen_at='2026-09-09 21:50:28.293676' \
--      where client_id=(select id from clients where name='이하준' and deleted_at is null);"
