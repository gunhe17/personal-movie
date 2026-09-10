/**
 * 마인드스코프 내담자앱 — 토큰 단일 소스 (Single Source of Truth)
 * =========================================================================
 * apps/mobile(전문가앱) tokens.js를 기반으로 한 내담자앱 전용 버전.
 *
 * ⚠️ 이 파일이 색 토큰의 유일한 원천이다.
 *   - tailwind.config.js  →  require('./src/shared/constants/tokens.js')  (className)
 *   - theme.ts            →  import ... from './tokens'                    (JS COLORS)
 *   둘 다 여기서 생성되므로 값은 이 파일에서만 고친다 (드리프트 방지).
 *
 * 내담자앱 차이점 (전문가앱과 다름):
 *   - 액센트(브랜드) = brand blue /500 #31A4F7 (2026-07-24 색시스템 637:2 확정 — 그린 폐기).
 *   - bg.base = gray/50 (2026-07-20 시안 — 그레이지 스톤 #F3F1EE 폐기).
 *   - 상태/액센트 컬러는 전문가앱과 동일, 그레이는 시안 갱신값(500·600·900 상이).
 * =========================================================================
 */

// ───────────────────────── Tier 1: Primitive ─────────────────────────
const primitive = {
  /** 내담자앱 브랜드 블루 — 500 기준값 (색시스템 637:2). blue 램프와 동일 계열로 통일 */
  brand: {
    50: '#ECF6FE',
    100: '#E1F2FE',
    200: '#BAE1FC',
    300: '#8ECDFA',
    400: '#67BCF9',
    500: '#31A4F7', // ★ 브랜드 기준색
    600: '#0981D7',
    700: '#096AAE',
    800: '#095286',
    900: '#083A5E',
  },
  // 2026-07-20 시안 기준 — 500·600·900은 전문가앱 코드값과 다름(시안이 정본)
  gray: {
    0: '#FFFFFF',
    50: '#F5F7F8',
    75: '#F0F3F5',
    100: '#E9EEF0',
    200: '#E3EAEF',
    300: '#D1D5DB',
    400: '#AAB2BE',
    500: '#696F78',
    600: '#414C58',
    700: '#363F4A',
    800: '#2D333B',
    900: '#14181C',
    950: '#171717',
  },
  /** 블루 램프 = brand와 동일 계열(색시스템 637:2 통일). 버튼·액센트가 한 블루를 공유 */
  blue: {
    50: '#ECF6FE',
    100: '#E1F2FE',
    200: '#BAE1FC',
    300: '#8ECDFA',
    400: '#67BCF9',
    500: '#31A4F7',
    600: '#0981D7',
    700: '#096AAE',
    800: '#095286',
  },
  // 상태·액센트 — 전문가앱 tokens.js와 동일 원시값
  purple: { 400: '#B388FF', 500: '#9B5DFF' },
  mint: { 300: '#8CE0E0', 400: '#59CED8', 500: '#00B2AC', 600: '#009B96' },
  red: { 50: '#FFECEC', 400: '#FF6B6B', 500: '#FF4242' },
  green: { 50: '#E5F8EC', 400: '#33D16A', 500: '#00BF40' },
  orange: { 50: '#FFF3E5', 400: '#FFA733', 500: '#FF9200' },
  sky: { 50: '#E5F4FF', 400: '#47B4FF', 500: '#0E9BFF' },
  alpha: {
    'black-50': 'rgba(0,0,0,0.5)',
    'black-60': 'rgba(0,0,0,0.6)',
    'red-16': 'rgba(255,66,66,0.16)',
    'green-16': 'rgba(0,191,64,0.16)',
    'orange-16': 'rgba(255,146,0,0.16)',
    'sky-16': 'rgba(14,155,255,0.16)',
  },
};

const g = primitive.gray;
const b = primitive.brand;

// ───────────────────────── Tier 2: Semantic (Light) ─────────────────────────

