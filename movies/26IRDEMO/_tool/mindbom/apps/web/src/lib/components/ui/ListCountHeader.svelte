<script lang="ts">
  /**
   * ListCountHeader — 리스트 위의 "총 N건" 줄.
   *
   * 정본 §반복 패턴: 영역 높이 44 고정(텍스트 수직 중앙), 아래 콘텐츠와 gap 4,
   * 강조색·볼드 없이 단일 톤. 우측에는 뷰 전환 등 리스트 스코프 컨트롤이 온다.
   */
  import type { Snippet } from 'svelte'

  interface Props {
    total: number
    /** 세는 단위 — '건' · '명' 등 */
    unit?: string
    /** 총계 옆 부가 라벨 (예: '내 담당') */
    scopeLabel?: string
    /** 우측 컨트롤 (뷰 토글 등) */
    actions?: Snippet
  }

  let { total, unit = '건', scopeLabel, actions }: Props = $props()
</script>

<div class="mb-1 flex h-11 shrink-0 items-center justify-between gap-3">
  <div class="flex items-baseline gap-2">
    <span class="text-body-01-normal-regular text-gray-700">
      총 {total.toLocaleString()}{unit}
    </span>
    {#if scopeLabel}
      <span class="text-body-03-normal-regular text-gray-400">{scopeLabel}</span>
    {/if}
  </div>
  {#if actions}
    <div class="flex items-center gap-3">
      {@render actions()}
    </div>
  {/if}
</div>
