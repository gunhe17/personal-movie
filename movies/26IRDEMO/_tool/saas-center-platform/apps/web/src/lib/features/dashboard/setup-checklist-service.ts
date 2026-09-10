/**
 * Setup Checklist Service
 * 대시보드 '센터 첫 세팅' 카드의 세 항목을 현재 화면에서 모달로 처리한다.
 *
 * 각 모달은 성공 시 자기 목록 키를 invalidate 하므로(getRoomList / getProgramList /
 * getMemberList) 체크리스트 진행 링은 별도 배선 없이 갱신된다.
 */

import type { QueryClient } from '@tanstack/svelte-query'

import { modalStore } from '$lib/stores/modal'
import RoomRegisterModal from '$lib/components/modal/RoomRegisterModal.svelte'
import { createProgramService } from '$lib/features/center/program/program-service'
import { createMembersService } from '$lib/features/members/members-service'

const REGISTER_MODAL_WIDTH = 560

export interface SetupChecklistDeps {
  queryClient: QueryClient
}

export function createSetupChecklistService(deps: SetupChecklistDeps) {
  // 상담실은 전용 서비스가 없어 페이지와 동일하게 모달을 직접 연다.
  // onSuccessAfterCreate 는 넘기지 않는다 — 그건 상담실 페이지의 returnTo 이동용 후처리.
  const openRoomRegister = () =>
    modalStore.open({
      component: RoomRegisterModal,
      props: {},
      options: { customWidth: REGISTER_MODAL_WIDTH }
    })

  const openProgramRegister = () =>
    createProgramService(deps).openRegisterModal()

  const openMemberInvite = () =>
    createMembersService(deps).openInviteModal({ redirectToPending: false })

  return { openRoomRegister, openProgramRegister, openMemberInvite }
}
