// ============================================================
// AI 상담 경과 분석 리포트 — Lab 목업 (mock only)
// ============================================================
//
// ⚠️ 2026-08-31 개정 — 첫 목업이 낙관적이어서 실제 일지 스키마에 맞춰 다시 썼다.
//
// 실제로 회기 하나에서 나올 수 있는 데이터 (코드 확인):
//
//  A) 상담사가 직접 쓴 일지 — `InlineJournalEditor`가 저장하는 건 딱 4개다
//     · main_topic  (화면 라벨 "상담 목표")   free text 3000자
//     · progress    (화면 라벨 "진행 내용")   free text 5000자
//     · next_goal   (화면 라벨 "다음 상담 내용") free text 3000자
//     · private_notes (개인 메모) — 작성자만 열람. **분석 입력에서 제외**
//       (executor의 structured_keys에 없다. 넣으면 안 된다.)
//     → mood · intervention · homework 는 **입력 수단 자체가 없다.**
//
//  B) 녹음(필드노트) → AI 일지 생성 — 서식별로 필드가 다르다
//     · default       mood · main_topic · intervention[] · progress · homework · next_goal · raw_notes
//     · soap          subjective · objective · assessment · plan
//     · dap           data · assessment · plan
//     · birp          behavior · intervention · response · plan
//     · family_center presenting_problem · family_dynamics · intervention · outcome · follow_up
//     (`app/runtime/field_note/counseling_note/prompt.py`)
//
//  C) 구조화 데이터 (일지와 무관하게 항상 있다)
//     · 회기 번호 · 날짜 · 완료 여부 · 출석 상태(attended/absent/no_show)
//     · 케이스 주호소(chief_complaint) · 계획 회기 수 · 프로그램 · 담당자
//
// 그래서 리포트는 **고정 라벨이 아니라 가용 데이터로 결정되는 조건부 구조**여야 한다.
// 이 파일은 같은 케이스를 세 시나리오로 만들어 그 차이를 보여준다:
//   recorded — 12회기 전부 녹음 기반 일지 (가장 풍부)
//   mixed    — 9회기 손 작성 + 3회기 녹음
//   manual   — 12회기 전부 손 작성 (현실에서 가장 흔할 형태)
//
// manual/mixed는 recorded에서 **없는 필드를 걷어내어 파생**한다. 손으로 다시 쓰지
// 않는 이유는, 걷어내는 규칙 자체가 곧 프론트의 조건부 렌더링 규칙이기 때문이다.

export type Trend = 'up' | 'flat' | 'down'
export type Attendance = 'attended' | 'absent' | 'no_show'
/** 그 회기 일지가 어디서 왔나 — 표에 채울 수 있는 칸이 여기서 갈린다 */
export type NoteSource = 'manual' | 'ai' | 'none'

export interface SessionRow {
  no: number
  date: string
  attendance: Attendance
  noteSource: NoteSource
  /** main_topic — 손 작성 라벨은 "상담 목표"라 주제라기보다 목표에 가깝다 */
  topic: string | null
  /** mood — 녹음 기반(default/birp 서식)에서만 나온다 */
  mood: string | null
  /** intervention[] — 녹음 기반에서만 */
  intervention: string | null
  /** progress 텍스트를 LLM이 읽고 판정. 근거가 약하면 null */
  change: Trend | null
  /** homework — 녹음 기반에서만 */
  homework: 'done' | 'partial' | 'none' | null
  turning?: string
}

export interface Phase {
  label: string
  range: string
  /** 국면이 덮는 회기 구간 — 플로우시트 밴드·가로 스트립의 폭을 이 값으로 잡는다 */
  from: number
  to: number
  focus: string
  /** 정서 기록이 없으면 null — 국면 카드에서 그 줄만 빠진다 */
  mood: string | null
  trend: Trend | null
  turning: string | null
}

export interface Theme {
  name: string
  sessions: number[]
  note: string
}

export interface Intervention {
  name: string
  count: number
  sessions: number[]
  response: string
  effect: '높음' | '보통' | '낮음' | '판단 어려움'
  evidence: string
}

export interface Factor {
  text: string
  sessions: number[]
}

/** 리포트가 무엇을 읽었는지 — 사라진 섹션이 왜 없는지 설명하는 짝 */
export interface Coverage {
  completedSessions: number
  noteCount: number
  manualNotes: number
  aiNotes: number
  /** 정서·개입이 기록된 회기 수 */
  moodNotes: number
  interventionNotes: number
}

