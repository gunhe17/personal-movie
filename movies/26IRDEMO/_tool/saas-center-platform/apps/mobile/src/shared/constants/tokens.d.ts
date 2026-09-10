/**
 * tokens.js 타입 선언 — theme.ts 가 strict TS 환경에서 import 할 수 있게 한다.
 * 런타임 값은 tokens.js, 타입은 이 파일. (값/키 추가 시 양쪽 모두 갱신)
 */
type Hex = string;
type Scale = Record<string | number, Hex>;

export const primitive: {
  gray: Scale;
  blue: Scale;
  navy: { deep: Hex };
  purple: Scale;
  mint: Scale;
  red: Scale;
  green: Scale;
  orange: Scale;
  sky: Scale;
  alpha: Record<string, Hex>;
};

export const text: {
  headline: Hex;
  title: { default: Hex; subtle: Hex };
  body: { strong: Hex; default: Hex; subtle: Hex };
  caption: { default: Hex; subtle: Hex };
  label: { strong: Hex; default: Hex };
  placeholder: Hex;
  state: { inverse: Hex; "on-primary": Hex; brand: Hex; disabled: Hex };
};
export const icon: {
  primary: Hex; secondary: Hex; tertiary: Hex; brand: Hex; inverse: Hex;
  "on-primary": Hex; disabled: Hex; info: Hex; danger: Hex; success: Hex; warning: Hex;
};
export const bg: {
  base: Hex; surface: Hex; "surface-raised": Hex; "surface-sunken": Hex;
  overlay: Hex; selected: Hex; emphasis: Hex; "emphasis-subtle": Hex;
};
export const border: { subtle: Hex; default: Hex; strong: Hex; heavy: Hex; active: Hex };
export const action: {
  primary: Hex; "primary-hover": Hex; "primary-subtle": Hex; disabled: Hex;
};
export const status: {
  danger: Hex; "danger-bg": Hex; info: Hex; "info-bg": Hex;
  success: Hex; "success-bg": Hex; warning: Hex; "warning-bg": Hex;
};
export const accent: { fieldnote: Hex };
export const trend: { up: Hex; "up-bg": Hex; down: Hex; "down-bg": Hex; flat: Hex };
export const tag: Record<string, { fg: Hex; bg: Hex; outline: Hex }>;
export const button: Record<string, Record<string, Hex>>;
export const radius: {
  sm: number; md: number; lg: number; xl: number;
  "2xl": number; "3xl": number; full: number;
};
export const boxShadow: Record<string, string>;
export const semantic: {
  text: typeof text;
  icon: typeof icon;
  bg: typeof bg;
  border: typeof border;
  action: typeof action;
  status: typeof status;
  accent: typeof accent;
  trend: typeof trend;
};
