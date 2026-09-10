<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { createSubscriptionService } from '$lib/features/subscription/subscription-service'

  const queryClient = useQueryClient()
  const service = createSubscriptionService({ queryClient })

  let status = $state<'loading' | 'success' | 'error'>('loading')
  let errorMessage = $state('')

  onMount(async () => {
    const params = $page.url.searchParams
    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = params.get('amount')

    if (!paymentKey || !orderId || !amount) {
      status = 'error'
      errorMessage = '결제 정보가 올바르지 않습니다.'
      return
    }

    const ok = await service.handleConfirmUpgrade(
      paymentKey,
      orderId,
      Number(amount)
    )

    if (ok) {
      status = 'success'
      setTimeout(() => goto('/subscription'), 2000)
    } else {
      status = 'error'
      errorMessage = '결제 확인에 실패했습니다. 고객센터에 문의해 주세요.'
    }
  })
</script>

<div class="flex min-h-[60vh] items-center justify-center">
  <div
    class="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center"
  >
    {#if status === 'loading'}
      <div
        class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary-500"
      ></div>
      <p class="text-body-01-normal-medium text-gray-700">
        결제를 확인하고 있습니다...
      </p>
    {:else if status === 'success'}
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"
      >
        <svg
          class="h-7 w-7 text-green-600"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 class="text-title-01-normal-semibold text-gray-900 mb-2">
        결제가 완료되었습니다
      </h2>
      <p class="text-body-02-normal-regular text-gray-500">
        플랜이 즉시 적용되었습니다. 잠시 후 구독 페이지로 이동합니다.
      </p>
    {:else}
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100"
      >
        <svg
          class="h-7 w-7 text-red-600"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 class="text-title-01-normal-semibold text-gray-900 mb-2">
        결제 확인 실패
      </h2>
      <p class="text-body-02-normal-regular text-gray-500 mb-6">
        {errorMessage}
      </p>
      <button
        class="rounded-lg bg-primary-500 px-6 py-2.5 text-body-02-normal-medium text-white hover:bg-primary-400 transition"
        onclick={() => goto('/subscription')}
      >
        구독 페이지로 돌아가기
      </button>
    {/if}
  </div>
</div>
