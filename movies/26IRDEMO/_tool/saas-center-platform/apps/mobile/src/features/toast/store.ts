import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** 표시 시간 (ms) — 기본 4000 */
  durationMs?: number;
  /** 토스트 클릭 시 호출. 호출 후 자동으로 닫힘. 없으면 토스트는 표시만 됨. */
  onPress?: () => void;
}

interface ToastState {
  toasts: ToastItem[];
  /** 토스트 표시 (queue 추가). 반환된 id 로 hide 가능. */
  show: (toast: Omit<ToastItem, "id">) => string;
  hide: (id: string) => void;
  /**
   * 시트(Modal) 안에 떠 있는 "상위(elevated)" 토스트 호스트 수.
   * > 0 이면 루트(기본) 호스트는 렌더를 멈춰 중복(시트 뒤/앞 2개)을 막는다.
   */
  elevatedHostCount: number;
  registerElevatedHost: () => void;
  unregisterElevatedHost: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    return id;
  },
  hide: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  elevatedHostCount: 0,
  registerElevatedHost: () =>
    set((s) => ({ elevatedHostCount: s.elevatedHostCount + 1 })),
  unregisterElevatedHost: () =>
    set((s) => ({ elevatedHostCount: Math.max(0, s.elevatedHostCount - 1) })),
}));
