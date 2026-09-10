import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandAsyncStorage } from '@/shared/utils/storage';
import apiClient from '@/shared/api/client';
import type { Permission, AccessLevel, PermissionContext } from './permissions';

interface PermissionState {
  context: PermissionContext | null;
  isLoading: boolean;
  isHydrated: boolean;

  fetchPermissions: (centerId: string) => Promise<void>;
  clearPermissions: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      context: null,
      isLoading: false,
      isHydrated: false,

      fetchPermissions: async (centerId: string) => {
        if (get().isLoading) return;

        set({ isLoading: true });

        try {
          const { data } = await apiClient.get(
            `/centers/${centerId}/me/permissions`,
          );

          const context: PermissionContext = {
            permissions: (data.permissions ?? []) as Permission[],
            roleCode: data.role_code ?? null,
            memberId: data.member_id ?? null,
            accessLevel: (data.access_level ?? 'own') as AccessLevel,
          };

          set({ context, isLoading: false });
        } catch (error) {
          console.error('[Permission] Failed to fetch:', error);
          set({ isLoading: false });
        }
      },

      clearPermissions: () => {
        set({ context: null, isLoading: false });
      },
    }),
    {
      name: 'permission-store',
      storage: createJSONStorage(() => zustandAsyncStorage),
      onRehydrateStorage: () => () => {
        usePermissionStore.setState({ isHydrated: true });
      },
      partialize: (state) => ({
        context: state.context,
      }),
    },
  ),
);
