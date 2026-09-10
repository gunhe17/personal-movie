<script lang="ts">
  // 카드(그리드) 뷰 공용 "더보기" 버튼 — 보더·배경 없이 아이콘+레이블만.
  interface Props {
    onclick: () => void
    loading?: boolean
    label?: string
  }

  let { onclick, loading = false, label = '더보기' }: Props = $props()
</script>

<div class="flex justify-center pt-5 pb-4">
  <button
    type="button"
    {onclick}
    disabled={loading}
    class="text-body-02-normal-medium flex h-11 items-center gap-2 px-3 text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-60"
  >
    {loading ? '불러오는 중...' : label}
    <svg
      class="h-5 w-5 {loading ? '' : 'transition-transform'}"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 7.5L10 12.5L5 7.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</div>