export interface CaseReport {
  scenarioKey: string
  clientName: string
  chiefComplaint: string
  currentState: string
  headline: string
  programName: string
  period: string
  completed: number
  planned: number
  attendanceRate: number
  engagement: string
  alliance: string
  moodTrend: Trend | null
  moodTrendLabel: string | null
  phases: Phase[]
  sessionTrack: SessionRow[]
  themes: { recurring: Theme[]; emerging: Theme[]; resolved: Theme[] }
  interventions: Intervention[]
  risks: Factor[]
  strengths: Factor[]
  direction: {
    goals: string[]
    approaches: string[]
    closing: string
    supervision: string[]
  }
  coverage: Coverage
  meta: { createdAt: string; model: string }
}

// ── 기준 시나리오: 12회기 전부 녹음 기반 일지 ──────────────────────────

const RECORDED: CaseReport = {
  scenarioKey: 'recorded',
  clientName: '김하은',
  chiefComplaint: '시험 불안과 등교 거부 (중2, 3주간 결석 후 내방)',
  currentState: '주 3~4일 등교 유지, 불안은 시험 주간에만 국소적으로 상승',
  headline:
    '“못 가겠다”고 피하던 아이가 12회기를 지나며 “불안해도 일단 가본다”로 바뀌었어요. 등교는 안정된 편이지만, 시험 주간마다 다시 힘들어지는 것과 또래를 피하는 건 아직 남아 있어요.',
  programName: '청소년 개인상담 (16회기)',
  period: '2026.03.14 ~ 2026.08.22',
  completed: 12,
  planned: 16,
  attendanceRate: 92,
  engagement: '높음',
  alliance:
    '초기 3회기 이후로는 빠진 적이 없어요. 내준 과제도 10번 중 8번 해왔고, 7회기부터는 먼저 이야기를 꺼내는 일이 늘었어요.',
  moodTrend: 'up',
  moodTrendLabel: '호전',

  phases: [
    {
      label: '초기',
      range: '1~4회기',
      from: 1,
      to: 4,
      focus: '서로 익숙해지기 · 불안이 언제 심해지는지 살펴보기',
      mood: '움츠러들고 말수가 적었어요',
      trend: 'flat',
      turning: null
    },
    {
      label: '중기',
      range: '5~9회기',
      from: 5,
      to: 9,
      focus: '생각 바꿔보기 · 조금씩 등교 시도 · 어머니 상담 병행',
      mood: '시도할 땐 불안했다가 하고 나면 안심하는 식으로 오르내렸어요',
      trend: 'up',
      turning:
        '7회기 — 3주 만에 처음으로 등교했고, 그 뒤로 말이 훨씬 많아졌어요'
    },
    {
      label: '현재',
      range: '10~12회기',
      from: 10,
      to: 12,
      focus: '또래 관계 · 시험 때 버티는 법 · 다시 힘들어질 때 대비',
      mood: '대체로 안정적이고, 시험 주간에만 잠깐 올라와요',
      trend: 'up',
      turning: '11회기 — 중간고사를 앞두고 불안이 다시 올라왔어요'
    }
  ],

  sessionTrack: [
    {
      no: 1,
      date: '03.14',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '내방 경위 · 등교 거부 경과',
      mood: '위축',
      intervention: '라포 형성',
      change: 'flat',
      homework: null
    },
    {
      no: 2,
      date: '03.21',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '가족 관계 · 학업 압박',
      mood: '불안',
      intervention: '탐색적 면담',
      change: 'flat',
      homework: 'none'
    },
    {
      no: 3,
      date: '03.28',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '불안 신체 반응 인식',
      mood: '불안',
      intervention: '심리교육',
      change: 'flat',
      homework: 'partial'
    },
    {
      no: 4,
      date: '04.11',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '자동적 사고 찾기',
      mood: '위축',
      intervention: '인지 재구성',
      change: 'up',
      homework: 'done'
    },
    {
      no: 5,
      date: '04.18',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '등교 상상 노출',
      mood: '긴장',
      intervention: '단계적 노출',
      change: 'flat',
      homework: 'done'
    },
    {
      no: 6,
      date: '04.25',
      attendance: 'no_show',
      noteSource: 'none',
      topic: null,
      mood: null,
      intervention: null,
      change: null,
      homework: null
    },
    {
      no: 7,
      date: '05.09',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '첫 등교 경험 정리',
      mood: '안도 · 성취',
      intervention: '단계적 노출 · 강화',
      change: 'up',
      homework: 'done',
      turning: '전환점'
    },
    {
      no: 8,
      date: '05.23',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '어머니 태도 변화 · 가정 규칙',
      mood: '안정',
      intervention: '보호자 상담 연계',
      change: 'up',
      homework: 'done'
    },
    {
      no: 9,
      date: '06.13',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '또래 대화 시도',
      mood: '긴장 · 기대',
      intervention: '사회기술 훈련',
      change: 'up',
      homework: 'partial'
    },
    {
      no: 10,
      date: '07.04',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '방학 중 생활 리듬',
      mood: '안정',
      intervention: '행동 활성화',
      change: 'flat',
      homework: 'done'
    },
    {
      no: 11,
      date: '08.08',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '중간고사 불안 재상승',
      mood: '불안 상승',
      intervention: '이완 훈련 · 대처 카드',
      change: 'down',
      homework: 'done',
      turning: '재발 징후'
    },
    {
      no: 12,
      date: '08.22',
      attendance: 'attended',
      noteSource: 'ai',
      topic: '시험 후 회고 · 재발 방지',
      mood: '안정',
      intervention: '재발 방지 계획',
      change: 'up',
      homework: 'done'
    }
  ],

  themes: {
    recurring: [
      {
        name: '시험·성적 압박',
        sessions: [2, 3, 4, 11, 12],
        note: '처음부터 끝까지 계속 나와요. 강도는 줄었지만 없어지진 않았어요'
      },
      {
        name: '어머니의 기대와 갈등',
        sessions: [2, 5, 8],
        note: '8회기 어머니 상담 뒤로 덜 꺼내요'
      },
      {
        name: '신체 증상(복통·두통)',
        sessions: [1, 3, 5, 11],
        note: '학교 가기 직전에 나타나는 패턴이 일정해요'
      }
    ],
    emerging: [
      {
        name: '또래 관계 회피',
        sessions: [9, 10, 12],
        note: '등교가 안정되니 새로 드러났어요 — 다음에 다뤄볼 만해요'
      },
      {
        name: '진로·고등학교 선택',
        sessions: [12],
        note: '12회기에 처음 스스로 꺼냈어요'
      }
    ],
    resolved: [
      {
        name: '등교 자체에 대한 공포',
        sessions: [1, 4, 5, 7],
        note: '7회기 뒤로는 이야기에 나오지 않아요'
      }
    ]
  },

  interventions: [
    {
      name: '인지 재구성',
      count: 5,
      sessions: [4, 5, 7, 11, 12],
      response: '생각 기록지를 스스로 써 왔어요',
      effect: '높음',
      evidence:
        '4회기 뒤로 “못 할 것 같아요”가 “해보고 나서 생각할게요”로 바뀌었어요(7·12회기 일지)'
    },
    {
      name: '단계적 노출',
      count: 4,
      sessions: [5, 6, 7, 9],
      response: '처음엔 거부했는데 7회기에 실제로 등교했어요',
      effect: '높음',
      evidence: '6회기에 안 온 뒤 목표를 낮춰 잡았더니 7회기에 성공했어요'
    },
    {
      name: '이완 훈련',
      count: 3,
      sessions: [3, 11, 12],
      response: '집에서는 잘 안 해요',
      effect: '보통',
      evidence:
        '11회기에 “해보긴 했는데 잘 안 됐어요”라고 했어요 — 정작 시험 주간엔 못 썼어요'
    },
    {
      name: '보호자 상담 연계',
      count: 2,
      sessions: [8, 10],
      response: '어머니가 달라졌다고 아이가 말했어요',
      effect: '높음',
      evidence: '8회기 뒤로 집에서 학교 가라는 말이 줄었대요'
    },
    {
      name: '사회기술 훈련',
      count: 1,
      sessions: [9],
      response: '연습은 했지만 실제로 해봤다는 말은 아직 없어요',
      effect: '판단 어려움',
      evidence: '한 번밖에 안 해봐서 통했는지 알기 어려워요'
    }
  ],

  risks: [
    {
      text: '시험 기간마다 불안과 배앓이가 다시 올라와요 — 11회기에 등교 일수가 또 줄었어요',
      sessions: [11]
    },
    {
      text: '집에서 이완 연습을 거의 안 해서, 상담실 밖에서 쓸 수 있는 방법이 아직 부족해요',
      sessions: [11, 12]
    }
  ],
  strengths: [
    {
      text: '내준 과제를 10번 중 8번 해왔어요 — 배운 걸 생활로 옮기는 힘이 있어요',
      sessions: [4, 7, 8, 10, 12]
    },
    {
      text: '어머니가 상담에 응하고 태도를 바꿨어요 — 집에서 도와줄 사람이 생긴 셈이에요',
      sessions: [8]
    },
    {
      text: '자기 상태를 구분해서 말해요(“긴장”과 “불안”을 나눠서 표현)',
      sessions: [7, 12]
    }
  ],

  direction: {
    goals: [
      '이제 또래 관계를 주로 다루기 — 어떤 상황이 제일 어려운지 순서대로 적어보기',
      '시험 때 쓰는 대처 카드를 실제로 써보게 하기 (쓴 날 기록해오기)',
      '고등학교 이야기를 통해 앞일을 함께 그려보기'
    ],
    approaches: [
      '또래 대화 연습은 한 번으로 끝내지 말고 3회기 이상 이어서 해보기 — 그래야 통하는지 알 수 있어요',
      '이완 연습은 잘 안 하니 짧은 호흡법으로 줄여서 다시 해보기',
      '종결 전에 어머니 상담을 한 번 더 잡아 대비 계획을 같이 나누기'
    ],
    closing:
      '16회기 중 12회기를 마쳤어요. 처음 문제였던 등교 거부는 목표만큼 좋아졌는데, 또래 관계라는 새 이야기가 올라와서 남은 4회기를 종결 준비에 쓸지 새 주제에 쓸지 갈립니다. 일단 종결로 두되, 13회기에서 더 이어갈지 아이·어머니와 같이 정하는 걸 권해요.',
    supervision: [
      '처음 문제가 풀린 뒤 새로 올라온 또래 관계를, 이 케이스에서 계속 볼지 새로 계약할지?',
      '11회기에 다시 힘들어진 걸 자연스러운 기복으로 볼지, 준비가 부족했던 걸로 볼지 — 무엇을 근거로 판단할지?'
    ]
  },

  coverage: {
    completedSessions: 12,
    noteCount: 11,
    manualNotes: 0,
    aiNotes: 11,
    moodNotes: 11,
    interventionNotes: 11
  },
  meta: { createdAt: '2026.08.31 14:20', model: 'claude-sonnet-4' }
}

