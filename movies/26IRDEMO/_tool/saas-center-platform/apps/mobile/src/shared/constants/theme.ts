/**
 * 디자인 시스템 v2 — JS 토큰 (COLORS / RADIUS / SHADOWS …)
 * =========================================================================
 * 색·radius 원본값은 ./tokens.js(단일 소스)에서 가져온다. 값 수정은 tokens.js에서만.
 * 정리본: apps/mobile/docs/color-system-v2.md
 *
 * 네이밍: Figma 경로 그대로 → COLORS.text.title.default / COLORS.bg.surface /
 *         COLORS.border.default / COLORS.action.primary / COLORS.icon.primary 등.
 *
 * 🚧 전환 안내: 화면을 v2 role로 재분류 이전 중이다. 아래 "전환용 alias"(fg/stroke/
 *    interactive, bg.page/card/sunken …)는 기존 화면 호환을 위한 임시 매핑이며,
 *    화면 이전이 끝나면 제거한다. **신규 코드는 v2 토큰만 사용**.
 * =========================================================================
 */
import {
  primitive,
  text,
  icon,
  bg as bgV2,
  border as borderV2,
  action,
  status,
  accent,
  trend,
  tag,
  button,
  radius,
} from "./tokens";

const { gray, blue } = primitive;

export const COLORS = {
  // ───────── Tier 1: Primitive ─────────
  gray,
  blue,
  navy: primitive.navy,
  purple: primitive.purple,
  mint: primitive.mint,
  red: primitive.red,
  green: primitive.green,
  orange: primitive.orange,
  sky: primitive.sky,
  alpha: primitive.alpha,

  /** 브랜드 별칭 — primary = blue 스케일 (#4486FF). */
  primary: blue[500],
  primaryLight: blue[50],
  primary50: blue[50],
  primary75: blue[100],
  primary100: blue[100],
  primary200: blue[200],
  primary300: blue[300],
  primary400: blue[400],
  primary500: blue[500],
  primary600: blue[600],
  primary700: blue[700],
  primary800: blue[800],
  primary900: blue[900],

  // 상태 flat (의미 유지 — 토스트/레거시 호환)
  success: primitive.green[500],
  warning: primitive.orange[500],
  error: primitive.red[500],
  info: primitive.sky[500], // #0E9BFF (구 #32AAFF)
  negative: primitive.red[500],
  positive: primitive.green[500],
  notice: primitive.orange[500],
  information: primitive.sky[500],

  // Feature
  fieldnote: primitive.purple[500],
  /** 필드노트 다크 정체성 — 이 도메인 화면에서만 사용(앱 전역 다크 아님). */
  fieldnoteDark: {
    bg: "#171717",
    card: "#1D2227",
    line: "rgba(255,255,255,0.08)",
    activeBg: "rgba(185,139,255,0.12)",
    text: "#E7E3F5",
    sub: "#A39DBF",
    accent: "#B98BFF",
  },

  // Category (Component 토큰 — Semantic 연결 금지)
  counseling: "#05B17A",
  counselingLight: "#E0F4EB",
  assessment: "#3495F5",
  assessmentLight: "#E0EEFD",
  // Accent (legacy coral — Extended Palette와 별개)
  accentLegacy: "#ef4967",
  accentLegacyLight: "#feedf0",

  /** Extended Palette — primary/gray 외 14색. Solid / OpacityBG. (design.md §1 Tier1) */
  palette: {
    red: "#D23E46",
    orange: "#F47500",
    yellow: "#F5C300",
    greenYellow: "#84B522",
    green: "#017750",
    blue: "#0E91ED",
    purpleBlue: "#012396",
    violet: "#7B4FFF",
    purple: "#9C23D0",
    pink: "#C70A89",
    coral: "#EF4967",
    mint: "#009BA9",
    gray: "#717171",
    brick: "#C7371E",
  },
  paletteBg: {
    red: "rgba(210,62,70,0.08)",
    orange: "rgba(244,117,0,0.08)",
    yellow: "rgba(253,202,1,0.1)",
    greenYellow: "rgba(132,181,34,0.1)",
    green: "rgba(1,119,80,0.06)",
    blue: "rgba(14,145,237,0.08)",
    purpleBlue: "rgba(1,35,150,0.1)",
    violet: "rgba(167,139,250,0.1)",
    purple: "rgba(156,35,208,0.06)",
    pink: "rgba(199,10,137,0.06)",
    coral: "rgba(239,73,103,0.06)",
    mint: "rgba(19,149,161,0.08)",
    gray: "rgba(113,113,113,0.08)",
    brick: "rgba(199,55,30,0.06)",
  },

  // ───────── Tier 2: Semantic v2 (신규 코드 기준) ─────────
  /** 텍스트 — COLORS.text.title.default 등 (Figma text/*) */
  text,
  /** 아이콘 — COLORS.icon.primary 등 (Figma icon/*) */
  icon,
  /** 배경 — COLORS.bg.surface / bg.base / bg.selected … (Figma bg/*) */
  bg: bgV2,
  /** 보더 — COLORS.border.default 등 (Figma border/*) */
  border: borderV2,
  /** 액션 — COLORS.action.primary 등 (Figma action/*) */
  action,
  /** 상태 — COLORS.status.danger / status['danger-bg'] (Figma status/*) */
  status,
  /** 강조 — COLORS.accent.fieldnote (Figma accent/*) */
  accent,
  /** 추세 — COLORS.trend.up 등 (Figma trend/*) */
  trend,
  /** 태그/배지 — COLORS.tag.blue.fg 등 */
  tag,
  /** 버튼 — COLORS.button.primary['bg-default'] 등 */
  button,

  // ───────── Tier 3: Component ─────────
  /** 상태 뱃지 (배경+텍스트 세트) — v2 값 */
  statusBadge: {
    completed: { bg: gray[200], text: gray[600] },
    inProgress: { bg: "rgba(255,146,0,0.12)", text: primitive.orange[500] },
    scheduled: { bg: gray[100], text: gray[600] },
    requested: { bg: gray[100], text: gray[700] },
  },
  /** 일정 카드 카테고리 dot (Schedule Accent) */
  scheduleAccent: {
    default: blue[500],
    group: primitive.red[500],
    fieldnote: primitive.purple[500],
  },
  /** 캘린더 dot */
  calendarDot: {
    primary: blue[500],
    secondary: primitive.red[500],
    fieldnote: primitive.purple[500],
  },

  // ───────── Legacy flat aliases (편의 상수 — 유지) ─────────
  background: bgV2.base, // = bg.base
  surface: bgV2.surface, // = bg.surface
  white: "#FFFFFF",
  black: gray[900],
  textSecondary: text.label.default,
  /** @deprecated 투명 배경 — palette/tag 로 이전 권장 */
  trans: {
    gray: "rgba(125,132,143,0.1)",
    blue: "rgba(50,170,255,0.1)",
    green: "rgba(0,191,64,0.1)",
    red: "rgba(255,66,66,0.1)",
    yellow: "rgba(255,146,0,0.1)",
    purple: "rgba(155,93,255,0.1)",
  },
} as const;

