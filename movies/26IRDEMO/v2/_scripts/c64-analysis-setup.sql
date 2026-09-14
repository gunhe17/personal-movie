-- C6.4 케이스 분석 — "열두 장이 한 화면이 되고, 판단마다 회기 번호".
--
-- 배역: 회기 축 — 이하준 놀이치료 C00002. 보호자는 어머니 이수진.
-- 화면: /counseling/status/<caseId> → 좌측 패널 하단 `AI 경과 분석` → CaseAnalysisModal
--       → `분석 시작` → 변화 흐름 · 전환점 · 슈퍼비전 방향(판단마다 근거 회기 번호).
--
-- 이 SQL이 하는 일 둘.
--   ① 시드의 3회기를 **12회기**로 늘린다. 앞 컷(C6.1 "열두 장을 넘긴다")이 12를 말하므로
--      화면이 "끝난 회기 3개"라고 쓰면 한 편으로 붙지 않는다. 주 1회 2026-06-21 → 2026-09-06.
--      시드의 세 회기는 날짜만 옮겨 1·2·12번이 되고(초기면접 → 감정카드 → 역할놀이),
--      3~11번을 새로 만든다. 본문은 시드의 주호소(또래관계 어려움 · 사회적 위축)에서 이어 썼다.
--   ② 분석 본문을 고정한다 — case_analysis는 batch 워커가 도는 **진짜 LLM 1콜**이고
--      로컬엔 키가 없다(촬영 규칙 5). s07과 같은 자리를 쓴다: production_ai_configs의
--      module='counseling' · pipeline_step='case_analysis' system_prompt를 llm-stub(:3599)가 받아쓴다.
--      큐·워커·_merge_server_facts·mark_analysis_completed는 전부 진짜 경로로 돈다.
--
-- 멱등: 재실행하면 제가 만든 회기만 지우고 다시 만든다.

do $$
declare
  v_case_id     text;
  v_center_id   text;
  v_client_id   text;
  v_member_id   text;
  v_room_id     text;
  v_sched       text;
  v_sess        text;
  v_base        date := date '2026-06-21';   -- 1회기
  i             int;
  v_topic       text;
  v_mood        text;
  v_inter       text;
  v_prog        text;
  v_home        text;
  v_next        text;
  v_sum         text;