// ── 파생 규칙 = 프론트의 조건부 렌더링 규칙 ─────────────────────────────
//
// 손 작성 일지에는 mood·intervention·homework 칸이 아예 없다. 그러면 리포트에서
// 무엇이 사라져야 하는지를 여기서 그대로 흉내 낸다.
//   · 표의 정서·개입·과제 칸 → null (값 있는 회기가 0이면 컬럼 자체가 사라진다)
//   · 개입-반응 표 → [] (섹션 통째로 사라진다)
//   · 정서 추세 지표 → null (지표 칸이 4개에서 3개로 줄어든다)
//   · 국면 카드의 정서 줄 → null
//   · 근거를 정서·개입에 걸었던 위험/강점 항목 → 다른 근거로 바뀌거나 빠진다

function toManualRow(s: SessionRow): SessionRow {
  if (s.noteSource === 'none') return s
  return {
    ...s,
    noteSource: 'manual',
    mood: null,
    intervention: null,
    homework: null
    // topic(main_topic)·change(progress 텍스트 판정)는 손 작성에도 남는다
  }
}

const MANUAL: CaseReport = {
  ...RECORDED,
  scenarioKey: 'manual',
  headline:
    '“못 하겠어요”라던 말이 4회기부터 “해볼게요”로 바뀌었고, 7회기 뒤로는 등교 이야기가 일지에서 사라졌어요. 다만 일지에 기분·쓴 방법이 없어서 무엇이 그 변화를 만들었는지는 이 리포트로 알 수 없어요.',
  moodTrend: null,
  moodTrendLabel: null,
  alliance:
    '12회 중 1번 빠져 출석률 92%예요. 일지에 참여 모습이나 과제 기록이 없어서 출석 말고는 볼 근거가 없어요.',
  phases: RECORDED.phases.map((p) => ({ ...p, mood: null, trend: null })),
  sessionTrack: RECORDED.sessionTrack.map(toManualRow),
  interventions: [],
  risks: [
    {
      text: '11회기 진행 내용에 “시험 때문에 못 갔어요”가 다시 나와요 — 초기와 같은 패턴으로 보여요',
      sessions: [11]
    }
  ],
  strengths: [
    {
      text: '다음 상담 내용에 적어둔 계획이 실제로 다음 회기에 다뤄진 편이에요',
      sessions: [4, 7, 8, 12]
    }
  ],
  direction: {
    ...RECORDED.direction,
    approaches: [
      '기분과 쓴 방법이 일지에 안 남아서 무엇이 통했는지 볼 수 없어요 — 회기를 녹음하거나 진행 내용에 쓴 방법을 한 줄만 적어두면, 다음 분석부터는 그 부분도 나와요'
    ],
    supervision: [
      '처음 문제가 풀린 뒤 새로 올라온 또래 관계를, 이 케이스에서 계속 볼지 새로 계약할지?'
    ]
  },
  coverage: {
    completedSessions: 12,
    noteCount: 11,
    manualNotes: 11,
    aiNotes: 0,
    moodNotes: 0,
    interventionNotes: 0
  }
}

