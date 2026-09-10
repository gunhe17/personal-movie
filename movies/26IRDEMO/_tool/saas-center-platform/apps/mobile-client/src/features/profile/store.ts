import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandAsyncStorage } from '@/shared/utils/storage';

interface ProfileNoticeState {
  /** '다시 표시 안할게요' — 자녀 추가 전 안내 시트를 건너뛴다 */
  addNoticeDismissed: boolean;
  /** persist 복원 완료 — 복원 전엔 안내를 띄우지 않는다(이미 끈 사람에게 다시 뜨는 걸 막음) */
  isHydrated: boolean;
  dismissAddNotice: () => void;
}

/**
 * 자녀 추가 안내 시트의 '다시 보지 않기' — 기기 로컬 전용(서버 전송 없음).
 * 계정이 아니라 기기에 두는 이유: 안내일 뿐 권한·설정이 아니고, 로그인 전에도 눌릴 수 있다.
 */
export const useProfileNoticeStore = create<ProfileNoticeState>()(
  persist(
    (set) => ({
      addNoticeDismissed: false,
      isHydrated: false,
      dismissAddNotice: () => set({ addNoticeDismissed: true }),
    }),
    {
      name: 'profile-notice',
      storage: createJSONStorage(() => zustandAsyncStorage),
      // 액션·플래그는 저장 대상이 아니다
      partialize: (state) => ({ addNoticeDismissed: state.addNoticeDismissed }),
      onRehydrateStorage: () => () => {
        useProfileNoticeStore.setState({ isHydrated: true });
      },
    },
  ),
);
