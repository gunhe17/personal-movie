<script lang="ts">
  import { goto } from '$app/navigation'
  import ArrowLeftIcon24 from '$lib/assets/ArrowLeftIcon24.svelte'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  function handleCancel() {
    goto('/welcome')
  }

  function handleCenterRegister() {
    goto('/welcome/register')
  }
</script>

<header
  class="flex h-16 items-center gap-2 border-b border-gray-100 bg-white px-4"
>
  <Tooltip text="뒤로가기">
    <button
      type="button"
      onclick={() => history.back()}
      class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50"
      aria-label="뒤로가기"
    >
      <ArrowLeftIcon24 />
    </button>
  </Tooltip>
  <MindScopeLogo />
</header>

<div
  class="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-gray-50 px-4 py-12"
>
  <div
    class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-10 shadow-sm"
  >
    <div class="flex flex-col items-center text-center">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
      >
        <svg
          class="h-8 w-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h1 class="mt-6 text-headline-01-normal-bold text-gray-900">
        회원 가입이 완료되었어요!
      </h1>
      <p class="mt-3 text-body-02-normal-regular text-gray-600">
        센터 정보를 등록하면 지금 바로 서비스를 이용할 수 있어요
      </p>
      <div class="mt-8 flex w-full gap-3">
        <button
          type="button"
          onclick={handleCancel}
          class="flex-1 rounded-lg border border-gray-200 bg-white py-3 text-body-02-normal-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onclick={handleCenterRegister}
          class="flex-1 rounded-lg bg-primary-600 py-3 text-body-02-normal-medium font-medium text-white hover:bg-primary-700"
        >
          센터 정보 입력
        </button>
      </div>
    </div>
  </div>
</div>