const RECORDED_SESSIONS = [7, 11, 12]

const MIXED: CaseReport = {
  ...RECORDED,
  scenarioKey: 'mixed',
  headline:
    '피하던 데서 해보는 쪽으로 옮겨가는 흐름이 진행 내용에 꾸준히 보여요. 녹음이 붙은 3개 회기(7·11·12)에서는 무엇이 그 변화를 만들었는지까지 보입니다.',
  moodTrend: 'up',
  moodTrendLabel: '호전',
  alliance:
    '출석률 92%. 녹음이 있는 3회기에서 과제를 해온 게 확인되고, 7회기부터 먼저 이야기를 꺼내는 일이 늘었어요.',
  phases: RECORDED.phases.map((p, i) =>
    i === 0 ? { ...p, mood: null, trend: null } : p
  ),
  sessionTrack: RECORDED.sessionTrack.map((s) =>
    RECORDED_SESSIONS.includes(s.no) ? s : toManualRow(s)
  ),
  interventions: [
    {
      name: '단계적 노출',
      count: 1,
      sessions: [7],
      response: '3주 만에 처음 학교에 갔어요',
      effect: '높음',
      evidence: '7회기 녹음 — 난이도를 낮춘 계획을 세운 그 주에 등교 성공'
    },
    {
      name: '이완 훈련',
      count: 2,
      sessions: [11, 12],
      response: '집에서는 잘 안 해요',
      effect: '보통',
      evidence: '11회기 “해보긴 했는데 잘 안 됐다”'
    },
    {
      name: '재발 방지 계획',
      count: 1,
      sessions: [12],
      response: '다시 힘들어질 때의 신호를 스스로 적어봤어요',
      effect: '판단 어려움',
      evidence: '한 번밖에 안 해봐서 통했는지 알기 어려워요'
    }
  ],
  risks: [
    {
      text: '시험 기간마다 불안과 배앓이가 다시 올라와요 — 11회기에 등교 일수가 또 줄었어요',
      sessions: [11]
    },
    {
      text: '집에서 이완 연습을 거의 안 해서, 상담실 밖에서 쓸 수 있는 방법이 아직 부족해요',
      sessions: [11, 12]
    }
  ],
  strengths: [
    {
      text: '자기 상태를 구분해서 말해요(“긴장”과 “불안”을 나눠서 표현)',
      sessions: [7, 12]
    },
    {
      text: '다음 상담 내용에 적힌 계획이 다음 회기에 실제로 다뤄진 비율이 높다',
      sessions: [4, 7, 8, 12]
    }
  ],
  direction: {
    ...RECORDED.direction,
    approaches: [
      '또래 대화 연습은 한 번으로 끝내지 말고 3회기 이상 이어서 해보기 — 그래야 통하는지 알 수 있어요',
      '이완 연습은 잘 안 하니 짧은 호흡법으로 줄여서 다시 해보기',
      '어떤 방법이 통하는지 계속 보려면 지금처럼 녹음을 유지하는 게 좋아요 — 녹음이 없는 회기는 근거가 안 남아요'
    ]
  },
  coverage: {
    completedSessions: 12,
    noteCount: 11,
    manualNotes: 8,
    aiNotes: 3,
    moodNotes: 3,
    interventionNotes: 3
  }
}

