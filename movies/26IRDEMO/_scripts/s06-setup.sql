-- s06 준비 — 이하준 회기 필드노트에 전사(화자 분리)를 넣는다.
-- 시드는 필드노트를 status=completed로 만들지만 전사는 비어 있어 화면이 "전사 데이터가 없어요."다.
-- 웹이 읽는 우선순위: refined_transcript > audios[0].diarized_transcript > 청크 transcript
--   (view-model.ts:140) · 형식은 {speaker, text, start} 배열.
-- 내용은 시드 요약("행동 활성화 계획 수립. 주 3회 운동 시작 합의.")과 앞뒤가 맞는 놀이치료 회기 대화다.
update field_notes
set refined_transcript = $json$[
  {"speaker":"상담사","text":"하준아, 지난주에 이야기했던 거 기억나? 학교에서 친구한테 인사해 보기로 했잖아.","start":12},
  {"speaker":"내담자","text":"네... 두 번 했어요. 근데 한 번은 못 들었나 봐요.","start":21},
  {"speaker":"상담사","text":"두 번이나 했구나. 못 들었을 때는 기분이 어땠어?","start":30},
  {"speaker":"내담자","text":"좀 창피했어요. 그냥 지나갔어요.","start":38},
  {"speaker":"상담사","text":"창피했구나. 그런데도 한 번 더 해본 건 정말 대단한 거야.","start":46},
  {"speaker":"내담자","text":"선생님, 오늘도 그 인형놀이 해요?","start":58},
  {"speaker":"상담사","text":"그럼. 오늘은 하준이가 먼저 말을 거는 역할을 해볼까?","start":64},
  {"speaker":"내담자","text":"제가요? ... 해볼게요.","start":73},
  {"speaker":"상담사","text":"좋아. 그리고 몸을 움직이면 기분이 나아지기도 하거든. 이번 주에 뭘 해보면 좋을까?","start":180},
  {"speaker":"내담자","text":"음... 축구요. 아빠랑은 못 하니까 혼자 공 차기라도.","start":191},
  {"speaker":"상담사","text":"좋다. 그럼 일주일에 세 번, 공 차기부터 시작해 볼까?","start":201},
  {"speaker":"내담자","text":"네. 세 번은 할 수 있을 것 같아요.","start":210}
]$json$,
    diarization_status = 'completed',
    refine_status = 'completed',
    transcribe_status = 'completed'
where deleted_at is null
  and schedule_id in (
    select s.id from schedules s
    join counseling_sessions cs on cs.schedule_id = s.id and cs.deleted_at is null
    join counseling_cases cc on cc.id = cs.counseling_case_id and cc.case_code = 'C00002'
  );
