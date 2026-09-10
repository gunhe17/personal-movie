/**
 * 활동 요약 — 표시용 예시 데이터 (피그마 913:5939).
 *
 * ⚠️ 대응 API가 아직 없다. 발달 지표·특성 키워드·연습 활동은 모두 서버 계약이
 *    없는 상태라 이 모듈이 시안 값을 그대로 들고 있다. 실제 아이의 데이터가 아니며,
 *    화면에도 예시임을 고지한다(ActivitySummary 하단 안내문 §7-2 판정 금지).
 *    API가 생기면 이 파일의 상수만 쿼리 결과로 바꾸면 된다 — 타입은 그대로 쓴다.
 */
import { COLORS } from '@/shared/constants/theme';

/** 발달 지표 한 축 — value·compare 모두 0~1 정규화 */
export interface DevelopmentAxis {
  key: string;
  label: string;
  /** 이번 값 (0~1) */
  value: number;
  /** 지난 회차 값 (0~1) — 없으면 비교 폴리곤을 안 그린다 */
  compare: number | null;
  /** 축 점 색 — tag/* 팔레트 */
  color: string;
}

/** 시계 방향 위→우상→우하→아래→좌하→좌상 순서로 그린다 */
export const DEVELOPMENT_AXES: DevelopmentAxis[] = [
  {
    key: 'emotion',
    label: '정서안정',
    value: 0.72,
    compare: 0.78,
    color: COLORS.tag.teal.fg,
  },
  {
    key: 'attention',
    label: '주의집중',
    value: 0.54,
    compare: 0.5,
    color: COLORS.tag.blue.fg,
  },
  {
    key: 'social',
    label: '사회성',
    value: 0.32,
    compare: 0.4,
    color: COLORS.tag.orange.fg,
  },
  {
    key: 'language',
    label: '언어·인지',
    value: 0.23,
    compare: 0.31,
    color: COLORS.tag.green.fg,
  },
  {
    key: 'regulation',
    label: '자기조절',
    value: 0.71,
    compare: 0.6,
    color: COLORS.tag.pink.fg,
  },
  {
    key: 'stress',
    label: '스트레스',
    value: 0.38,
    compare: 0.46,
    color: COLORS.tag.red.fg,
  },
];

/** 지표 요약 문장 — 강조(액센트) 구간과 일반 구간을 번갈아 넣는다 */
export const DEVELOPMENT_HEADLINE: { text: string; accent: boolean }[] = [
  { text: '자기조절', accent: true },
  { text: '은 안정적이며,\n', accent: false },
  { text: '언어·인지·사회성', accent: true },
  { text: '은 성장이 필요해요.', accent: false },
];

/** 특성 키워드 버블 — 좌표·지름은 시안(928:7742) 클라우드 배치 그대로 */
export interface TraitBubble {
  key: string;
  label: string;
  size: number;
  x: number;
  y: number;
  /** 버블 색 — 지표 축이 아닌 콘텐츠 팔레트라 시안 고정값(토큰 아님) */
  color: string;
}

export const TRAIT_CLOUD_SIZE = { width: 207.5, height: 188 };

export const TRAIT_BUBBLES: TraitBubble[] = [
  { key: 'impulse', label: '충동성', size: 120, x: 0, y: 0, color: '#FF6B6B' },
  {
    key: 'sensory',
    label: '감각 예민',
    size: 79,
    x: 128.5,
    y: 13,
    color: '#915FF6',
  },
  {
    key: 'separation',
    label: '분리불안',
    size: 79,
    x: 106.47,
    y: 100,
    color: '#3EB5FF',
  },
  {
    key: 'curiosity',
    label: '호기심',
    size: 57,
    x: 37.5,
    y: 131,
    color: '#FFC53E',
  },
];

/** 버블을 탭했을 때 아래에 뜨는 근거 인용 — 키워드별 1건 */
export interface TraitQuote {
  traitKey: string;
  title: string;
  quote: string;
  recordedAt: string;
}

