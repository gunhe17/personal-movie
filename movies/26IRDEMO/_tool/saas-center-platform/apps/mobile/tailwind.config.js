/** @type {import('tailwindcss').Config} */
// 디자인 시스템 v2 — 색/radius/shadow 원본값은 tokens.js(단일 소스)에서 가져온다.
// 값 수정은 tokens.js 에서만. (theme.ts 와 한 소스를 공유 → 드리프트 없음)
const t = require('./src/shared/constants/tokens.js');
const { primitive, icon, bg, border, action, status, trend, tag, button, radius, boxShadow } = t;
const text = t.text;

// v2 text 토큰을 className 친화적으로 평탄화 → text-title-default / text-state-brand …
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

// 브랜드 별칭 스케일 (primary = blue)
const b = primitive.blue;
const primaryScale = {
  DEFAULT: b[500], 50: b[50], 75: b[100], 100: b[100], 200: b[200],
  300: b[300], 400: b[400], 500: b[500], 600: b[600], 700: b[700], 800: b[800], 900: b[900],
};

const px = (n) => `${n}px`;

module.exports = {
  // NOTE: 업데이트 시 파일 경로에 포함된 폴더만 className이 스캔됨
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        white: '#FFFFFF',
        black: primitive.gray[900],

        // ───────── Tier 1: Primitive ─────────
        gray: primitive.gray,
        blue: primitive.blue,
        navy: primitive.navy,
        purple: primitive.purple,
        mint: primitive.mint,
        red: primitive.red,
        green: primitive.green,
        orange: primitive.orange,
        sky: primitive.sky,
        primary: primaryScale, // 브랜드 별칭

        // 상태 flat (의미 유지)
        success: primitive.green[500],
        warning: primitive.orange[500],
        error: primitive.red[500],
        info: primitive.sky[500],
        negative: primitive.red[500],
        positive: primitive.green[500],
        notice: primitive.orange[500],
        information: primitive.sky[500],
        fieldnote: primitive.purple[500],

        // Category (Component 토큰)
        counseling: { DEFAULT: '#05B17A', 50: '#E0F4EB' },
        assessment: { DEFAULT: '#3495F5', 50: '#E0EEFD' },

        // ───────── Tier 2: Semantic v2 ─────────
        // text/* (평탄화 → text-title-default 등)
        ...textFlat,
        // bg/* (평탄화 → bg-surface / bg-base 등)
        ...bg, // base, surface, surface-raised, surface-sunken, overlay, selected, emphasis, emphasis-subtle
        // border/* (평탄화 → border-default 등)
        ...border, // subtle, default, strong, active
        // 그룹 유지 (leaf 키 충돌 방지)
        icon, // text-icon-primary
        action, // bg-action-primary
        status, // text-status-danger / bg-status-danger-bg
        trend, // text-trend-up / bg-trend-up-bg
        tag, // text-tag-blue-fg / bg-tag-blue-bg / border-tag-blue-outline
        button, // bg-button-primary-bg-default
        accent: { DEFAULT: '#ef4967', light: '#feedf0', fieldnote: primitive.purple[500] },

        // Extended Palette
        palette: {
          red: '#D23E46', orange: '#F47500', yellow: '#F5C300', 'green-yellow': '#84B522',
          green: '#017750', blue: '#0E91ED', 'purple-blue': '#012396', violet: '#7B4FFF',
          purple: '#9C23D0', pink: '#C70A89', coral: '#EF4967', mint: '#009BA9',
          gray: '#717171', brick: '#C7371E',
        },
        'palette-bg': {
          red: 'rgba(210,62,70,0.08)', orange: 'rgba(244,117,0,0.08)', yellow: 'rgba(253,202,1,0.1)',
          'green-yellow': 'rgba(132,181,34,0.1)', green: 'rgba(1,119,80,0.06)', blue: 'rgba(14,145,237,0.08)',
          'purple-blue': 'rgba(1,35,150,0.1)', violet: 'rgba(167,139,250,0.1)', purple: 'rgba(156,35,208,0.06)',
          pink: 'rgba(199,10,137,0.06)', coral: 'rgba(239,73,103,0.06)', mint: 'rgba(19,149,161,0.08)',
          gray: 'rgba(113,113,113,0.08)', brick: 'rgba(199,55,30,0.06)',
        },

        // 편의 alias (유지)
        text: text.body.strong, // text-text (Typography 기본 색)
        'text-secondary': text.label.default,
        background: bg.base, // bg-background (= bg.base)
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
        'label-01': ['13px', { lineHeight: '20px', letterSpacing: '-0.41px' }], // v2: 18→20
        'label-02': ['12px', { lineHeight: '16px', letterSpacing: '-0.41px' }],
        'caption-01': ['11px', { lineHeight: '14px', letterSpacing: '-0.41px' }],
      },
      // Border Radius — v2 스케일 (tokens.radius)
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
        'region-gap': '36px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '20px',
        xl: '32px',
        'screen-x': '16px',
        'safe-bottom': '34px',
      },
      // 그림자 (web/box-shadow — RN은 theme.ts SHADOWS)
      boxShadow: {
        card: boxShadow.card,
        sheet: boxShadow.sheet,
        bar: boxShadow.bar,
        brand: boxShadow.brand,
        // legacy
        float: '0 4px 16px 0 rgba(0,0,0,0.12)',
        toast: '0 8px 24px 0 rgba(0,0,0,0.16)',
      },
    },
  },
  plugins: [],
};
