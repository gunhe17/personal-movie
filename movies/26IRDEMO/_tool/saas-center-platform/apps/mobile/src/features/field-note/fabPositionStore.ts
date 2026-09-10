import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandAsyncStorage } from '@/shared/utils/storage';

interface FabPositionState {
  /** 화면 좌측 기준 x (px) — sentinel(-1) 이면 기본 위치 계산 */
  x: number;
  /** 화면 상단 기준 y (px) — sentinel(-1) 이면 기본 위치 계산 */
  y: number;
  isHydrated: boolean;
  setPosition: (x: number, y: number) => void;
}

/**
 * 필드노트 FAB 위치 영속 저장.
 * 사용자가 드래그하면 손 뗀 그 위치 그대로 유지 (snap 없음).
 * 화면 범위 벗어나면 clamp 보정.
 */
export const useFabPositionStore = create<FabPositionState>()(
  persist(
    (set) => ({
      x: -1,
      y: -1,
      isHydrated: false,
      setPosition: (x, y) => set({ x, y }),
    }),
    {
      // v1 (side/top) 에서 schema 변경되어 새 key 사용
      name: 'fab-position-store-v2',
      storage: createJSONStorage(() => zustandAsyncStorage),
      onRehydrateStorage: () => () => {
        useFabPositionStore.setState({ isHydrated: true });
      },
      partialize: (state) => ({ x: state.x, y: state.y }),
    },
  ),
);
