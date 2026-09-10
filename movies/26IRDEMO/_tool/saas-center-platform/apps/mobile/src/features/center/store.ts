import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandAsyncStorage } from '@/shared/utils/storage';

interface CenterState {
  centerId: string | null;
  centerName: string | null;
  roleCode: string | null;
  isHydrated: boolean;

  setCenterContext: (id: string, name: string, roleCode: string | null) => void;
  clearCenter: () => void;
}

export const useCenterStore = create<CenterState>()(
  persist(
    (set) => ({
      centerId: null,
      centerName: null,
      roleCode: null,
      isHydrated: false,

      setCenterContext: (id, name, roleCode) =>
        set({ centerId: id, centerName: name, roleCode }),
      clearCenter: () => set({ centerId: null, centerName: null, roleCode: null }),
    }),
    {
      name: 'center-store',
      storage: createJSONStorage(() => zustandAsyncStorage),
      onRehydrateStorage: () => () => {
        useCenterStore.setState({ isHydrated: true });
      },
      partialize: (state) => ({
        centerId: state.centerId,
        centerName: state.centerName,
        roleCode: state.roleCode,
      }),
    },
  ),
);
