import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { centerStore } from '$lib/stores/center.store'
import { get } from 'svelte/store'
import { postSupportInquiry } from '$lib/hooks/actions/support.action'
import InquiryModal from '$lib/components/modal/InquiryModal.svelte'
import { INQUIRY_TYPE_MAP } from './constants'
import type { CreateQueryResult, QueryClient } from '@tanstack/svelte-query'

export interface SupportServiceDeps {
  meQuery: CreateQueryResult<any, any>
  queryClient: QueryClient
}

export function createSupportService(deps: SupportServiceDeps) {
  const { meQuery, queryClient } = deps
  const inquiryAction = postSupportInquiry()

  const openInquiryModal = () => {
    modalStore.open({
      component: InquiryModal,
      props: {
        onSubmit: async (data: { type: string; content: string }) => {
          const me = meQuery.data ?? (await meQuery.refetch()).data
          if (!me?.person || !me?.account) {
            snackbarStore.error('로그인 정보를 불러올 수 없습니다.')
            return
          }
          const { currentCenterId, centers } = get(centerStore)
          const currentCenter = centers.find((c) => c.id === currentCenterId)
          await inquiryAction.request({
            inquiry_type: INQUIRY_TYPE_MAP[data.type] ?? 'general',
            subject: `[${data.type}] 1:1 문의`,
            content: data.content,
            sender_name: me.person.name,
            sender_email: me.account.email,
            center_id: currentCenter?.id ?? null,
            center_name: currentCenter?.name ?? null
          })
          snackbarStore.success('문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.')
          queryClient.invalidateQueries({ queryKey: ['getMyInquiryList'], exact: false })
        }
      },
      options: { customWidth: 640, customHeight: 430 }
    })
  }

  return { openInquiryModal }
}
