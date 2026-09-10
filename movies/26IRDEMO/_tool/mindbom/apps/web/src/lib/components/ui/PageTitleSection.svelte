<script lang="ts">
  /**
   * PageTitleSection — 페이지 최상단 XL 타이틀 영역.
   *
   * Web_Design.md §Title system: XL 타이틀 영역 높이 44 고정, 아래 콘텐츠와 gap 16.
   * shrink-0이 필수다 — 세로 flex 안에서 아래 콘텐츠가 공간을 더 요구하면
   * shrink 기본값(1) 때문에 44 미만으로 눌린다.
   */
  import type { Snippet } from 'svelte'
  import { twMerge } from 'tailwind-merge'

  interface Props {
    title: string
    /** 타이틀 아래 한 줄 설명 (있으면 영역 높이가 늘어난다) */
    description?: string
    /** 우상단 액션 (등록 버튼 등) */
    actions?: Snippet
    class?: string
  }

  let { title, description, actions, class: className = '' }: Props = $props()
</script>

<div
  class={twMerge(
    'mb-4 flex min-h-11 shrink-0 items-center justify-between gap-3',
    className
  )}
>
  <div class="min-w-0">
    <h1 class="truncate text-headline-01-normal-semibold text-gray-900">{title}</h1>
    {#if description}
      <!--
        reading(line-height 150%)을 쓴다 — normal은 line-height가 글자 크기와
        같아(14px) 위아래 여백이 0이라 제목에 붙어 보인다. 대시보드 헤더도 같은 값.
        간격을 넓히려고 mt를 키우면 타이틀 영역 높이(44)가 흔들리므로 행간으로 준다.
      -->
      <p class="mt-1 text-body-03-reading-regular text-gray-500">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
