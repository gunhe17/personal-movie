<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'

  const errorCode = $derived($page.url.searchParams.get('code') ?? '')
  const errorMessage = $derived(
    $page.url.searchParams.get('message') ?? '결제가 취소되었거나 실패했습니다.'
  )
  const failedAmount = $derived($page.url.searchParams.get('amount') ?? '')
  const failedPlan = $derived($page.url.searchParams.get('plan') ?? '')

  // 에러 코드별 사용자 친화적 안내
  interface ErrorGuide {
    title: string
    description: string
    suggestion: string
  }

  const ERROR_GUIDES: Record<string, ErrorGuide> = {
    PAY_PROCESS_CANCELED: {
      title: '결제가 취소되었습니다',
      description: '결제 창에서 취소 버튼을 누르셨거나 결제가 중단되었습니다.',
      suggestion: '다시 시도하시면 결제를 진행할 수 있습니다.'
    },
    USER_CANCEL: {
      title: '결제가 취소되었습니다',
      description: '결제 진행 중 취소하셨습니다.',
      suggestion: '준비가 되시면 다시 시도해 주세요.'
    },
    CARD_LIMIT_EXCEEDED: {
      title: '카드 한도 초과',
      description: '사용 중인 카드의 결제 한도를 초과했습니다.',
      suggestion: '다른 카드를 사용하거나 카드사에 한도 증액을 요청해 주세요.'
    },
    CARD_DECLINED: {
      title: '카드 승인 거절',
      description: '카드사에서 결제를 승인하지 않았습니다.',
      suggestion: '카드 정보를 확인하시거나 다른 카드를 사용해 주세요.'
    },
    INVALID_CARD_NUMBER: {
      title: '잘못된 카드 정보',
      description: '입력하신 카드 번호가 올바르지 않습니다.',
      suggestion: '카드 번호를 다시 확인하고 정확히 입력해 주세요.'
    },
    EXPIRED_CARD: {
      title: '만료된 카드',
      description: '사용 중인 카드의 유효기간이 만료되었습니다.',
      suggestion: '유효기간이 남아있는 카드로 다시 시도해 주세요.'
    },
    INSUFFICIENT_BALANCE: {
      title: '잔액 부족',
      description: '결제 계좌의 잔액이 부족합니다.',
      suggestion: '잔액을 확인하시거나 다른 결제 수단을 이용해 주세요.'
    }
  }

  const guide = $derived(ERROR_GUIDES[errorCode] ?? null)
  const isUserCancel = $derived(
    errorCode === 'PAY_PROCESS_CANCELED' || errorCode === 'USER_CANCEL'
  )
</script>

<div class="flex min-h-[60vh] items-center justify-center px-4">
  <div class="w-full max-w-lg">
    <div class="rounded-2xl border border-gray-200 bg-white px-8 py-10">
      <!-- 아이콘 -->
      <div class="text-center mb-6">
        {#if isUserCancel}
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100"
          >
            <svg
              class="h-7 w-7 text-gray-500"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </div>
        {:else}
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-danger-bg"
          >
            <svg
              class="h-7 w-7 text-status-danger"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
        {/if}

        <h2 class="text-title-01-normal-semibold text-gray-900 mb-2">
          {guide?.title ?? '결제 실패'}
        </h2>
        <p class="text-body-02-normal-regular text-gray-500">
          {guide?.description ?? errorMessage}
        </p>
      </div>

      <!-- 결제 맥락 정보 -->
      {#if !isUserCancel && (failedAmount || failedPlan)}
        <div class="flex items-center justify-center gap-4 mb-5">
          {#if failedPlan}
            <div class="text-center">
              <p class="text-body-03-normal-regular text-gray-400 mb-0.5">
                플랜
              </p>
              <p class="text-body-02-normal-medium text-gray-700">
                {failedPlan}
              </p>
            </div>
          {/if}
          {#if failedAmount && failedPlan}
            <span class="h-6 w-px bg-gray-300"></span>
          {/if}
          {#if failedAmount}
            <div class="text-center">
              <p class="text-body-03-normal-regular text-gray-400 mb-0.5">
                결제 금액
              </p>
              <p class="text-body-02-normal-medium tabular-nums text-gray-700">
                {Number(failedAmount).toLocaleString()}원
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 안내 카드 -->
      {#if guide}
        <div class="rounded-lg bg-gray-50 px-4 py-3.5 mb-6">
          <div class="flex items-start gap-2.5">
            <svg
              class="h-4 w-4 text-primary-500 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
            <p class="text-body-02-normal-regular text-gray-600">
              {guide.suggestion}
            </p>
          </div>
        </div>
      {:else if errorCode}
        <div class="rounded-lg bg-gray-50 px-4 py-3 mb-6">
          <p class="text-body-03-normal-regular text-gray-400">
            오류 코드: <span class="font-mono text-gray-500">{errorCode}</span>
          </p>
          {#if errorMessage !== '결제가 취소되었거나 실패했습니다.'}
            <p class="text-body-03-normal-regular text-gray-500 mt-1">
              {errorMessage}
            </p>
          {/if}
        </div>
      {/if}

      <!-- 액션 버튼 -->
      <div class="space-y-2.5">
        <button
          class="w-full rounded-lg bg-primary-500 px-6 py-2.5 text-body-02-normal-medium text-white hover:bg-primary-400 transition"
          onclick={() => goto('/settings/subscription')}
        >
          {isUserCancel ? '구독 관리로 돌아가기' : '다시 시도'}
        </button>

        {#if !isUserCancel}
          <button
            class="w-full rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-body-02-normal-medium text-gray-700 hover:bg-gray-50 transition"
            onclick={() => goto('/settings/subscription')}
          >
            다른 결제 수단으로 시도
          </button>
        {/if}
      </div>
    </div>

    <!-- 하단 도움말 -->
    {#if !isUserCancel}
      <div class="mt-4 rounded-lg bg-gray-50 px-5 py-4">
        <p class="text-body-02-normal-medium text-gray-600 mb-2">
          결제에 문제가 계속되나요?
        </p>
        <ul class="space-y-1.5">
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-03-normal-regular text-gray-500">
              카드사 고객센터에서 온라인 결제 차단 여부를 확인해 주세요.
            </p>
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-03-normal-regular text-gray-500">
              다른 카드나 계좌이체를 이용하면 결제가 가능할 수 있습니다.
            </p>
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-03-normal-regular text-gray-500">
              문제가 지속되면 관리자에게 문의해 주세요.
            </p>
          </li>
        </ul>
      </div>
    {/if}
  </div>
</div>
