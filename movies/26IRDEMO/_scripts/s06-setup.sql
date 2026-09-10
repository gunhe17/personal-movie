-- s06 준비 — **윤도현**의 상담 회기와 그 회기의 필드노트 전사(화자 분리)를 만든다.
--
-- 왜 만들어야 하나: 윤도현은 s01이 촬영 중에 만드는 **검사** 케이스(AC0002)만 가진다.
-- 필드노트는 회기에 매달리므로(`field_notes.schedule_id` → `counseling_sessions.schedule_id`,
-- `+page.svelte:186-229` linkedSession) 상담 케이스 · 일정 · 회기가 먼저 있어야 한다.
-- 시드에는 윤도현의 상담 케이스가 없다(C00001 박지우 · C00002 이하준 둘뿐).
--
-- 전제: **s01을 먼저 돌려야 한다.** 재시드하면 윤도현이 사라진다 — 아래 가드가 그때 소리 내어 멈춘다.
-- 적용:   PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae -f _scripts/s06-setup.sql
-- 재실행: 맨 위 정리 블록이 제 것만 지우고 다시 만든다 — 몇 번을 돌려도 같은 상태다.

\set ON_ERROR_STOP on

-- ── 0. 전제 확인 ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from clients where name = '윤도현' and deleted_at is null) then
    raise exception '윤도현이 없다 — s01(_scripts/s01-intake.mjs)을 먼저 돌려라. 재시드는 그를 지운다.';
  end if;
end $$;

-- ── 1. 정리 — 이 파일이 만드는 것만 지운다(재실행 가능하게) ──────────────────
delete from field_notes
where schedule_id in (select cs.schedule_id from counseling_sessions cs
                      join counseling_cases cc on cc.id = cs.counseling_case_id
                      where cc.case_code = 'C00003');
delete from counseling_notes
where counseling_session_id in (select cs.id from counseling_sessions cs
                                join counseling_cases cc on cc.id = cs.counseling_case_id
                                where cc.case_code = 'C00003');
delete from counseling_session_participants
where session_id in (select cs.id from counseling_sessions cs
                     join counseling_cases cc on cc.id = cs.counseling_case_id
                     where cc.case_code = 'C00003');
delete from schedules
where id in (select cs.schedule_id from counseling_sessions cs
             join counseling_cases cc on cc.id = cs.counseling_case_id
             where cc.case_code = 'C00003');
delete from counseling_sessions
where counseling_case_id in (select id from counseling_cases where case_code = 'C00003');
delete from counseling_case_participants
where counseling_case_id in (select id from counseling_cases where case_code = 'C00003');
delete from counseling_cases where case_code = 'C00003';