begin
  select cc.id, cc.center_id into v_case_id, v_center_id
  from counseling_cases cc where cc.case_code = 'C00002' and cc.deleted_at is null;
  if v_case_id is null then raise exception 'C00002 케이스가 없다 — 시드부터 확인'; end if;

  select ccp.participant_id into v_client_id
  from counseling_case_participants ccp
  where ccp.counseling_case_id = v_case_id and ccp.participant_type = 'client' limit 1;

  select s.member_id, s.room_id into v_member_id, v_room_id
  from counseling_sessions cs join schedules s on s.id = cs.schedule_id
  where cs.counseling_case_id = v_case_id and cs.deleted_at is null
  order by s.start limit 1;

  -- ── 앞선 실행이 만든 것을 지운다 (memo 표식으로 제 것만 고른다) ────────────
  delete from counseling_notes where counseling_session_id in (
    select cs.id from counseling_sessions cs join schedules s on s.id = cs.schedule_id
    where cs.counseling_case_id = v_case_id and s.memo = 'c64-setup');
  delete from counseling_session_participants where session_id in (
    select cs.id from counseling_sessions cs join schedules s on s.id = cs.schedule_id
    where cs.counseling_case_id = v_case_id and s.memo = 'c64-setup');
  delete from counseling_sessions where id in (
    select cs.id from counseling_sessions cs join schedules s on s.id = cs.schedule_id
    where cs.counseling_case_id = v_case_id and s.memo = 'c64-setup');
  delete from schedules where memo = 'c64-setup';

  -- ── 시드 3회기를 1 · 2 · 12번 자리로 옮긴다 ────────────────────────────────
  -- (초기 면접 → 1회기 06-21 · 감정 인식 → 2회기 06-28 · 사회기술 역할놀이 → 12회기 09-06)
  update schedules s set start = (v_base + 0) + time '10:00', "end" = (v_base + 0) + time '10:50',
         title = 'C00002 - 1회기'
  from counseling_sessions cs
  where cs.schedule_id = s.id and cs.counseling_case_id = v_case_id and cs.session_number = 1;
  update schedules s set start = (v_base + 7) + time '10:00', "end" = (v_base + 7) + time '10:50',
         title = 'C00002 - 2회기'
  from counseling_sessions cs
  where cs.schedule_id = s.id and cs.counseling_case_id = v_case_id and cs.session_number = 2;
  update schedules s set title = 'C00002 - 12회기'
  from counseling_sessions cs
  where cs.schedule_id = s.id and cs.counseling_case_id = v_case_id and cs.session_number = 3;
  update counseling_sessions set session_number = 12
  where counseling_case_id = v_case_id and session_number = 3;
  -- 12회기 날짜를 박는다 — 시드의 3회기는 '지금' 기준 상대 날짜라 재시드한 날에 따라 9/7이 되기도 한다(2026-09-14 실측).
  -- C5.5·C6.5 setup이 `start = 2026-09-06 10:00`으로 이 회기를 찾고, 고정 본문의 날짜도 9/6이다.
  update schedules s set start = date '2026-09-06' + time '10:00', "end" = date '2026-09-06' + time '10:50'
  from counseling_sessions cs
  where cs.schedule_id = s.id and cs.counseling_case_id = v_case_id and cs.session_number = 12;

  -- ── 3~11회기를 만든다 ─────────────────────────────────────────────────────
  for i in 3..11 loop
    select t.topic, t.mood, t.inter, t.prog, t.home, t.nextg, t.summ
      into v_topic, v_mood, v_inter, v_prog, v_home, v_next, v_sum
    from (values
      (3, '감정 표현 확장', '차분함', '감정카드 놀이, 신체 감각 연결',
          '기쁨·슬픔 외에 ‘서운함’을 처음 이름 붙였다. 감정이 몸 어디에서 느껴지는지 손으로 짚었다.',
          '서운했던 일 하나 그려오기', '또래 상황에서의 감정 읽기',
          '감정 어휘가 4개에서 6개로 늘었다. 신체 감각과 감정을 연결하기 시작.'),
      (4, '또래 거부 경험 재구성', '위축 재현', '모래놀이, 투사적 이야기 만들기',
          '모래상자에서 혼자 있는 인형을 가장자리에 두었다. 지난주 학교 체육 시간에 팀에 못 낀 일을 떠올렸다.',
          '없음(정서 부담 고려)', '거부 경험의 대안 서사 만들기',
          '또래 거부 경험이 다시 올라왔다. 위축 행동이 한 주 되돌아갔다.'),
      (5, '대안 서사 만들기', '조심스러움', '이야기 다시 쓰기, 인형극',
          '같은 모래상자 장면에 인형 하나를 더 놓아 ‘같이 앉자고 말하는 장면’을 만들었다. 처음으로 자신이 먼저 말을 거는 역할을 골랐다.',
          '좋아하는 놀이 하나 친구에게 말해보기', '실제 상황에서의 시도 지지',
          '위축 장면을 스스로 다시 썼다. 놀이 안에서 먼저 접근하는 역할을 처음 선택.'),
      (6, '첫 시도와 좌절', '실망, 그러나 표현됨', '감정 반영, 좌절 다루기',
          '친구에게 말을 걸었으나 대답을 못 들었다고 했다. 예전 같으면 말하지 않았을 일을 먼저 꺼냈다.',
          '없음', '좌절 후 회복 경로 만들기',
          '과제 시도 후 좌절. 그러나 좌절 자체를 회기에서 먼저 보고한 것이 변화다.'),
      (7, '전환점 — 스스로 이유를 댔다', '밝음, 적극적', '인지 재구성, 자기 진술 연습',
          '“걔가 나 싫어서가 아니라 못 들은 걸 수도 있어요”라고 스스로 말했다. 상담사가 유도하지 않은 첫 재해석이다. 이후 놀이 참여 속도가 눈에 띄게 빨라졌다.',
          '한 번 더 말 걸어보기', '반복 시도와 성공 경험 누적',
          '내담자가 스스로 대안 해석을 냈다. 이 회기를 기점으로 위축 행동 보고가 줄었다.'),
      (8, '성공 경험 누적', '들뜸', '사회기술 훈련, 강화',
          '두 번째 시도에서 함께 놀았다고 보고했다. 상황을 시간 순서대로 스스로 설명했다.',
          '같이 논 친구 이름 적어오기', '관계 유지 기술',
          '첫 또래 상호작용 성공. 서술이 구체적이고 길어졌다.'),
      (9, '관계 유지 기술', '안정', '역할놀이, 규칙 있는 게임',
          '규칙 있는 보드게임에서 순서를 기다리고 졌을 때 게임을 끝까지 마쳤다. 3회기 때는 중단했던 장면이다.',
          '게임에서 진 날 기분 한 줄 쓰기', '갈등 상황 대처',
          '패배 상황에서 중단 없이 마무리. 좌절 내성이 눈에 띄게 늘었다.'),
      (10, '갈등 상황 대처', '차분함', '역할 바꾸기, 조망 수용',
          '친구와 의견이 갈린 상황을 역할을 바꿔 연기했다. 상대 입장을 한 문장으로 말했다.',
          '다툰 날 있으면 어떻게 풀었는지 적기', '보호자 면담 준비',
          '조망 수용이 나타났다. 갈등을 회피가 아니라 협상으로 다루기 시작.'),
      (11, '보호자 면담 병행', '안정', '보호자 상담, 가정 연계',
          '어머니가 가정에서도 먼저 말을 거는 장면이 늘었다고 보고했다. 아동은 그 이야기를 듣고 웃었다.',
          '없음', '사회기술 일반화 점검',
          '가정에서의 변화가 보호자 보고로 확인됐다. 센터 밖으로 일반화 중.')
    ) as t(n, topic, mood, inter, prog, home, nextg, summ)
    where t.n = i;

    v_sched := gen_random_uuid()::text;
    v_sess  := gen_random_uuid()::text;

    insert into schedules (id, center_id, member_id, room_id, schedule_type, title, start, "end", memo)
    values (v_sched, v_center_id, v_member_id, v_room_id, 'counseling',
            'C00002 - ' || i || '회기',
            (v_base + (i - 1) * 7) + time '10:00', (v_base + (i - 1) * 7) + time '10:50',
            'c64-setup');

    insert into counseling_sessions (id, center_id, counseling_case_id, schedule_id, status, session_number, completed_at)
    values (v_sess, v_center_id, v_case_id, v_sched, 'completed', i,
            (v_base + (i - 1) * 7) + time '10:50');

    insert into counseling_session_participants
      (id, center_id, session_id, participant_id, participant_type, attendance_status, attended_at, is_consumed)
    values
      (gen_random_uuid()::text, v_center_id, v_sess, v_member_id, 'counselor', 'attended',
       (v_base + (i - 1) * 7) + time '10:00', true),
      (gen_random_uuid()::text, v_center_id, v_sess, v_client_id, 'client', 'attended',
       (v_base + (i - 1) * 7) + time '10:00', true);

    insert into counseling_notes (id, center_id, counseling_session_id, client_id, author_id, content, summary)
    values (gen_random_uuid()::text, v_center_id, v_sess, v_client_id, v_member_id,
            jsonb_build_object('main_topic', v_topic, 'mood', v_mood, 'intervention', v_inter,
                               'progress', v_prog, 'homework', v_home, 'next_goal', v_next),
            v_sum);
  end loop;