/** text/* — 정보 계층. role(headline·title·body·caption·label) + state. */
const text = {
  headline: g[900],
  title: { default: g[900], subtle: g[600] },
  body: { strong: g[900], default: g[600], subtle: g[500] },
  caption: { default: g[500], subtle: g[400] },
  label: { strong: g[900], default: g[600] },
  placeholder: g[400],
  state: {
    inverse: g[0],
    'on-primary': g[0],
    brand: b[500],
    /** 시안 text/state/brand-strong — 흰 배경 위 링크 텍스트(빈 화면 안내 등) */
    'brand-strong': b[600],
    disabled: g[400],
  },
};

/**
 * icon/* — primary·secondary·tertiary는 gray 직결, 상태색은 status 참조.
 * muted는 대응 프리미티브가 없는 시안 고유값(기록 탭 뷰 토글 414:4094 비선택 아이콘).
 */
const icon = {
  primary: g[500],
  secondary: g[400],
  tertiary: g[300],
  muted: '#A7C7C8',
  brand: b[500],
  inverse: g[0],
  'on-primary': g[0],
  disabled: g[400],
  info: primitive.sky[500],
  danger: primitive.red[500],
  success: primitive.green[500],
  warning: primitive.orange[500],
};

/** bg/* — 레이어 높이 / 배경 의미. */
const bg = {
  base: g[50],
  surface: g[0],
  'surface-raised': g[0],
  'surface-sunken': g[50],
  overlay: primitive.alpha['black-50'],
  selected: 'rgba(49,164,247,0.08)', // brand/500 #31A4F7 @ 8%
  /** 브랜드 틴트 면 — 아이콘 배지 등(시안 bg/brand-subtle 1286:10669) */
  'brand-subtle': b[50],
  emphasis: g[800],
  'emphasis-subtle': g[100],
};

/**
 * border/* — 구분 강도.
 * tip은 대응 프리미티브가 없는 시안 고유값(기록 작성 팁 카드 287:2708 연두 테두리).
 */
const border = {
  subtle: g[100],
  default: g[200],
  strong: g[300],
  heavy: g[900],
  active: b[500],
  tip: '#D3EAB0',
};

/** action/* — 버튼·인터랙션. */
const action = {
  primary: b[500],
  'primary-hover': b[600],
  'primary-subtle': b[100],
  disabled: g[200],
};

/**
 * button/* — 공용 Button 컴포넌트 variant×state (피그마 Button 셋 button/* 변수 미러).
 * hover 상태는 RN에 없어 제외. 알파값은 #RRGGBBAA (RN 지원).
 */
const blue = primitive.blue;
const mint = primitive.mint;
const red = primitive.red;
const button = {
  primary: {
    // button/primary/bg-default = brand/500 #31A4F7 (색시스템 637:2). 흰 라벨 대비는
    // AA 미달이나 디자인 확정값을 따른다. pressed는 한 단계 진하게.
    bg: blue[500],
    bgPressed: blue[700],
    bgDisabled: g[100],
    text: g[0],
    // gray/500은 gray/100 배경 위에서 비활성으로 안 읽혀(본문색과 동급) text/state/disabled와 맞춤
    textDisabled: g[400],
  },
  secondary: {
    bg: blue[100],
    bgPressed: blue[200],
    bgDisabled: blue[100],
    text: blue[700],
    textPressed: blue[800],
    textDisabled: blue[300],
  },
  assistive: {
    bg: g[100],
    bgPressed: g[300],
    bgDisabled: g[75],
    text: g[700],
    textDisabled: g[500],
  },
  white: {
    bg: g[0],
    bgPressed: g[200],
    bgDisabled: g[50],
    text: g[700],
    textDisabled: g[500],
  },
  billing: {
    bg: '#00B2AC1A', // mint/500 @10%
    bgPressed: '#00B2AC29', // @16%
    bgDisabled: '#00B2AC0F', // @6%
    text: mint[500],
    textPressed: mint[600],
    textDisabled: mint[300],
  },
  outline: {
    bg: 'transparent',
    bgPressed: g[100],
    bgDisabled: 'transparent',
    text: g[700],
    textDisabled: g[500],
    border: g[200],
    borderDisabled: g[100],
  },
  danger: {
    bg: 'transparent',
    bgPressed: '#FF42421F', // red/500 @12%
    bgDisabled: 'transparent',
    text: red[500],
    textDisabled: '#FF424233', // @20%
    border: '#FF424233', // @20%
    borderPressed: '#FF4242CC', // @80%
    borderDisabled: '#FF42421F', // @12%
  },
};