export interface Scenario {
  key: string
  label: string
  desc: string
  report: CaseReport
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'manual',
    label: '손 작성만 (12회기)',
    desc: '상담사가 직접 쓴 일지만 — 상담 목표 · 진행 내용 · 다음 상담 내용 3필드',
    report: MANUAL
  },
  {
    key: 'mixed',
    label: '손 작성 9 + 녹음 3',
    desc: '일부 회기만 필드노트 녹음 → AI 일지. 정서·개입은 그 3회기에만 있다',
    report: MIXED
  },
  {
    key: 'recorded',
    label: '전 회기 녹음 (12회기)',
    desc: '모든 회기가 녹음 기반 AI 일지 — default 서식 7필드가 전부 채워진 경우',
    report: RECORDED
  }
]

// ── 진행 단계 (분석 중 화면) ──
// 백엔드 executor의 실제 순서와 맞춘 라벨 — 데이터 로드 → 프롬프트 조립 → LLM → 저장.
export const RUN_STEPS = [
  {
    key: 'collect',
    label: '회기 일지 수집',
    detail: '완료 회기와 상담일지·출석·필드노트 요약을 시간순으로 모아요'
  },
  {
    key: 'build',
    label: '경과 정리',
    detail: '회기별 기록을 국면·주제·개입 축으로 배열해요'
  },
  {
    key: 'analyze',
    label: 'AI 분석',
    detail: '변화 흐름과 개입 효과를 판단하고 근거 회기를 표시해요'
  },
  { key: 'save', label: '리포트 작성', detail: '표와 요약으로 정리해 저장해요' }
] as const