export const TYPOGRAPHY = {
  fontFamily: "Pretendard",
  letterSpacing: -0.41,
} as const;

/** Border Radius — v2 스케일 (tokens.js radius와 동기) */
export const RADIUS = {
  sm: radius.sm, // 8 — 뱃지/상태 칩
  md: radius.md, // 10 — 버튼
  lg: radius.lg, // 12 — 카드
  xl: radius.xl, // 16 — 인풋/시트 내부
  "2xl": radius["2xl"], // 20 — 바텀시트·모달
  "3xl": radius["3xl"], // 24
  full: radius.full, // 9999
} as const;

/**
 * Spacing — Semantic 토큰 (관계 기반)
 *   intra 4 / card 12 / related 16 / section 24
 */
export const GAP = {
  intra: 4,
  card: 12,
  related: 16,
  section: 24,
} as const;

/** 화면 구조 상수 */
export const LAYOUT = {
  screenPaddingX: 16,
  safeBottom: 34,
  navBarHeight: 80,
  tabBarHeight: 48,
  segmentTabHeight: 48,
} as const;

/** @deprecated 신규 코드는 GAP 사용 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
} as const;

/** 그림자 (RN ShadowProps) — v2 elevation */
export const SHADOWS = {
  card: {
    shadowColor: "#021C33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 8,
  },
  bar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    shadowColor: "#5B12FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  // legacy (유지 — 기존 화면 호환)
  float: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  toast: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

/** Z-Index 레이어 */
export const Z_INDEX = {
  base: 0,
  sticky: 100,
  fab: 200,
  sheetDim: 300,
  sheet: 400,
  toast: 500,
  tooltip: 600,
} as const;

/** 모션 토큰 */
export const MOTION = {
  duration: { fast: 150, normal: 200, slow: 300, xslow: 500 },
  easing: {
    default: [0.4, 0, 0.2, 1] as const,
    enter: [0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
} as const;
