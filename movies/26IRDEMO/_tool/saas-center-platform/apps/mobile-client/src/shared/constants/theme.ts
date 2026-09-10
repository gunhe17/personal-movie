/**
 * 내담자앱 JS 토큰 (COLORS / RADIUS / GAP / SHADOWS …)
 * =========================================================================
 * 색·radius 원본값은 ./tokens.js(단일 소스)에서 가져온다. 값 수정은 tokens.js에서만.
 * tailwind.config.js와 같은 소스를 공유한다 (드리프트 방지).
 * =========================================================================
 */
import {
  primitive,
  text,
  icon,
  bg as bgTokens,
  border as borderTokens,
  action,
  button,
  tag,
  status,
  calendar,
  space,
  radius,
} from "./tokens";

const { gray, brand, blue, red, green, orange, sky, purple, mint } = primitive;

export const COLORS = {
  // ───────── Tier 1: Primitive ─────────
  gray,
  brand,
  blue,
  red,
  green,
  orange,
  sky,
  purple,
  mint,

  /** 브랜드 별칭 — primary = brand/500 (#31A4F7) */
  primary: brand[500],
  primaryLight: brand[50],

  // ───────── Tier 2: Semantic ─────────
  text,
  icon,
  bg: bgTokens,
  border: borderTokens,
  action,
  button,
  tag,
  status,
  calendar,

  // ───────── 편의 alias ─────────
  background: bgTokens.base, // gray/50 #F5F7F8
  surface: bgTokens.surface, // #FFFFFF
  white: "#FFFFFF",
  black: gray[900],
} as const;

export const TYPOGRAPHY = {
  fontFamily: "Pretendard",
  letterSpacing: -0.41,
} as const;

/** Border Radius — tokens.js radius와 동기 */
export const RADIUS = {
  sm: radius.sm, // 8 — 뱃지/상태 칩
  md: radius.md, // 10 — 버튼
  lg: radius.lg, // 12 — 카드
  xl: radius.xl, // 16 — 인풋/시트 내부
  "2xl": radius["2xl"], // 20 — 바텀시트·모달
  "3xl": radius["3xl"], // 24
  full: radius.full,
} as const;

/** Spacing 프리미티브 — 4px 배수 (피그마 space/* 미러) */
export const SPACE = space;

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
} as const;

/** 그림자 (RN ShadowProps) */
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
  /**
   * 오프셋 없는 틸 글로우 — 시안 323:5738
   * drop-shadow(0 0 9.55px rgba(123,185,194,0.2)).
   * 그라디언트 배경 위 흰 컨트롤을 띄우는 용도라 card(회색 드롭)와 성격이 다르다.
   */
  glow: {
    shadowColor: "#7BB9C2",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 9.55,
    elevation: 3,
  },
} as const;
