/** @type {import('tailwindcss').Config} */
// 내담자앱 디자인 시스템 — 색/radius/shadow 원본값은 tokens.js(단일 소스)에서 가져온다.
// 값 수정은 tokens.js 에서만. (theme.ts 와 한 소스를 공유 → 드리프트 없음)
const t = require('./src/shared/constants/tokens.js');
const { primitive, icon, bg, border, action, status, radius, boxShadow } = t;
const text = t.text;

// text 토큰을 className 친화적으로 평탄화 → text-title-default / text-state-brand …
const textFlat = {
  headline: text.headline,
  'title-default': text.title.default,
  'title-subtle': text.title.subtle,
  'body-strong': text.body.strong,
  'body-default': text.body.default,
  'body-subtle': text.body.subtle,
  'caption-default': text.caption.default,
  'caption-subtle': text.caption.subtle,
  'label-strong': text.label.strong,
  'label-default': text.label.default,
  placeholder: text.placeholder,
  'state-inverse': text.state.inverse,
  'state-on-primary': text.state['on-primary'],
  'state-brand': text.state.brand,
  'state-disabled': text.state.disabled,
};

// 브랜드 별칭 스케일 (primary = brand green)
const b = primitive.brand;
const primaryScale = {
  DEFAULT: b[500], 50: b[50], 100: b[100], 200: b[200],
  300: b[300], 400: b[400], 500: b[500], 600: b[600], 700: b[700], 800: b[800], 900: b[900],
};

const px = (n) => `${n}px`;

module.exports = {
  // NOTE: 파일 경로에 포함된 폴더만 className이 스캔됨
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        white: '#FFFFFF',
        black: primitive.gray[900],

        // ───────── Tier 1: Primitive ─────────
        gray: primitive.gray,
        brand: primitive.brand,
        blue: primitive.blue,
        red: primitive.red,
        green: primitive.green,
        orange: primitive.orange,
        sky: primitive.sky,
        purple: primitive.purple,
        mint: primitive.mint,
        primary: primaryScale, // 브랜드 별칭

        // ───────── Tier 2: Semantic ─────────
        // text/* (평탄화 → text-title-default 등)
        ...textFlat,
        // bg/* (평탄화 → bg-surface / bg-base 등)
        ...bg,
        // border/* (평탄화 → border-default 등)
        ...border,
        // 그룹 유지 (leaf 키 충돌 방지)
        icon, // text-icon-primary
        action, // bg-action-primary
        status, // text-status-info / bg-status-info-bg

        // 편의 alias (전문가앱과 동일 패턴 유지)
        text: text.body.strong, // text-text (Typography 기본 색)
        'text-secondary': text.label.default,
        background: bg.base, // bg-background (= bg.base gray/50)
      },
      fontFamily: {
        sans: ['Pretendard'],
      },
      // 타이포 variant별 사이즈 (letterSpacing -0.41 공통)
      fontSize: {
        'headline-01': ['24px', { lineHeight: '36px', letterSpacing: '-0.41px' }],
        'headline-02': ['20px', { lineHeight: '28px', letterSpacing: '-0.41px' }],
        'title-01': ['18px', { lineHeight: '26px', letterSpacing: '-0.41px' }],
        'body-01': ['16px', { lineHeight: '24px', letterSpacing: '-0.41px' }],
        'body-01-reading': ['16px', { lineHeight: '26px', letterSpacing: '-0.41px' }],
        'body-02': ['15px', { lineHeight: '22px', letterSpacing: '-0.41px' }],
        'body-02-reading': ['15px', { lineHeight: '24px', letterSpacing: '-0.41px' }],
        'body-03': ['14px', { lineHeight: '20px', letterSpacing: '-0.41px' }],
        'label-01': ['13px', { lineHeight: '20px', letterSpacing: '-0.41px' }],
        'label-02': ['12px', { lineHeight: '16px', letterSpacing: '-0.41px' }],
        'caption-01': ['11px', { lineHeight: '14px', letterSpacing: '-0.41px' }],
      },
      // Border Radius — tokens.radius
      borderRadius: {
        sm: px(radius.sm), // 8
        md: px(radius.md), // 10
        lg: px(radius.lg), // 12
        xl: px(radius.xl), // 16
        '2xl': px(radius['2xl']), // 20
        '3xl': px(radius['3xl']), // 24
        full: '9999px',
      },
      // Spacing — Semantic gap 토큰 + 화면 구조
      spacing: {
        'gap-intra': '4px',
        'gap-card': '12px',
        'gap-related': '16px',
        'gap-section': '24px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '20px',
        xl: '32px',
        'screen-x': '16px',
        'safe-bottom': '34px',
      },
      boxShadow: {
        card: boxShadow.card,
        sheet: boxShadow.sheet,
        bar: boxShadow.bar,
      },
    },
  },
  plugins: [],
};
