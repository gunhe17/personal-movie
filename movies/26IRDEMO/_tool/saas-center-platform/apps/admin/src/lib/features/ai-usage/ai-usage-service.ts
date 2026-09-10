import { modalStore } from '$stores/modal'
import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
import CreditRateModal from '$components/modal/CreditRateModal.svelte'
import { putCreditRateConfig } from '$hooks/actions/ai-usage.action'
import type { QueryClient } from '@tanstack/svelte-query'

export interface AiUsageDeps {
  queryClient: QueryClient
}

export function createAiUsageService({ queryClient }: AiUsageDeps) {
  const invalidateRate = () =>
    queryClient.invalidateQueries({ queryKey: ['getCreditRateConfig'], exact: false })

  const openChangeRate = (currentRate: number | null) => {
    modalStore.open({
      component: CreditRateModal,
      props: {
        currentRate,
        onConfirm: async (rate: number, reason: string) => {
          try {
            await putCreditRateConfig().request({ tokens_per_credit: rate, reason })
            showSuccessSnackbar('토큰/크레딧 비율이 변경되었습니다.')
            invalidateRate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        },
      },
      options: { size: 'md' },
    })
  }

  return { openChangeRate }
}
