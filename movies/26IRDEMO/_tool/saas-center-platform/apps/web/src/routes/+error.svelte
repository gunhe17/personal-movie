<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  const is404 = $derived(page.status === 404)
  const title = $derived(is404 ? '페이지를 찾을 수 없어요' : '문제가 생겼어요')
  const desc = $derived(
    is404
      ? '주소가 바뀌었거나 없는 페이지예요. 접근 권한이 없는 화면일 수도 있어요.'
      : (page.error?.message ?? '잠시 후 다시 시도해주세요.')
  )
</script>

<div
  class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
>
  <p class="text-headline-01-normal-semibold text-gray-900">{title}</p>
  <p class="max-w-md text-body-01-normal-regular text-gray-500">{desc}</p>
  <div class="mt-2 flex gap-2">
    <button
      class="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
      onclick={() => history.back()}
    >
      이전으로
    </button>
    <button
      class="rounded-lg bg-primary-500 px-5 py-2.5 text-body-01-normal-medium text-white hover:bg-primary-600"
      onclick={() => goto('/dashboard')}
    >
      대시보드로 가기
    </button>
  </div>
</div>
