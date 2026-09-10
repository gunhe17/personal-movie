import { create } from 'zustand';
import type { CenterLink, InvitationVerifyResponse } from './types';

/**
 * 초대 코드 연결 플로우의 화면 간 상태 (code → confirm → done).
 * 서버 데이터가 아닌 플로우 진행 상태라 in-memory zustand로만 관리한다.
 */
interface LinkFlowState {
  /** verify에 성공한 코드 */
  code: string | null;
  /** verify 응답 (confirm 화면 데이터 소스) */
  verifyResult: InvitationVerifyResponse | null;
  /** claim으로 방금 생성된 링크들 (done 화면의 되돌리기 대상) */
  claimedLinks: CenterLink[];
  /**
   * 비로그인 상태로 딥링크(QR·문자·설치 리퍼러)를 타고 들어온 코드.
   * 가입/로그인을 살아남았다가 코드 화면이 소비한다 — 없으면 가입 게이트에서 유실된다.
   */
  pendingCode: string | null;
  /**
   * 자녀 상세에서 [센터 연결하기]로 들어온 경우의 그 프로필.
   * 이 경로는 어느 아이를 잇는지 이미 정해져 있어, confirm이 서버 추천 대신 이 값과 대조한다.
   * 온보딩·딥링크 진입은 대상이 없어 null이고 그땐 서버 매칭을 쓴다.
   */
  targetProfileId: string | null;

  setVerified: (code: string, result: InvitationVerifyResponse) => void;
  setClaimedLinks: (links: CenterLink[]) => void;
  setPendingCode: (code: string) => void;
  clearPendingCode: () => void;
  setTargetProfileId: (profileId: string | null) => void;
  reset: () => void;
}

export const useLinkFlowStore = create<LinkFlowState>((set) => ({
  code: null,
  verifyResult: null,
  claimedLinks: [],
  pendingCode: null,
  targetProfileId: null,

  setVerified: (code, result) => set({ code, verifyResult: result, claimedLinks: [] }),
  setClaimedLinks: (links) => set({ claimedLinks: links }),
  setPendingCode: (code) => set({ pendingCode: code }),
  clearPendingCode: () => set({ pendingCode: null }),
  setTargetProfileId: (profileId) => set({ targetProfileId: profileId }),
  reset: () =>
    set({ code: null, verifyResult: null, claimedLinks: [], targetProfileId: null }),
}));