export const TRAIT_QUOTES: TraitQuote[] = [
  {
    traitKey: 'impulse',
    title: '충동성',
    quote: '“원하는 걸 참지 못하고 바로 행동으로 옮김"',
    recordedAt: '2026. 7. 29 기록',
  },
  {
    traitKey: 'sensory',
    title: '감각 예민',
    quote: '“큰 소리가 나면 귀를 막고 자리를 피함"',
    recordedAt: '2026. 7. 24 기록',
  },
  {
    traitKey: 'separation',
    title: '분리불안',
    quote: '“보호자와 떨어질 때 울음이 오래 이어짐"',
    recordedAt: '2026. 7. 18 기록',
  },
  {
    traitKey: 'curiosity',
    title: '호기심',
    quote: '“새로운 교구를 먼저 만져보고 질문이 많음"',
    recordedAt: '2026. 7. 15 기록',
  },
];

/** 활동 상세의 한 단계 — note는 예시 문장(있을 때만 아래 작은 줄로) */
export interface PracticeStep {
  text: string;
  note?: string;
}

/** 아이와 함께 연습해봐요 — 지표 영역별 추천 활동 */
export interface PracticeItem {
  key: string;
  /** Badge color 키 */
  domainColor: 'green' | 'orange' | 'blue';
  domain: string;
  title: string;
  /** 아래는 탭했을 때 열리는 상세 시트(928:7300) 내용 */
  duration: string;
  materials: string;
  steps: PracticeStep[];
  tip: string;
}

export const PRACTICE_ITEMS: PracticeItem[] = [
  {
    key: 'book',
    domainColor: 'green',
    domain: '언어·인지',
    title: '그림책 주고받기 놀이',
    duration: '10~15분',
    materials: '좋아하는 그림책 1권',
    steps: [
      { text: '그림책을 함께 보며 “다음엔 무슨 일이 생길까?” 물어 예측하게 해요' },
      { text: '한 장면씩 한 문장으로 설명하도록 번갈아 말해요' },
      {
        text: '아이가 말한 문장을 조금 더 길게 되받아 들려줘요',
        note: '(ex. “응, 토끼가 배고파서 당근을 찾으러 갔구나")',
      },
      { text: '마지막에 “오늘 이야기 다시 말해줄래?” 하고 요약하게 해요' },
    ],
    tip: '묻고 답을 주고받는 대화는 어휘 표현력과 문장 구성 능력을 자연스럽게 키워줘요.',
  },
  {
    key: 'shop',
    domainColor: 'orange',
    domain: '사회성',
    title: '가게놀이 역할극',
    duration: '15~20분',
    materials: '집에 있는 물건 몇 가지, 종이돈',
    steps: [
      { text: '아이와 함께 무엇을 파는 가게인지 정하고 물건을 늘어놓아요' },
      { text: '손님과 주인 역할을 나눠 인사부터 주고받아요' },
      {
        text: '중간에 역할을 바꿔 상대 입장에서 말해보게 해요',
        note: '(ex. “손님, 이건 어떠세요?" / “얼마예요?")',
      },
      { text: '끝나면 어떤 역할이 더 재미있었는지 이야기 나눠요' },
    ],
    tip: '역할을 바꿔보는 놀이는 상대의 입장을 헤아리는 힘을 길러줘요.',
  },
  {
    key: 'turtle',
    domainColor: 'blue',
    domain: '주의집중',
    title: '거북이 호흡 놀이',
    duration: '5~10분',
    materials: '없어요',
    steps: [
      { text: '“거북이처럼 목을 쏙 넣어보자" 하고 어깨를 움츠려요' },
      { text: '넷을 세며 코로 천천히 숨을 들이마셔요' },
      {
        text: '여섯을 세며 입으로 길게 내쉬며 어깨를 내려요',
        note: '(ex. “후— 거북이가 목을 다시 내밀었네")',
      },
      { text: '세 번 반복한 뒤 지금 기분이 어떤지 물어봐요' },
    ],
    tip: '숨을 세며 쉬는 동안 몸이 가라앉고, 흥분을 스스로 조절하는 연습이 돼요.',
  },
];
