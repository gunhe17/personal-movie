-- C5.5 공유문(전달문) — 검토 · 발행 준비.
--
-- 배역: 회기 축 — 이하준(놀이치료 C00002) 3회기 2026-09-06. 보호자는 어머니 이수진.
-- 화면: /counseling/status/<caseId>?session=<sessionId> → `내담자에게 전달` → TransferNoteModal
--       (좌 일지 원문 / 우 전달문) → `이 일지로 전달문 만들기` → 한 줄 고침 → `전달하기`.
--
-- ① 원문에 임상어를 심는다 — 컷의 논지가 "원문에 있는 것이 공유문에는 없다"이므로
--    원문 쪽에 진단 표기와 점수가 실제로 있어야 커서가 짚을 자리가 생긴다.
--    시드 본문은 그대로 두고 progress 끝에 한 문장만 더한다(다른 장면이 읽는 칸은 안 건드린다).
update counseling_notes cn
set content = cn.content || jsonb_build_object(
      'progress',
      (cn.content->>'progress') || ' K-CBCL 위축/우울 T 68(임상범위), 사회적 위축 F93.8 R/O 유지.'
    )
from counseling_sessions cs
join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
join schedules s on s.id = cs.schedule_id
where cn.counseling_session_id = cs.id
  and cn.deleted_at is null and cs.deleted_at is null
  and s.start = timestamp '2026-09-06 10:00:00'
  and (cn.content->>'progress') not like '%K-CBCL%';   -- 재실행해도 한 번만 붙는다

-- ② 전달문 생성은 진짜 LLM 1콜이다(GenerateGuardianShareService → AIFacade.generate_json).
--    로컬엔 키가 없고, 촬영 규칙 5는 촬영 중 진짜 LLM 호출을 금한다.
--    제품이 이미 가진 자리로 결정론을 만든다 — `production_ai_configs`.
--    AIFacade.resolve_config('note_share_guardian', module='counseling')이 호출마다 DB를 읽어
--    system_prompt·model_name을 덮는다. 모델 한 홉은 `_scripts/llm-stub.mjs`(:3599)가 받아쓴다.
--    파이프라인·llm_calls 기록·counseling_note_shares 적재는 전부 진짜 경로로 돈다.
delete from production_ai_configs
where module = 'counseling' and pipeline_step in ('note_share_guardian', 'note_share_self');

insert into production_ai_configs (
  id, module, pipeline_step, provider, model_name, is_active, system_prompt, description,
  created_at, updated_at
) values (
  'c0de5e07-0000-4000-8000-000000000055',
  'counseling', 'note_share_guardian', 'openai', 'gpt-4o-mini', true,
  $prompt$아래 JSON을 한 글자도 바꾸지 말고 그대로 출력한다.
사용자 메시지의 일지 원문은 참고하지 않는다. 요약·재작성·키 추가·키 삭제를 하지 않는다.
설명 문장 없이 JSON만 출력한다.

{
  "text": "오늘 하준이는 지난 시간보다 한결 밝고 적극적인 모습으로 왔어요.\n\n오늘은 친구에게 다가가는 상황을 놀이로 함께 연습했어요. 먼저 인사하기, 같이 놀자고 말 건네기를 번갈아 해 보았고, 하준이가 스스로 역할을 골라 자신 있게 참여했습니다. 어머님께서 전해주신 대로 학교에서 친구에게 먼저 말을 건넨 일도 오늘 이야기 안에서 다시 한 번 짚어 주었어요.\n\n다음 시간에는 친구와 마음이 부딪혔을 때 어떻게 풀어 가면 좋을지를 같이 다뤄 보려고 해요.\n\n집에서는 하루에 한 번, 학교에서 친구에게 먼저 인사해 보기를 해 보면 좋겠어요. 잘 되지 않은 날이 있어도 괜찮으니 그날 있었던 일을 편하게 들어 주시면 충분합니다."
}$prompt$,
  'C5.5 촬영용 — 보호자 전달문 본문 고정(결정론). 촬영이 끝나면 이 행을 지운다.',
  now(), now()
);

-- ③ 되돌리기 — 리허설이 만든 전달문을 지운다(한 번 만들면 버튼이 `다시 만들기`가 되고
--    confirm 다이얼로그가 뜬다. 매 판 같은 자리에서 출발해야 한다).
delete from counseling_note_shares
where counseling_session_id in (
  select cs.id from counseling_sessions cs
  join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
  where cs.deleted_at is null
);

-- 앞 컷(C6.4)이 남긴 경과 분석은 지운다 — 좌측 패널의 `AI 경과 분석 완료` 배지가
-- 이 컷에는 없던 상태다.
delete from counseling_case_analyses
where counseling_case_id = (select id from counseling_cases where case_code='C00002' and deleted_at is null);

-- ── 확인 — 촬영이 열 URL을 뽑는다 (id는 재시드마다 바뀐다) ────────────────────
select cc.id as case_id, cs.id as session_id, c.name as client, s.start
from counseling_sessions cs
join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
join schedules s on s.id = cs.schedule_id
join counseling_case_participants ccp
  on ccp.counseling_case_id = cc.id and ccp.participant_type = 'client'
join clients c on c.id = ccp.participant_id
where cs.deleted_at is null and s.start = timestamp '2026-09-06 10:00:00';
