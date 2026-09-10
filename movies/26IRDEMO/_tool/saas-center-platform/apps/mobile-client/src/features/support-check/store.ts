import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandAsyncStorage } from '@/shared/utils/storage';
import type { SupportCheckAnswers } from './types';

const EMPTY: SupportCheckAnswers = {
  name: null,
  birthDate: null,
  gender: null,
  sido: null,
  income: null,
  evidence: null,
  disability: null,
};

interface SupportCheckState extends SupportCheckAnswers {
  /** persist 복원 완료 — 복원 전 홈이 "정보 없음"으로 깜빡이는 걸 막는다 */
  isHydrated: boolean;
  setChild: (child: Pick<SupportCheckAnswers, 'name' | 'birthDate' | 'gender' | 'sido'>) => void;
  setEligibility: (
    eligibility: Pick<SupportCheckAnswers, 'income' | 'evidence' | 'disability'>,
  ) => void;
  reset: () => void;
}

/**
 * 미연동 홈 플로우의 입력 저장소 — 기기 로컬 전용(서버 전송 없음).
 *
 * 계정에 묶지 않는 이유: 이 입력은 가입 전에도 받아야 하고(플로우의 첫 걸음),
 * 판정이 아니라 안내에만 쓰이기 때문이다. 로그인 사용자에게 자녀 프로필이 있으면
 * 홈이 그 값을 먼저 쓴다(중복 입력 방지) — UnlinkedHome.
 */
export const useSupportCheckStore = create<SupportCheckState>()(
  persist(
    (set) => ({
      ...EMPTY,
      isHydrated: false,
      setChild: (child) => set(child),
      setEligibility: (eligibility) => set(eligibility),
      reset: () => set(EMPTY),
    }),
    {
      name: 'support-check',
      storage: createJSONStorage(() => zustandAsyncStorage),
      // 액션·플래그는 저장 대상이 아니다
      partialize: (state): SupportCheckAnswers => ({
        name: state.name,
        birthDate: state.birthDate,
        gender: state.gender,
        sido: state.sido,
        income: state.income,
        evidence: state.evidence,
        disability: state.disability,
      }),
      onRehydrateStorage: () => () => {
        useSupportCheckStore.setState({ isHydrated: true });
      },
    },
  ),
);
