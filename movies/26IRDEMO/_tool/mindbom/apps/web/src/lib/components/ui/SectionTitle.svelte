<script lang="ts">
  /**
   * SectionTitle — 카드 안 섹션 제목 줄.
   *
   * 정본 §반복 패턴 "섹션 타이틀 행":
   *   headline-02(20 SemiBold) + gap 4~6 + 카운트 body-03(14 Regular, gray-500)
   *   같은 줄, 아래 콘텐츠와 gap 12.
   *
   * 아래 gap(12)은 이 컴포넌트가 mb-3으로 책임진다 — 쓰는 쪽에서 매번
   * 다른 값을 주다 보면 화면마다 섹션 간격이 갈린다.
   */
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    /** 제목 옆 카운트 (예: '총 12건') */
    count?: string
    /** 제목 아래 한 줄 설명 */
    description?: string
    /** 우측 컨트롤 */
    actions?: Snippet
    class?: string
  }

  let {
    title,
    count,
    description,
    actions,
    class: className = ''
  }: Props = $props()
</script>

<div class="mb-3 flex items-start justify-between gap-3 {className}">
  <div class="min-w-0">
    <div class="flex items-baseline gap-1.5">
      <h2 class="text-headline-02-normal-semibold text-gray-900">{title}</h2>
      {#if count}
        <span class="text-body-03-normal-regular text-gray-500">{count}</span>
      {/if}
    </div>
    {#if description}
      <p class="mt-1 text-body-03-normal-regular text-gray-500">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