/**
 * tag/* — Badge(뱃지) 전용 컬러 (피그마 Badge 셋 tag/* 변수 미러).
 * 상태색(status/*)과 별개의 뱃지 전용 팔레트 — 원시 램프와 값이 다르다.
 */
const tag = {
  gray: { fg: '#606A74', bg: 'rgba(96,106,116,0.06)' },
  green: { fg: '#12BA54', bg: 'rgba(18,186,84,0.08)' },
  blue: { fg: '#2872F8', bg: 'rgba(40,114,248,0.06)' },
  red: { fg: '#FF4545', bg: 'rgba(255,69,69,0.07)' },
  orange: { fg: '#F88F16', bg: 'rgba(248,143,22,0.08)' },
  teal: { fg: '#00B5A5', bg: 'rgba(0,181,165,0.08)' },
  purple: { fg: '#7C4DFF', bg: 'rgba(124,77,255,0.06)' },
  // 발달 지표 레이더(활동 요약 913:5939)의 6번째 축 색 — 다른 5축은 위 tag/* 값과 일치하나
  // 이 핑크만 대응 변수가 없어 신설. bg는 나머지 축과 같은 8% 틴트 규칙으로 유도.
  pink: { fg: '#F53188', bg: 'rgba(245,49,136,0.08)' },
};

/**
 * calendar/* — 요일 색. 디자인 시스템에 주말 축이 없어 신설(일정 탭 달력 414:4313).
 * saturday는 대응 프리미티브가 없는 시안 고유값.
 */
const calendar = {
  sunday: primitive.red[500],
  saturday: '#4D94FF',
};

/** status/* — 의미색 + 틴트 배경 (전문가앱과 동일) + 중립. */
const status = {
  neutral: g[600],
  'neutral-bg': g[100],
  danger: primitive.red[500],
  'danger-bg': primitive.red[50],
  info: primitive.sky[500],
  'info-bg': primitive.sky[50],
  success: primitive.green[500],
  'success-bg': primitive.green[50],
  warning: primitive.orange[500],
  'warning-bg': primitive.orange[50],
};

// ───────────────────────── 비-컬러 토큰 ─────────────────────────
/**
 * space/* — 4px 배수 프리미티브 (피그마 디자인 시스템 §스페이싱 미러).
 * className은 tailwind 기본 스케일(p-1=4 …)과 값이 같으므로 그대로 쓰고,
 * inline style로 간격을 줄 때 이 토큰을 참조한다.
 * 레이아웃 시맨틱(screen-x=16, section-gap=24 등)은 theme.ts GAP·LAYOUT.
 */
const space = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  36: 36,
  40: 40,
  48: 48,
};

const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

/** boxShadow 문자열 (tailwind/web). RN ShadowProps는 theme.ts SHADOWS 참조. */
const boxShadow = {
  card: '0 1px 12.7px 0 rgba(2,28,51,0.06)',
  sheet: '0 -1px 15.8px 0 rgba(0,0,0,0.06)',
  bar: '0 -1px 7.9px 0 rgba(0,0,0,0.06)',
};

module.exports = {
  primitive,
  text,
  icon,
  bg,
  border,
  action,
  button,
  tag,
  status,
  calendar,
  space,
  radius,
  boxShadow,
};
