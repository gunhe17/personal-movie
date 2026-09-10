/**
 * 디자인 시스템 v2 — 토큰 단일 소스 (Single Source of Truth)
 * =========================================================================
 * Figma `🎨 Design System v2` (IkfJgJxLJmAqulk3p3leon) 에서 추출한 컬러/radius 원본값.
 * 정리본: apps/mobile/docs/color-system-v2.md
 *
 * ⚠️ 이 파일이 색 토큰의 유일한 원천이다.
 *   - tailwind.config.js  →  require('./src/shared/constants/tokens.js')  (className)
 *   - theme.ts            →  import ... from './tokens'                    (JS COLORS)
 *   둘 다 여기서 생성되므로 값은 이 파일에서만 고친다 (드리프트 방지).
 *
 * 아키텍처: Primitive(원시값) → Semantic(역할). 화면에는 semantic만 적용.
 * 모드: Light 전용 (앱 전역 다크 미지원). 필드노트 다크 스킨은 theme.ts `fieldnoteDark` 별도.
 * 네이밍: Figma 경로 `group/role/variant` → JS 중첩객체 + kebab. (text/body/default 등)
 * =========================================================================
 */

// ───────────────────────── Tier 1: Primitive ─────────────────────────
const primitive = {
  gray: {
    0: '#FFFFFF',
    50: '#F5F7F8',
    75: '#F0F3F5',
    100: '#E9EEF0',
    200: '#E3EAEF',
    300: '#D1D5DB',
    400: '#AAB2BE',
    500: '#7D848F',
    600: '#58626C',
    700: '#464F58',
    800: '#2D333B',
    900: '#1D2227',
    950: '#171717',
  },
  blue: {
    50: '#F4F8FF',
    100: '#E5EEFF',
    200: '#C8DAFA',
    300: '#8CB5FF',
    400: '#689DFF',
    500: '#4486FF', // ★ 브랜드 기준색
    600: '#2566DD',
    700: '#144CB1',
    800: '#0A3788',
    900: '#052561',
  },
  navy: { deep: '#0B1754' },
  purple: { 400: '#B388FF', 500: '#9B5DFF' },
  mint: { 300: '#8CE0E0', 400: '#59CED8', 500: '#00C3BC', 600: '#009B96' },
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
const b = primitive.blue;

// ───────────────────────── Tier 2: Semantic (Light) ─────────────────────────
// 값은 primitive를 풀어서 hex로 직접 넣는다 (런타임 참조 단순화).

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
    disabled: g[400],
  },
};

/** icon/* — primary·secondary·tertiary는 gray 직결, 상태색은 status 참조. */
const icon = {
  primary: g[500],
  secondary: g[400],
  tertiary: g[300],
  brand: b[500], // = text/state/brand
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
  selected: 'rgba(68,134,255,0.08)', // blue/500 @ 8%
  emphasis: g[800],
  'emphasis-subtle': g[100],
};

/** border/* — 구분 강도. */
const border = {
  subtle: g[100],
  default: g[200],
  strong: g[300],
  heavy: g[900], // 진한 구분선 — 영수증 합계 라인 등 강한 분리
  active: b[500], // = action/primary
};

/** action/* — 버튼·인터랙션. */
const action = {
  primary: b[500],
  'primary-hover': b[600],
  'primary-subtle': b[100],
  disabled: g[200],
};

/** status/* — 의미색 + 틴트 배경. */
const status = {
  danger: primitive.red[500],
  'danger-bg': primitive.red[50],
  info: primitive.sky[500],
  'info-bg': primitive.sky[50],
  success: primitive.green[500],
  'success-bg': primitive.green[50],
  warning: primitive.orange[500],
  'warning-bg': primitive.orange[50],
};

/** accent/* — 도메인 강조. */
const accent = { fieldnote: primitive.purple[500] };

/** trend/* — 통계 방향(상승=빨강/하강=블루). status와 재사용 금지. */
const trend = {
  up: primitive.red[500],
  'up-bg': 'rgba(255,66,66,0.08)',
  down: b[500],
  'down-bg': 'rgba(68,134,255,0.08)',
  flat: g[500],
};

