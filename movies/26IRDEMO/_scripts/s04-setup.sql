-- s04 준비 — **바로링크로 보이는 상담 기록(공유문)** 을 만든다.
--
-- 바로링크는 원래 검사만 실었다. 2026-09-10 밤에 제품 사본에 `journals`를 더해
-- **센터가 발행한 공유문**이 같은 링크·같은 인증으로 보이게 했다(STATUS.md 제품 변경 표).
-- 이 파일은 그 화면에 실을 내용을 만든다 — 발행된 공유문 두 편.
--
-- ⚠️ 임상 원문(counseling_notes)은 이 경로에 실리지 않는다. 나가는 것은 content->>'text' 하나다.
--    그래서 여기 쓰는 글도 **보호자에게 읽히는 문장**으로 쓴다. 시드 밖 실명은 쓰지 않는다.
--
-- 전제: ① s01을 먼저 돌려 윤도현이 있어야 하고 ② `_scripts/s06-setup.sql`이 C00003(개인상담)을 만들어 둬야 한다.
-- 적용:   docker exec -i saas-postgres psql -U imomtae -d imomtae -f- < _scripts/s04-setup.sql
-- 재실행: 아래 정리 블록이 제 것만 지우고 다시 만든다.

\set ON_ERROR_STOP on

do $$
declare
  v_center  varchar(36);
  v_client  varchar(36);
  v_author  varchar(36);
  v_session varchar(36);
  v_no      int;
  v_texts   text[] := array[
    '오늘은 도현이가 먼저 "지난주에 못 한 이야기가 있다"며 자리에 앉았어요. 학교에서 있었던 일을 스스로 꺼낸 건 처음입니다.'
    || E'\n\n' ||
    '중간에 말이 막히자 종이에 그림을 그려 설명했어요. 말 대신 다른 방법을 스스로 찾은 것이라 그 자리에서 충분히 기다려 주었습니다.'
    || E'\n\n' ||
    '집에서는 "오늘 어땠어?" 대신 "오늘 제일 기억나는 게 뭐야?"처럼 하나만 물어봐 주세요. 도현이가 고르기 쉬워집니다.',

    '이번 회기에는 감정을 이름 붙이는 연습을 했어요. 화남 · 서운함 · 억울함을 구분해 보는 활동이었고, 도현이는 "서운한 건 화나는 거랑 다르다"고 말했습니다.'
    || E'\n\n' ||
    '집에서 비슷한 상황이 생기면 감정을 대신 말해 주기보다, 도현이가 고른 말을 그대로 따라 말해 주시면 도움이 됩니다.'
  ];
begin
  -- 0. 전제
  select id into v_client from clients where name = '윤도현' and deleted_at is null limit 1;
  if v_client is null then
    raise exception '윤도현이 없다 — s01(_scripts/s01-intake.mjs)을 먼저 돌려라.';
  end if;

  select cc.center_id, cc.counselor_id into v_center, v_author
  from counseling_cases cc where cc.case_code = 'C00003' and cc.deleted_at is null limit 1;
  if v_center is null then
    raise exception 'C00003(윤도현 개인상담)이 없다 — _scripts/s06-setup.sql을 먼저 돌려라.';
  end if;

  -- 1. 정리 — 이 파일이 만든 공유문만
  delete from counseling_note_shares
  where client_id = v_client
    and counseling_session_id in (
      select cs.id from counseling_sessions cs
      join counseling_cases cc on cc.id = cs.counseling_case_id
      where cc.case_code = 'C00003');

  -- 2. 발행 — 회기 번호가 큰 것부터 두 편(화면은 최근 회기가 위)
  v_no := 0;
  for v_session in
    select cs.id from counseling_sessions cs
    join counseling_cases cc on cc.id = cs.counseling_case_id
    where cc.case_code = 'C00003' and cs.deleted_at is null
    order by cs.session_number desc nulls last
    limit 2
  loop
    v_no := v_no + 1;
    insert into counseling_note_shares
      (id, center_id, counseling_session_id, client_id, author_id,
       audience, status, content, is_edited, published_at, created_at, updated_at)
    values
      (gen_random_uuid()::varchar, v_center, v_session, v_client, v_author,
       'guardian', 'published',
       jsonb_build_object('text', v_texts[v_no]),
       false, now() - (v_no || ' days')::interval, now(), now());
  end loop;

  if v_no = 0 then
    raise exception 'C00003에 회기가 없다 — _scripts/s06-setup.sql을 먼저 돌려라.';
  end if;
end $$;

select '공유문 '||count(*)||'편 발행' as 상태
from counseling_note_shares s
join counseling_sessions cs on cs.id = s.counseling_session_id
join counseling_cases cc on cc.id = cs.counseling_case_id
where cc.case_code = 'C00003' and s.status = 'published';
