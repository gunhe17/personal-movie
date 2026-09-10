import { t, josa } from '$lib/ontology/terms'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  deleteClient,
  postClientTransition
} from '$lib/hooks/actions/client.action'
import { requireCenterId } from '$lib/stores/center.store'
import { snackbarStore } from '$lib/stores/snackbar'
import { modalUtils } from '$lib/stores/modal'

export interface ClientsDeps {
  queryClient: QueryClient
}

const rowId = (row: any) => row?.uid || row?.id || ''

export function createClientsService(deps: ClientsDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getClientList'],
      exact: false
    })

  /** 목록 캐시(테이블 페이지 + 카드 무한스크롤)에서 해당 행의 status만 갈아끼운다 */
  const patchStatusInCache = (clientId: string, status: string) => {
    const patchItems = (items: unknown) =>
      Array.isArray(items)
        ? items.map((it: any) =>
            rowId(it) === clientId ? { ...it, status } : it
          )
        : items

    queryClient.setQueriesData(
      { queryKey: ['getClientList'], exact: false },
      (old: any) => {
        if (!old) return old
        if (Array.isArray(old.pages)) {
          return {
            ...old,
            pages: old.pages.map((p: any) => ({
              ...p,
              items: patchItems(p?.items)
            }))
          }
        }
        if (Array.isArray(old.items)) {
          return { ...old, items: patchItems(old.items) }
        }
        return old
      }
    )
  }

  const STATUS_LABEL = { active: '활성화', inactive: '비활성화' } as const

  /**
   * 전이 + 목록 캐시 반영만. 스낵바는 호출자가 정한다 —
   * 되돌리기가 changeStatus를 다시 부르면 되돌리기 스낵바가 무한히 이어진다.
   */
  const applyStatus = async (clientId: string, next: 'active' | 'inactive') => {
    await postClientTransition().request({
      centerId: requireCenterId(),
      clientId,
      status: next
    })
    // 목록 재조회 대신 제자리 갱신 — 행이 즉시 목록 끝으로 밀려 "사라진 것처럼" 보이지 않게
    // 표시(토글·딤드)만 바꾸고 위치는 그대로 둔다.
    patchStatusInCache(clientId, next)
    // 재조회는 하지 않고 stale 표시만 — 새로고침·재진입 시 서버 정렬(활성 먼저)로 맨 뒤로 간다.
    queryClient.invalidateQueries({
      queryKey: ['getClientList'],
      exact: false,
      refetchType: 'none'
    })
  }

  const changeStatus = async (
    clientId: string,
    status: string,
    clientName?: string
  ) => {
    const next =
      String(status).toLowerCase() === 'active' ? 'active' : 'inactive'
    const prev = next === 'active' ? 'inactive' : 'active'
    // 누구를 어떻게 바꿨는지 문장에 담는다 — 목록에서 여러 행을 연달아 토글하면
    // "상태가 변경되었습니다"만으로는 방금 무엇을 건드렸는지 되짚을 수 없다.
    // 이름을 못 받았으면(호출자가 안 넘김) 주어를 빼고 상태만 말한다.
    const subject = clientName ? `${josa(clientName, '을/를')} ` : ''
    try {
      await applyStatus(clientId, next)
      snackbarStore.undoable(
        `${subject}${STATUS_LABEL[next]}했어요`,
        async () => {
          try {
            await applyStatus(clientId, prev)
            snackbarStore.success(`${subject}${STATUS_LABEL[prev]}했어요`)
          } catch {
            snackbarStore.error('되돌리기에 실패했습니다.')
          }
        }
      )
    } catch {
      snackbarStore.error('상태 변경에 실패했습니다.')
    }
  }

  const removeClient = async (clientId: string, clientName?: string) => {
    const confirmed = await modalUtils.confirm(
      `${clientName ? `'${clientName}' ` : ''}${josa(t('subject'), '을/를')} 삭제하시겠어요?`,
      `${t('subject')} 삭제`,
      {
        description: '삭제 후에는 목록에서 사라집니다.',
        confirmText: '삭제',
        type: 'danger'
      }
    )
    if (!confirmed) return
    try {
      await deleteClient().request({
        centerId: requireCenterId(),
        clientId
      })
      snackbarStore.success(`${josa(t('subject'), '이/가')} 삭제되었습니다.`)
      invalidateList()
    } catch {
      snackbarStore.error(`${t('subject')} 삭제에 실패했습니다.`)
    }
  }

  return {
    changeStatus,
    deleteClient: removeClient,
    invalidateList
  }
}