// ── 목업 → 프로덕션 VM 어댑터 ───────────────────────────────────────────
//
// 랩은 프로덕션 컴포넌트를 **그대로 렌더한다**. 예전엔 같은 컴포넌트를 랩에 복제해
// 뒀는데, 프로덕션을 고칠 때마다 갈라져 랩이 거짓말을 했다(레일 노출 기준·판단
// 블록 스트립·지표 중복이 실제로 어긋났다). 복제를 없애고 이 어댑터 하나만 둔다 —
// 랩에 남는 건 "무슨 데이터를 먹이나"뿐이고, "어떻게 보이나"는 프로덕션이 소유한다.

import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

export function toReportVM(r: CaseReport): CaseReportVM {
  return {
    // 목업은 아직 개인 케이스 하나만 담는다 — 케이스 표시명은 프로그램명이 대신하고,
    // 상담 코드는 없다(프로덕션은 caseDetail.case_code를 쓴다).
    caseTitle: r.programName,
    caseCode: '',
    clientNames: [r.clientName],
    isGroup: false,
    clientCount: 1,
    chiefComplaint: r.chiefComplaint,
    period: r.period,
    planned: r.planned,
    headline: r.headline,
    currentState: r.currentState,
    moodTrend: r.moodTrend,
    engagement: r.engagement,
    alliance: r.alliance,
    phases: r.phases.map((p) => ({
      label: p.label,
      range: p.range,
      from: p.from,
      to: p.to,
      focus: p.focus,
      mood: p.mood,
      trend: p.trend,
      turning: p.turning
    })),
    sessionTrack: r.sessionTrack.map((s) => ({
      session: s.no,
      date: s.date,
      attendance: s.attendance,
      attendedCount: null,
      participantCount: null,
      noteSource: s.noteSource,
      topic: s.topic,
      mood: s.mood,
      intervention: s.intervention,
      change: s.change,
      homework: s.homework,
      turning: s.turning ?? null
    })),
    themes: {
      recurring: r.themes.recurring.map((t) => ({ ...t })),
      emerging: r.themes.emerging.map((t) => ({ ...t })),
      resolved: r.themes.resolved.map((t) => ({ ...t }))
    },
    interventions: r.interventions.map((i) => ({ ...i })),
    risks: r.risks.map((f) => ({ ...f })),
    strengths: r.strengths.map((f) => ({ ...f })),
    direction: { ...r.direction },
    coverage: {
      completedSessions: r.coverage.completedSessions,
      analyzedSessions: r.coverage.completedSessions,
      noteCount: r.coverage.noteCount,
      manualNotes: r.coverage.manualNotes,
      aiNotes: r.coverage.aiNotes,
      moodNotes: r.coverage.moodNotes,
      interventionNotes: r.coverage.interventionNotes,
      attendanceRate: r.attendanceRate,
      truncatedNotes: 0,
      perSessionChars: null
    },
    createdAt: r.meta.createdAt,
    isLegacy: false
  }
}