-- ── 2. 윤도현의 상담 케이스 C00003 ──────────────────────────────────────────
-- 종합심리평가(s03 마인드봄 보고서)의 제언 ①("정서 인식과 표현을 목표로 한 개인 상담을
-- 주 1회 규칙적으로 유지할 것을 권고한다" — mindbom `seed_content.py` REPORT_BODIES)에서
-- 이어지는 케이스다. 프로그램은 **개인상담** — 만 12세에게 놀이치료는 맞지 않는다.
with ctx as (
  select (select id from centers where deleted_at is null limit 1)                         as center_id,
         (select id from programs where name = '개인상담' and deleted_at is null)          as program_id,
         (select m.id from members m join persons p on p.id = m.person_id
           where p.name = '정상담' and m.deleted_at is null)                               as counselor_id,
         (select id from rooms where deleted_at is null limit 1)                           as room_id,
         (select id from clients where name = '윤도현' and deleted_at is null)             as client_id
),
new_case as (
  insert into counseling_cases (id, center_id, program_id, counselor_id, status, case_code,
                                total_sessions, chief_complaint, created_at, updated_at)
  select gen_random_uuid()::text, center_id, program_id, counselor_id, 'active', 'C00003',
         12,
         '햇살지역아동센터 단체 심리평가에서 의뢰. 또래와 어울리는 데는 무리가 없으나 자기 이야기를 거의 하지 않고, 집에서는 말수가 줄고 힘든 일이 있어도 내색하지 않음. 종합 심리평가 제언에 따라 정서 인식·표현을 목표로 개인상담 시작',
         now(), now()
  from ctx
  returning id, center_id, counselor_id
),
case_part as (
  insert into counseling_case_participants (id, center_id, counseling_case_id, participant_id,
                                            participant_type, joined_at, is_active, created_at, updated_at)
  select gen_random_uuid()::text, nc.center_id, nc.id, v.pid, v.ptype, now(), true, now(), now()
  from new_case nc, ctx,
       lateral (values (nc.counselor_id, 'counselor'), (ctx.client_id, 'client')) v(pid, ptype)
  returning 1
),
-- 일정 — 시각은 **naive로 저장하고 필드노트 화면은 그 값을 그대로 그린다**.
-- (`+page.svelte:322` `new Date(scheduleDetail.start)` 가 오프셋 없는 문자열을 **로컬(KST)** 로 파싱하고,
--  `formatUtcToKst`가 다시 +9h 해서 UTC로 읽는다 — 두 번이 서로 상쇄돼 저장값이 그대로 나온다.
--  시드도 같은 관례다: `seed/develop/counseling.py:230` 이 10시를 오전 10시 회기로 쓴다.)
-- 그래서 화면에 띄우고 싶은 벽시계 시각을 그대로 넣는다 — 16:00, 방과 후. 절대 시각이라 테이크마다 같다.
--
-- **날짜는 어제(09-09)다 — 오늘이 아니다.** 회기 상세(s07)의 `InlineJournalEditor.isBeforeStart`가
-- `new Date(session.start) > Date.now()`로 **벽시계 시각을 그대로 비교**한다(:145-150). 오늘 16:00을 넣으면
-- 낮에 리허설·촬영하는 동안 그 회기는 '아직 진행되지 않은 회기'라 출결도 일지도 열리지 않는다 —
-- `일지 초안 생성` 버튼 자체가 없다. status=completed인데 시작 시각이 미래인 것 자체가 어긋난 데이터다.
-- 어제 방과 후로 두면 시각과 무관하게 언제 돌려도 지난 회기다. 그리고 그게 s07의 이야기다 —
-- **어제 마친 회기의 일지가 아직 비어 있다.**
new_sched as (
  insert into schedules (id, center_id, member_id, room_id, schedule_type, title, "start", "end",
                         created_at, updated_at)
  select gen_random_uuid()::text, nc.center_id, nc.counselor_id, ctx.room_id, 'counseling',
         'C00003 - 1회기', timestamp '2026-09-09 16:00:00', timestamp '2026-09-09 16:50:00', now(), now()
  from new_case nc, ctx
  returning id, center_id
),
new_session as (
  insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status,
                                   session_number, completed_at, created_at, updated_at)
  select gen_random_uuid()::text, nc.center_id, nc.id, ns.id, 'completed', 1,
         timestamp '2026-09-09 16:50:00', now(), now()
  from new_case nc, new_sched ns
  returning id, center_id, schedule_id
),
sess_part as (
  insert into counseling_session_participants (id, center_id, session_id, participant_id,
                                               participant_type, attendance_status, attended_at,
                                               is_consumed, created_at, updated_at)
  select gen_random_uuid()::text, s.center_id, s.id, v.pid, v.ptype, 'attended',
         timestamp '2026-09-09 16:00:00', true, now(), now()
  from new_session s, new_case nc, ctx,
       lateral (values (nc.counselor_id, 'counselor'), (ctx.client_id, 'client')) v(pid, ptype)
  returning 1
)
-- ── 3. 그 회기의 필드노트 + 전사 ────────────────────────────────────────────
-- 웹이 읽는 우선순위: refined_transcript > audios[0].diarized_transcript > 청크 transcript
--   (`field-note/view-model.ts:140-166`) · 형식은 {speaker, text, start} 배열(:102-126).
-- 화자 표시 이름은 저장된 speaker_map이 없으면 **세션 참가자 순서**로 붙는다
--   (`FieldNoteCompleted.svelte:238-246` ← participantCandidates = [상담사, 내담자들]).
--   그래서 첫 화자가 상담사여야 정상담 · 윤도현으로 갈린다.
-- 침묵 마커는 nonverbal_markers가 만든다(`view-model.ts:258-273` → "N초 침묵" 구분선).
--   종합보고서의 태도 소견("응답 전 침묵이 길고 확인을 구하는 태도가 반복")이 화면에 보이는 자리다.
insert into field_notes (
  id, center_id, schedule_id, author_id, status, processing_status,
  transcribe_status, refine_status, diarization_status, summary_status, note_status,
  total_duration, summary, refined_transcript, nonverbal_markers, created_at, updated_at)
