<script lang="ts">
  // 근거 회기 — 리포트의 모든 주장 뒤에 붙는 신뢰 장치.
  // 옛 포맷 분석에는 근거가 없어 sessions가 비고, 그때는 아무것도 그리지 않는다.
  import { goto } from '$app/navigation'

  let {
    sessions,
    label = '근거',
    onSelect
  }: {
    sessions: number[]
    label?: string | null
    onSelect?: (session: number) => void
  } = $props()
</script>

{#if sessions.length > 0}
  <span class="inline-flex flex-wrap items-center gap-1">
    {#if label}
      <span class="text-body-03-normal-regular text-body-subtle">{label}</span>
    {/if}
    {#each sessions as s, i}
      <button
        type="button"
        onclick={() => onSelect?.(s)}
        class="text-body-03-normal-medium text-primary-500 hover:underline"
      >
        {s}회기
      </button>
      {#if i < sessions.length - 1}
        <span class="text-body-03-normal-regular text-caption-subtle">·</span>
      {/if}
    {/each}
  </span>
{/if}
