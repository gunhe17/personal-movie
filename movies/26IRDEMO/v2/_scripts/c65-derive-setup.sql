-- C6.5 제출 서류 파생 — "같은 일지에서, 제출처마다".
--
-- 배역: 회기 축 — 이하준(놀이치료 C00002) 12회기 2026-09-06. 바우처는 아동비전형성지원서비스.
-- 화면: /counseling/status/<caseId>?session=<sessionId> → 일지 모달 → `제출 서류 초안 작성`
--       → DeriveFormModal (좌 일지 원문 / 우 바우처 양식) → `이 일지로 양식 채우기`.
--
-- 이 SQL이 하는 일 둘.
--   ① 바우처(아동비전형성지원서비스)에 제출 양식 한 장을 건다 — 시드의 `회기 기록지`.
--      voucher_form_templates 는 시드에 0행이라 버튼이 "연결된 양식이 없다"로 끝난다.
--      양식을 새로 만들지 않는다 — 회기 기록지의 칸(회기 일자·차수·내용·특이사항·다음 계획)이
--      상담 일지에서 그대로 옮겨지는 모양이라 파생의 논지가 화면에 그대로 선다.
--   ② 파생 본문을 고정한다 — 파생은 요청형 LLM 1콜(DeriveSubmissionFormService → AIFacade)이고
--      로컬엔 키가 없다(촬영 규칙 5). C5.5·C6.4와 같은 자리를 쓴다: production_ai_configs의
--      module='counseling' · pipeline_step='note_derive_form' system_prompt를 llm-stub(:3599)가
--      받아쓴다. 파이프라인·llm_calls 기록·forms/form_values 적재는 전부 진짜 경로로 돈다.
--
-- 값은 일지에서 옮긴 것이다(지어낸 인물·실명 없음). 특히 `content`는 원문 progress의 그 문장이라
-- 커서가 좌우를 오갈 자리가 된다. 임상 표기(K-CBCL T 68 · F93.8 R/O)는 제출 서류로 넘어가지 않는다.
--
-- 멱등: 재실행해도 링크 1행·config 1행.

-- ① 바우처 ↔ 양식
insert into voucher_form_templates (id, voucher_id, form_template_id, kind, created_at, updated_at)
select
  'f0c65000-0000-4000-8000-000000000065',
  v.id,
  t.id,
  '기록지',
  now(), now()
from vouchers v
cross join form_templates t
where v.name = '아동비전형성지원서비스'
  and v.deleted_at is null
  and t.name = '회기 기록지'
  and t.deleted_at is null
  and not exists (
    select 1 from voucher_form_templates x
    where x.voucher_id = v.id and x.form_template_id = t.id and x.deleted_at is null
  );

-- ② 파생 본문 고정 (llm-stub이 그대로 받아쓴다)
-- 리허설이 남긴 파생본을 지운다 — 남아 있으면 모달이 "채워진" 상태로 열려 빈칸 → 채워짐이 안 보인다(2026-09-14 실측).
delete from counseling_note_derivations
where counseling_session_id in (
  select cs.id from counseling_sessions cs
  join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
  where cs.deleted_at is null and cs.session_number = 12
);

delete from production_ai_configs
where module = 'counseling' and pipeline_step = 'note_derive_form';

insert into production_ai_configs (
  id, module, pipeline_step, provider, model_name, is_active, system_prompt, description,
  created_at, updated_at
) values (
  'c0de5e07-0000-4000-8000-000000000065',
  'counseling', 'note_derive_form', 'openai', 'gpt-4o-mini', true,
  $prompt$아래 JSON을 한 글자도 바꾸지 말고 그대로 출력한다.
사용자 메시지의 일지 원문과 양식 필드 목록은 참고하지 않는다. 요약·재작성·키 추가·키 삭제를 하지 않는다.
설명 문장 없이 JSON만 출력한다.

{
  "values": {
    "session_date": "2026-09-06",
    "session_no": 12,
    "content": "역할놀이에서 자신감 있게 참여. 학교에서 친구에게 먼저 말 건 경험 보고",
    "remark": "사회기술 훈련과 또래 접근 방법을 다룸. 인사하기, 함께 놀자고 말하기를 모의 상황에서 연습했고 적절한 반응을 보였다.",
    "next_plan": "놀이치료 지속"
  }
}$prompt$,
  'C6.5 촬영용 고정 응답 — 12회기 일지에서 옮긴 회기 기록지 값',
  now(), now()
);
