<script lang="ts">
  // 정렬·겹침 아이콘 (컨텍스트 메뉴 / 인스펙터 공용)
  let { id, class: cls = 'h-[18px] w-[18px]' }: { id: string; class?: string } =
    $props()
</script>

{#if id === 'left'}
  <svg viewBox="0 0 24 24" class={cls}>
    <path
      d="M4 4v16"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
    />
    <rect x="7" y="7" width="12" height="3.6" rx="1" fill="currentColor" />
    <rect x="7" y="13.4" width="8" height="3.6" rx="1" fill="currentColor" />
  </svg>
{:else if id === 'center'}
  <svg viewBox="0 0 24 24" class={cls}>
    <path
      d="M12 4v16"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
    />
    <rect x="6" y="7" width="12" height="3.6" rx="1" fill="currentColor" />
    <rect x="8" y="13.4" width="8" height="3.6" rx="1" fill="currentColor" />
  </svg>
{:else if id === 'right'}
  <svg viewBox="0 0 24 24" class={cls}>
    <path
      d="M20 4v16"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
    />
    <rect x="5" y="7" width="12" height="3.6" rx="1" fill="currentColor" />
    <rect x="9" y="13.4" width="8" height="3.6" rx="1" fill="currentColor" />
  </svg>
{:else if id === 'fill'}
  <svg
    viewBox="0 0 24 24"
    class={cls}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
  </svg>
{:else if id === 'front'}
  <svg
    viewBox="0 0 24 24"
    class={cls}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 11l7-6 7 6M5 18l7-6 7 6" />
  </svg>
{:else if id === 'fwd'}
  <svg
    viewBox="0 0 24 24"
    class={cls}
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 15l7-7 7 7" />
  </svg>
{:else if id === 'back'}
  <svg
    viewBox="0 0 24 24"
    class={cls}
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M19 9l-7 7-7-7" />
  </svg>
{:else if id === 'rear'}
  <svg
    viewBox="0 0 24 24"
    class={cls}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 13l7 6 7-6M5 6l7 6 7-6" />
  </svg>
{/if}
