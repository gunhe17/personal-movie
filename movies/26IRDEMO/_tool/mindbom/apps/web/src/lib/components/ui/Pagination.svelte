<script lang="ts">
  import Icon from './Icon.svelte'

  let { page = 1, totalPages = 1, onPageChange }: {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
  } = $props()

  let pages = $derived(getVisiblePages(page, totalPages))

  /** 항상 7칸 슬롯: 양 끝과 1칸 차이만 나는 경우엔 ellipsis 대신 숫자를 그대로 노출 */
  function getVisiblePages(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total]
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    }
    return [1, '...', current - 1, current, current + 1, '...', total]
  }

  const navBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white'

  const pageBase =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors'
</script>

<nav aria-label="페이지네이션" class="flex items-center justify-center gap-1.5">
  <button
    type="button"
    aria-label="이전 페이지"
    disabled={page <= 1}
    onclick={() => onPageChange(page - 1)}
    class={navBtn}
  >
    <Icon name="chevron_left" size="sm" />
  </button>

  {#each pages as p}
    {#if p === '...'}
      <span class="inline-flex h-9 w-9 items-center justify-center text-sm text-gray-400">…</span>
    {:else}
      <button
        type="button"
        aria-current={p === page ? 'page' : undefined}
        onclick={() => onPageChange(p)}
        class="{pageBase} {p === page
          ? 'border-primary-600 bg-primary-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
      >
        {p}
      </button>
    {/if}
  {/each}

  <button
    type="button"
    aria-label="다음 페이지"
    disabled={page >= totalPages}
    onclick={() => onPageChange(page + 1)}
    class={navBtn}
  >
    <Icon name="chevron_right" size="sm" />
  </button>
</nav>
