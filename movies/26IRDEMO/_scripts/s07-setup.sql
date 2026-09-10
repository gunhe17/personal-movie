-- s07 준비 — 일지 초안이 "빈 칸을 채우는" 장면이 되게 한다. s06-setup.sql 다음에 돌린다.
--
-- 배역: **윤도현 · 개인상담 C00003 1회기**(2026-09-10 16:00-16:50). s06이 남긴 바로 그 필드노트다.
-- 2026-09-10 이전 판은 이하준(C00002)이었다 — s06이 검사 축으로 옮겨가면서 s07도 따라왔다.
-- "방금 녹음한 그 회기의 일지"가 다른 아이 이름으로 나오지 않게 하는 것이 이 이동의 전부다.
--
-- 시드는 모든 회기에 상담일지를 미리 써 둔다(counseling_notes 7건). 그 상태로 `일지 초안 생성`을
-- 누르면 InlineJournalEditor.applyDraft(:251-283)가 "이미 작성한 내용이 있어요" 브라우저 confirm을
-- 띄운다 — 화면에 네이티브 다이얼로그가 뜨고, 장면의 논지("아직 안 쓴 일지가 채워진다")도 깨진다.
-- C00003은 s06-setup.sql이 통째로 만드는 케이스라 일지 행이 애초에 없지만, 리허설을 한 번 돌리면
-- 생기므로 아래 update가 매번 비운다. 회기를 막 마치고 아직 일지를 안 쓴 상태가 이 장면의 출발점이다.
--
-- note_status도 되돌린다 — 한 번 돌리면 completed가 되어 다음 리허설이 같은 자리에서 출발하지 않는다.
update counseling_notes
set content = '{}'::jsonb, summary = null
where deleted_at is null
  and counseling_session_id in (
    select cs.id from counseling_sessions cs
    join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00003'
    join field_notes fn on fn.schedule_id = cs.schedule_id and fn.deleted_at is null
    where cs.deleted_at is null and fn.refined_transcript is not null
  );

update field_notes fn
set note_status = 'none'
where fn.deleted_at is null
  and fn.refined_transcript is not null
  and fn.schedule_id in (
    select cs.schedule_id from counseling_sessions cs
    join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00003'
    where cs.deleted_at is null
  );

-- 초안 이력도 비운다 — 웹은 "새 초안 id가 생겼는가"로 완료를 판정하므로 남아 있어도 되지만,
-- 화면의 `초안 N건 보기`가 리허설 횟수만큼 늘어나면 촬영본마다 숫자가 달라진다.
delete from counseling_note_ai_drafts
where counseling_session_id in (
  select cs.id from counseling_sessions cs
  join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00003'
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
-- 본문의 근거는 s06-setup.sql의 **윤도현 전사 23세그먼트**뿐이다. 전사에 없는 사실은 넣지 않았고,
-- 마인드봄 종합보고서(mindbom `seed_content.py` REPORT_BODIES)의 소견·제언과도 어긋나지 않게 썼다.
-- 1회기라 과제 점검이 아니라 라포 형성과 첫 과제 합의가 진행 내용의 축이다.
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
  "mood": "회기 초반 표정 변화가 적고 응답 전 침묵이 길었다. 허용적 반응 이후 발화가 늘었고, 수면을 말할 때 목소리가 작아졌다.",
  "main_topic": "자기 이야기를 꺼내도 괜찮다는 경험을 회기 안에서 먼저 만들고, 알아차린 감정을 한 단어로라도 밖에 내놓아 보게 한다. 오늘 처음 보고된 수면 곤란은 평가하지 않고 기록으로 이어서 본다.",
  "intervention": ["라포 형성", "개방형 질문·침묵 허용", "감정 명명·반영", "자기 개방 강화", "일상 리듬(수면) 확인", "정서 기록 과제 합의"],
  "progress": "또래 관계는 ‘애들이랑 축구도 하고’라며 무리 없이 보고했으나 자기 이야기는 ‘별로 안 해요, 딱히 할 말이 없어서’라고 했다. 말해도 되는지 확인을 구하는 질문 앞뒤로 13초·17초의 긴 침묵이 있었다. 무엇을 말해도 된다고 허용하자 ‘말하면 걱정하잖아요, 엄마도 요즘 힘든데’라며 함구의 이유를 밝혔고, 참으면 된다는 대처를 반영하고 몸의 신호를 묻자 ‘잠이 잘 안 와요’라며 2~3주간의 수면 곤란을 처음 보고했다. 말한 적 없던 것을 오늘 말해 준 것 자체를 강화했다.",
  "homework": "하루 한 번, 그날 기분을 한 단어로 적기 (잠이 안 온 날은 시각도 함께)",
  "next_goal": "기분 기록은 제출 여부나 성실도로 다루지 않고 적어 온 단어 하나에서 이야기를 연다. 수면은 아동이 적은 시각으로 경과를 확인하고, 악화되면 보호자 면담과 협진 여부를 논의한다. 어머니를 걱정시키지 않으려는 마음은 아동이 다시 꺼낼 때 따라간다.",
  "raw_notes": "아동 표현 그대로 ‘그냥 제가 참으면 되니까요’ · ‘두세 주 됐어요. 말한 적은 없어요’. 회기 30분."
}$prompt$,
  's07 촬영용 — 상담일지 초안 본문 고정(결정론). 촬영이 끝나면 이 행을 지운다.',
  now(), now()
);

-- ── 확인 — 촬영이 열 URL을 뽑는다 (caseId · sessionId는 재실행마다 바뀐다) ──────
select cc.id as case_id, cs.id as session_id, cc.case_code, c.name,
       fn.note_status, jsonb_array_length(fn.refined_transcript::jsonb) as segments
from counseling_cases cc
join counseling_sessions cs on cs.counseling_case_id = cc.id and cs.deleted_at is null
join field_notes fn on fn.schedule_id = cs.schedule_id and fn.deleted_at is null
join counseling_case_participants ccp
  on ccp.counseling_case_id = cc.id and ccp.participant_type = 'client'
join clients c on c.id = ccp.participant_id
where cc.case_code = 'C00003';