select gen_random_uuid()::text, s.center_id, s.schedule_id, nc.counselor_id,
       'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'none',
       1800.0,
       '정서 표현을 회피하는 대처 확인. 수면 곤란 2~3주 보고. 하루 한 단어 기분 기록 과제 합의.',
$json$[
  {"speaker":"상담사","text":"도현아, 지난번 검사 때 두 시간 넘게 앉아 있었잖아. 힘들지 않았어?","start":14},
  {"speaker":"내담자","text":"괜찮았어요.","start":26},
  {"speaker":"상담사","text":"괜찮았구나. 오늘은 검사 말고 도현이 이야기를 좀 들어보려고 해.","start":33},
  {"speaker":"내담자","text":"...무슨 이야기요?","start":54},
  {"speaker":"상담사","text":"아무거나. 요즘 학교나 센터에서 어떻게 지내는지.","start":61},
  {"speaker":"내담자","text":"그냥 똑같아요. 애들이랑 축구도 하고, 급식 먹고.","start":72},
  {"speaker":"상담사","text":"친구들이랑은 잘 지내는구나. 그러면 친구들한테 도현이 이야기는 얼마나 해?","start":83},
  {"speaker":"내담자","text":"제 얘기요? ... 별로 안 해요. 딱히 할 말이 없어서.","start":96},
  {"speaker":"상담사","text":"할 말이 없다는 건, 얘기할 게 없다는 걸까 아니면 얘기하기가 좀 그렇다는 걸까?","start":109},
  {"speaker":"내담자","text":"...이런 것도 말해도 돼요?","start":137},
  {"speaker":"상담사","text":"그럼. 여기서는 뭘 말해도 돼. 정답이 있는 것도 아니고.","start":145},
  {"speaker":"내담자","text":"말하면 걱정하잖아요. 엄마도 요즘 힘든데.","start":156},
  {"speaker":"상담사","text":"엄마가 힘들어 보여서 도현이가 말을 아끼고 있었구나.","start":170},
  {"speaker":"내담자","text":"그냥 제가 참으면 되니까요.","start":181},
  {"speaker":"상담사","text":"참으면 된다고 생각했구나. 그런데 참는 것도 힘이 드는 일이야. 참고 있을 때 몸이 어떤지 알아차린 적 있어?","start":190},
  {"speaker":"내담자","text":"잠이 잘 안 와요. 누우면 자꾸 생각이 나요.","start":1042},
  {"speaker":"상담사","text":"며칠쯤 그랬어?","start":1055},
  {"speaker":"내담자","text":"두세 주 됐어요. 말한 적은 없어요.","start":1062},
  {"speaker":"상담사","text":"말한 적 없다는 걸 오늘 선생님한테 말해준 거네. 오늘 제일 큰 게 그거야.","start":1074},
  {"speaker":"상담사","text":"다음 주까지 해볼 게 하나 있어. 하루에 한 번, 그날 기분을 한 단어로만 적어보는 거야. 문장 아니어도 돼.","start":1588},
  {"speaker":"내담자","text":"한 단어면... 그건 할 수 있을 것 같아요.","start":1604},
  {"speaker":"상담사","text":"좋아. 잠이 안 온 날은 옆에 시간만 적어줘. 그건 선생님이 볼게.","start":1615},
  {"speaker":"내담자","text":"네.","start":1628}
]$json$,
$nv$[
  {"type":"silence","start":41,"end":54,"duration":13.2},
  {"type":"silence","start":120,"end":137,"duration":17.4}
]$nv$,
       now(), now()
from new_session s, new_case nc;

-- ── 4. 확인 — 촬영이 열 URL을 뽑는다 ────────────────────────────────────────
select fn.id as field_note_id,
       c.name, cc.case_code, s.title, s.start,
       jsonb_array_length(fn.refined_transcript::jsonb) as segments
from field_notes fn
join schedules s on s.id = fn.schedule_id
join counseling_sessions cs on cs.schedule_id = s.id and cs.deleted_at is null
join counseling_cases cc on cc.id = cs.counseling_case_id
join counseling_case_participants ccp
  on ccp.counseling_case_id = cc.id and ccp.participant_type = 'client'
join clients c on c.id = ccp.participant_id
where fn.deleted_at is null and cc.case_code = 'C00003';
