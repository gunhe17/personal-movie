import { snackbarStore } from '$lib/stores/snackbar'
import { requireInstitutionId } from '$lib/stores/institution.store'
import type { QueryClient } from '@tanstack/svelte-query'
import { createClient, deleteClient, updateClient } from './query-builders'
import type { ClientFormData } from './types'

export interface ClientsDeps {
  queryClient: QueryClient
}

export function createClientsService(deps: ClientsDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getClientList'],
      exact: false
    })

  const handleCreate = async (data: ClientFormData) => {
    const action = createClient()
    await action.request({
      institutionId: requireInstitutionId(),
      payload: data
    })
    snackbarStore.success('내담자가 등록되었습니다.')
    invalidateList()
  }

  const handleUpdate = async (
    clientId: string,
    data: Partial<ClientFormData> & { status?: string }
  ) => {
    const action = updateClient()
    await action.request({
      institutionId: requireInstitutionId(),
      clientId,
      payload: data
    })
    snackbarStore.success('내담자 정보가 수정되었습니다.')
    invalidateList()
  }

  const handleDelete = async (clientId: string) => {
    const action = deleteClient()
    await action.request({
      institutionId: requireInstitutionId(),
      clientId
    })
    snackbarStore.success('내담자가 삭제되었습니다.')
    invalidateList()
  }

  return { handleCreate, handleUpdate, handleDelete, invalidateList }
}
