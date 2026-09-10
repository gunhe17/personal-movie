import type { QueryClient } from '@tanstack/svelte-query'
import { deleteFieldNote } from '$lib/hooks/actions/field-note.action'
import { requireCenterId } from '$lib/stores/center.store'
import { snackbarStore } from '$lib/stores/snackbar'

export interface FieldNotesDeps {
  queryClient: QueryClient
}

export function createFieldNotesService(deps: FieldNotesDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getFieldNoteList'],
      exact: false
    })

  const remove = async (fieldNoteId: string) => {
    if (!confirm('이 필드노트를 삭제하시겠습니까?')) return
    try {
      await deleteFieldNote().request({
        centerId: requireCenterId(),
        fieldNoteId
      })
      snackbarStore.success('삭제되었습니다.')
      invalidateList()
    } catch {
      snackbarStore.error('삭제에 실패했습니다.')
    }
  }

  return {
    remove,
    invalidateList
  }
}