end $$;

-- 회기가 12개가 됐으니 계약 회기 수도 맞춘다 — 그대로 두면 화면에 `12/8회`가 뜬다.
update counseling_cases set total_sessions = 16
where case_code = 'C00002' and deleted_at is null;

-- 앞선 판이 남긴 분석은 지운다 — 남아 있으면 버튼이 `결과 보기`로 열려 생성 컷이 안 된다.
delete from counseling_case_analyses
where counseling_case_id = (select id from counseling_cases where case_code='C00002' and deleted_at is null);

-- ── 분석 본문 고정 (제품 코드 변경 없음 · 워커 재시작 없음) ───────────────────
delete from production_ai_configs where module='counseling' and pipeline_step='case_analysis';
insert into production_ai_configs (
  id, module, pipeline_step, provider, model_name, is_active, system_prompt, description, created_at, updated_at
) values (
  'c0de5e07-0000-4000-8000-000000000064',
  'counseling', 'case_analysis', 'openai', 'gpt-4o-mini', true,
  $prompt$아래 JSON을 한 글자도 바꾸지 말고 그대로 출력한다.
사용자 메시지의 회기 기록은 참고하지 않는다. 요약·재작성·키 추가·키 삭제를 하지 않는다.
설명 문장 없이 JSON만 출력한다.

{
  "headline": "또래 접근을 회피하던 아동이 스스로 대안 해석을 내놓은 7회기를 기점으로 먼저 다가가기 시작했고, 좌절 뒤 회복이 남은 과제입니다.",
  "current_state": "주호소였던 또래 거부 불안은 회피가 아니라 시도와 회복으로 옮겨 왔습니다. 갈등 상황에서 조망 수용이 나타나고 가정에서도 같은 변화가 보고되고 있습니다.",
  "mood_trend": "up",
  "phases": [
    {"label": "초기 — 관찰과 라포", "from": 1, "to": 3, "focus": "놀이 관찰로 위축 패턴을 확인하고 감정에 이름을 붙이기 시작했습니다.", "mood": "위축, 경계", "trend": "flat", "turning": null},
    {"label": "중기 — 거부 경험을 다시 씁니다", "from": 4, "to": 6, "focus": "또래 거부 경험을 모래놀이와 이야기로 꺼내 대안 장면을 만들고 실제로 시도했습니다.", "mood": "조심스러움", "trend": "flat", "turning": null},
    {"label": "전환 — 스스로 이유를 댑니다", "from": 7, "to": 9, "focus": "상담사가 유도하지 않은 대안 해석이 나온 뒤 시도와 성공이 이어졌습니다.", "mood": "밝아짐", "trend": "up", "turning": "7회기 — 거부를 ‘나를 싫어해서’가 아니라 ‘못 들었을 수도’로 스스로 바꿔 말했습니다."},
    {"label": "현재 — 관계를 유지하는 기술", "from": 10, "to": 12, "focus": "갈등 상황 대처와 가정에서의 일반화를 다루고 있습니다.", "mood": "안정", "trend": "up", "turning": null}
  ],
  "session_track": [
    {"session": 1, "topic": "초기 면접 — 놀이 관찰로 위축 행동 확인", "mood": "위축, 경계", "intervention": "자유놀이 관찰, 라포 형성", "change": "flat", "homework": "done", "turning": null},
    {"session": 2, "topic": "감정 인식 — 감정카드로 기본 감정 구분", "mood": "조금 편안해짐", "intervention": "감정카드 놀이, 감정 명명", "change": "up", "homework": "done", "turning": null},
    {"session": 3, "topic": "감정 표현 확장 — ‘서운함’에 처음 이름을 붙임", "mood": "차분함", "intervention": "감정카드 놀이, 신체 감각 연결", "change": "up", "homework": "partial", "turning": null},
    {"session": 4, "topic": "또래 거부 경험이 모래상자에 다시 올라옴", "mood": "위축 재현", "intervention": "모래놀이, 투사적 이야기 만들기", "change": "down", "homework": null, "turning": "재발 징후"},
    {"session": 5, "topic": "같은 장면을 스스로 다시 씀 — 먼저 말 거는 역할 선택", "mood": "조심스러움", "intervention": "이야기 다시 쓰기, 인형극", "change": "up", "homework": "done", "turning": null},
    {"session": 6, "topic": "첫 시도와 좌절 — 좌절을 먼저 보고함", "mood": "실망, 그러나 표현됨", "intervention": "감정 반영, 좌절 다루기", "change": "flat", "homework": "none", "turning": null},
    {"session": 7, "topic": "스스로 대안 해석을 냄", "mood": "밝음, 적극적", "intervention": "인지 재구성, 자기 진술 연습", "change": "up", "homework": "done", "turning": "전환점"},
    {"session": 8, "topic": "두 번째 시도에서 함께 놀았다고 보고", "mood": "들뜸", "intervention": "사회기술 훈련, 강화", "change": "up", "homework": "done", "turning": null},
    {"session": 9, "topic": "진 게임을 끝까지 마침 — 좌절 내성", "mood": "안정", "intervention": "역할놀이, 규칙 있는 게임", "change": "up", "homework": "done", "turning": null},
    {"session": 10, "topic": "갈등 상황을 역할 바꿔 연기 — 조망 수용", "mood": "차분함", "intervention": "역할 바꾸기, 조망 수용", "change": "up", "homework": "partial", "turning": null},
    {"session": 11, "topic": "보호자 면담 — 가정에서의 변화 확인", "mood": "안정", "intervention": "보호자 상담, 가정 연계", "change": "up", "homework": null, "turning": null},
    {"session": 12, "topic": "사회기술 역할놀이 — 인사하기·같이 놀자고 말하기", "mood": "밝아짐, 적극적", "intervention": "역할놀이, 모델링, 사회기술 훈련", "change": "up", "homework": "done", "turning": null}
  ],
  "themes": {
    "recurring": [
      {"name": "또래에게 먼저 다가가는 일", "sessions": [1, 4, 5, 6, 7, 8, 12], "note": "회피에서 시도로, 시도에서 성공으로 옮겨 왔습니다."},
      {"name": "거부당할 것에 대한 예상", "sessions": [4, 6, 7], "note": "7회기에서 아동이 스스로 다른 해석을 내놓으며 힘이 빠졌습니다."}
    ],
    "emerging": [
      {"name": "갈등을 협상으로 푸는 것", "sessions": [9, 10], "note": "회피하거나 중단하지 않고 끝까지 머무는 장면이 늘었습니다."},
      {"name": "가정에서의 일반화", "sessions": [11], "note": "보호자 보고로 센터 밖 변화가 처음 확인됐습니다."}
    ],
    "resolved": [
      {"name": "감정을 이름 붙이지 못하던 것", "sessions": [2, 3], "note": "기본 감정 넷에서 여섯으로 늘고 신체 감각과 연결됐습니다."}
    ]
  },
  "interventions": [
    {"name": "역할놀이", "count": 4, "sessions": [5, 9, 10, 12], "response": "역할을 스스로 고르고 끝까지 참여했습니다.", "effect": "높음", "evidence": "먼저 말 거는 역할을 처음 선택한 뒤 실제 시도가 이어졌습니다."},
    {"name": "감정카드·감정 명명", "count": 2, "sessions": [2, 3], "response": "새 감정 어휘를 스스로 꺼냈습니다.", "effect": "높음", "evidence": "‘서운함’처럼 상담사가 주지 않은 단어가 나왔습니다."},
    {"name": "모래놀이·투사적 이야기", "count": 2, "sessions": [4, 5], "response": "말로 못 꺼낸 거부 경험이 장면으로 나왔습니다.", "effect": "보통", "evidence": "같은 장면을 다음 회기에 스스로 고쳐 놓았습니다."},
    {"name": "인지 재구성", "count": 1, "sessions": [7], "response": "유도 없이 대안 해석을 냈습니다.", "effect": "높음", "evidence": "이 회기 뒤로 위축 행동 보고가 줄었습니다."}
  ],
  "alliance": {"engagement": "높음", "evidence": "좌절한 일을 먼저 꺼내 말하고, 과제를 해 오지 못한 주에도 그 사실을 스스로 보고했습니다."},
  "risks": [
    {"text": "이하준은 시도가 한 번 어긋나면 다음 한 주 동안 위축 행동이 되돌아오는 패턴이 있습니다.", "sessions": [4, 6]},
    {"text": "성공 경험이 또래 한 명에게 몰려 있어, 그 관계가 흔들릴 때를 대비한 연습이 아직 없습니다.", "sessions": [8, 9]}
  ],
  "strengths": [
    {"text": "이하준이 상담사의 유도 없이 스스로 다른 해석을 내놓았습니다.", "sessions": [7]},
    {"text": "진 게임을 중단하지 않고 끝까지 마쳤습니다.", "sessions": [9]},
    {"text": "어머니가 가정에서 먼저 말을 거는 장면을 관찰해 전해 주셨습니다.", "sessions": [11]}
  ],
  "direction": {
    "goals": ["또래가 한 명이 아닌 상황에서의 접근 연습", "시도가 어긋난 다음 주의 회복 절차 만들기"],
    "approaches": ["집단 놀이 상황 역할놀이", "좌절 직후 쓰는 짧은 자기 진술 카드"],
    "closing": "종결을 논의하기에는 이릅니다. 변화의 축인 또래 접근이 아직 한 관계에 기대고 있어, 관계가 흔들렸을 때의 회복이 확인되어야 합니다. 다만 방향은 분명하므로 간격을 2주로 늘려 일반화를 보는 방안을 고려할 수 있습니다.",
    "supervision": ["7회기의 재해석이 치료적 개입의 결과인지, 학교 환경의 우연한 변화인지 어떻게 구분할까요?", "성공 경험이 한 또래에게 집중된 상태에서 일반화를 어떻게 설계할까요?"]
  }
}$prompt$,
  'C6.4 촬영용 — 케이스 경과 분석 본문 고정(결정론). 촬영이 끝나면 이 행을 지운다.',
  now(), now()
);

-- ── 확인 ────────────────────────────────────────────────────────────────────
select cc.id as case_id, count(*) as sessions, count(*) filter (where cs.status='completed') as completed
from counseling_cases cc join counseling_sessions cs on cs.counseling_case_id = cc.id and cs.deleted_at is null
where cc.case_code = 'C00002' group by cc.id;
