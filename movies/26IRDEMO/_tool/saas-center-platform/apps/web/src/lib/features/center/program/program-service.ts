import { modalStore, modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { deleteProgram, type ProgramListItem } from '$lib/hooks/actions/program.action'
import ProgramRegisterModal from '$lib/components/modal/ProgramRegisterModal.svelte'
import type { QueryClient } from '@tanstack/svelte-query'

export interface ProgramServiceDeps {
  queryClient: QueryClient
}

export function createProgramService(deps: ProgramServiceDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getProgramList'],
      exact: false
    })

  function openRegisterModal(onSuccessRedirect?: () => void) {
    modalStore.open({
      component: ProgramRegisterModal,
      props: {
        ...(onSuccessRedirect ? { onSuccessAfterCreate: onSuccessRedirect } : {})
      },
      options: { customWidth: 540 }
    })
  }

  function openEditModal(program: ProgramListItem) {
    modalStore.open({
      component: ProgramRegisterModal,
      props: {
        program_id: program.id,
        initial_name: program.name,
        initial_price: program.price,
        initial_duration_minutes: program.duration_minutes,
        initial_program_type: program.program_type,
        initial_managers: program.members.map((member) => ({
          id: member.member_id,
          name: member.name
        }))
      },
      options: { customWidth: 540 }
    })
  }

  async function confirmDelete(program: ProgramListItem) {
    const confirmed = await modalUtils.confirm(
      `"${program.name}" 프로그램을 삭제할까요?`,
      '프로그램 삭제', { type: 'danger' })
    if (!confirmed) return

    try {
      await deleteProgram().request({
        centerId: requireCenterId(),
        programId: program.id
      })
      await invalidateList()
      snackbarStore.success('프로그램이 삭제되었습니다.')
    } catch (error) {
      snackbarStore.error(
        error instanceof Error ? error.message : '프로그램 삭제에 실패했습니다.'
      )
    }
  }

  return { openRegisterModal, openEditModal, confirmDelete, invalidateList }
}
