-- s07 준비 — 일지 초안이 "빈 칸을 채우는" 장면이 되게 한다. s06-setup.sql 다음에 돌린다.
--
-- 시드는 모든 회기에 상담일지를 미리 써 둔다(counseling_notes 7건). 그 상태로 `일지 초안 생성`을
-- 누르면 InlineJournalEditor.applyDraft(:251-283)가 "이미 작성한 내용이 있어요" 브라우저 confirm을
-- 띄운다 — 화면에 네이티브 다이얼로그가 뜨고, 장면의 논지("아직 안 쓴 일지가 채워진다")도 깨진다.
-- 그래서 이 회기의 일지만 비운다. 회기를 막 마치고 아직 일지를 안 쓴 상태가 이 장면의 출발점이다.
--
-- note_status도 되돌린다 — 한 번 돌리면 completed가 되어 다음 리허설이 같은 자리에서 출발하지 않는다.
update counseling_notes
set content = '{}'::jsonb, summary = null
where deleted_at is null
  and counseling_session_id in (
    select cs.id from counseling_sessions cs
    join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
    join field_notes fn on fn.schedule_id = cs.schedule_id and fn.deleted_at is null
    where cs.deleted_at is null and fn.refined_transcript is not null
  );

update field_notes fn
set note_status = 'none'
where fn.deleted_at is null
  and fn.refined_transcript is not null
  and fn.schedule_id in (
    select cs.schedule_id from counseling_sessions cs
    join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
    where cs.deleted_at is null
  );

-- 초안 이력도 비운다 — 웹은 "새 초안 id가 생겼는가"로 완료를 판정하므로 남아 있어도 되지만,
-- 화면의 `초안 N건 보기`가 리허설 횟수만큼 늘어나면 촬영본마다 숫자가 달라진다.
delete from counseling_note_ai_drafts
where counseling_session_id in (
  select cs.id from counseling_sessions cs
  join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
  where cs.deleted_at is null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 초안 본문을 촬영용으로 고정한다 (제품 코드 변경 없음 · 워커 재시작 없음)
--
-- 초안 본문은 스텁이 아니라 **진짜 LLM 호출**이 만든다:
--   generate_counseling_note.py → (embedded 모드라 event 워커가 즉시 실행)
--   → GenerateCounselingNoteService.execute → AIFacade.generate_json
--   → AIGateway._get_llm_client → openai_client(gpt-4o-mini)  [llm_calls 표에 기록됨]
-- 그래서 매 테이크마다 문안이 달라지고, 기본 프롬프트가 뽑는 세 칸은 한 문장씩으로 얄팍하다.
--
-- 결정적으로 만드는 자리는 제품이 이미 갖고 있다 — `production_ai_configs`.
-- AIGateway.resolve_config(module='field_note', pipeline_step='counseling_note')가
-- **호출마다 DB를 읽어** system_prompt와 model_name을 덮는다(ai_gateway.py:36-77).
-- 즉 이 한 행이면 코드도 안 고치고 프로세스도 안 재시작하고 본문이 고정된다.
-- LLM은 이 프롬프트를 그대로 받아쓰는 역할만 한다(파이프라인·초안 이력·upsert는 전부 진짜 경로).
--
-- 본문의 근거는 s06-setup.sql의 전사 12세그먼트뿐이다. 전사에 없는 사실은 넣지 않았다.
delete from production_ai_configs
where module = 'field_note' and pipeline_step = 'counseling_note';

insert into production_ai_configs (
  id, module, pipeline_step, provider, model_name, is_active, system_prompt, description,
  created_at, updated_at
) values (
  'c0de5e07-0000-4000-8000-000000000007',
  'field_note', 'counseling_note', 'openai', 'gpt-4o-mini', true,
  $prompt$아래 JSON을 한 글자도 바꾸지 말고 그대로 출력한다.
사용자 메시지의 녹취록·메모·요약은 참고하지 않는다. 요약·재작성·키 추가·키 삭제를 하지 않는다.
설명 문장 없이 JSON만 출력한다.

{
  "mood": "회기 초반 위축된 태도. 놀이 제안 이후 자발적 발화가 늘었고, 실패한 시도를 말할 때 목소리가 작아졌다.",
  "main_topic": "또래에게 먼저 다가가는 행동을 실제 상황에서 시도해 보게 하고, 시도 뒤 남는 불편한 감정을 아동이 스스로 다룰 수 있게 돕는다. 기분 조절에 쓸 수 있는 신체활동은 아동이 직접 고르게 한다.",
  "intervention": ["과제 점검", "감정 명명·반영", "시도 행동 강화", "인형놀이 역할 전환(역할놀이)", "심리교육 — 신체활동과 기분", "행동 활성화 계획 합의"],
  "progress": "과제 점검 — 학교에서 친구에게 인사하기를 두 번 시도했고, 한 번은 상대가 듣지 못한 것 같았다고 보고했다. 그때의 감정을 ‘좀 창피했어요’로 표현하며 그대로 지나갔다고 했다. 감정을 명명해 되돌려 주고 결과보다 시도 자체를 강화하자 아동이 먼저 인형놀이를 요청했고, 먼저 말을 거는 역할을 제안하자 ‘제가요?’라며 주저한 뒤 수락했다. 후반부 신체활동과 기분을 설명하자 스스로 축구를 꺼내며 ‘아빠랑은 못 하니까 혼자 공 차기라도’라고 덧붙였고, 주 3회 공 차기로 합의했다.",
  "homework": "주 3회 공 차기",
  "next_goal": "공 차기는 횟수만 확인하고 성패로 다루지 않는다. 인형놀이에서 맡은 ‘먼저 말 거는 역할’을 인사 다음 한 마디까지 확장하고, 반응을 얻지 못했을 때 쓸 대처를 놀이 안에서 미리 연습한다. 아버지와 함께하지 못한다는 언급은 아동이 다시 꺼낼 때 따라간다.",
  "raw_notes": "아동 표현 그대로 ‘아빠랑은 못 하니까 혼자 공 차기라도’. 회기 30분."
}$prompt$,
  's07 촬영용 — 상담일지 초안 본문 고정(결정론). 촬영이 끝나면 이 행을 지운다.',
  now(), now()
);