/** tag/* — 상태 배지·태그. 전용 hue(status/primitive와 다름). Light 값. */
const tag = {
  gray: { fg: '#606A74', bg: 'rgba(96,106,116,0.06)', outline: 'rgba(96,106,116,0.26)' },
  blue: { fg: '#2872F8', bg: 'rgba(40,114,248,0.06)', outline: 'rgba(40,114,248,0.27)' },
  indigo: { fg: '#564DF9', bg: 'rgba(86,77,249,0.06)', outline: 'rgba(86,77,249,0.26)' },
  purple: { fg: '#7C4DFF', bg: 'rgba(124,77,255,0.06)', outline: 'rgba(124,77,255,0.26)' },
  pink: { fg: '#F53188', bg: 'rgba(245,49,136,0.07)', outline: 'rgba(245,49,136,0.29)' },
  red: { fg: '#FF4545', bg: 'rgba(255,69,69,0.07)', outline: 'rgba(255,69,69,0.30)' },
  orange: { fg: '#F88F16', bg: 'rgba(248,143,22,0.08)', outline: 'rgba(248,143,22,0.36)' },
  amber: { fg: '#C2890A', bg: 'rgba(194,137,10,0.07)', outline: 'rgba(194,137,10,0.31)' },
  green: { fg: '#12BA54', bg: 'rgba(18,186,84,0.08)', outline: 'rgba(18,186,84,0.34)' },
  teal: { fg: '#00B5A5', bg: 'rgba(0,181,165,0.08)', outline: 'rgba(0,181,165,0.34)' },
};

const m = primitive.mint;
/** button/{color}/{role}-{state} — Light 값. */
const button = {
  primary: {
    'bg-default': b[500], 'bg-hover': b[400], 'bg-pressed': b[600], 'bg-disabled': g[100],
    'text-default': g[0], 'text-hover': g[0], 'text-pressed': g[0], 'text-disabled': g[400],
  },
  secondary: {
    'bg-default': b[100], 'bg-hover': b[50], 'bg-pressed': b[200], 'bg-disabled': b[100],
    'text-default': b[500], 'text-hover': b[400], 'text-pressed': b[600], 'text-disabled': b[300],
  },
  assistive: {
    'bg-default': g[75], 'bg-hover': g[50], 'bg-pressed': g[200], 'bg-disabled': g[50],
    'text-default': g[700], 'text-hover': g[700], 'text-pressed': g[700], 'text-disabled': g[400],
  },
  outline: {
    'bg-hover': g[50], 'bg-pressed': g[100],
    'border-default': g[200], 'border-hover': g[200], 'border-pressed': g[200], 'border-disabled': g[100],
    'text-default': g[700], 'text-hover': g[700], 'text-pressed': g[700], 'text-disabled': g[400],
  },
  white: {
    'bg-default': g[0], 'bg-hover': g[50], 'bg-pressed': g[200], 'bg-disabled': g[50],
    'text-default': g[700], 'text-hover': g[700], 'text-pressed': g[700], 'text-disabled': g[400],
  },
  danger: {
    'bg-hover': 'rgba(255,66,66,0.06)', 'bg-pressed': 'rgba(255,66,66,0.12)',
    'border-default': 'rgba(255,66,66,0.20)', 'border-hover': 'rgba(255,66,66,0.60)',
    'border-pressed': 'rgba(255,66,66,0.80)', 'border-disabled': 'rgba(255,66,66,0.12)',
    'text-default': primitive.red[500], 'text-hover': primitive.red[500],
    'text-pressed': primitive.red[500], 'text-disabled': 'rgba(255,66,66,0.20)',
  },
  billing: {
    'bg-default': 'rgba(0,195,188,0.10)', 'bg-hover': 'rgba(0,195,188,0.06)',
    'bg-pressed': 'rgba(0,195,188,0.16)', 'bg-disabled': 'rgba(0,195,188,0.06)',
    'icon-default': m[400], 'icon-hover': m[300], 'icon-pressed': m[500], 'icon-disabled': m[300],
    'text-default': m[500], 'text-hover': m[400], 'text-pressed': m[600], 'text-disabled': m[300],
  },
};

// ───────────────────────── 비-컬러 토큰 ─────────────────────────
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
  brand: '0 2px 5px 0 rgba(91,18,255,0.18)',
};

const semantic = { text, icon, bg, border, action, status, accent, trend };

module.exports = {
  primitive,
  semantic,
  text,
  icon,
  bg,
  border,
  action,
  status,
  accent,
  trend,
  tag,
  button,
  radius,
  boxShadow,
};
