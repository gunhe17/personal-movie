<script lang="ts">
  import type { Component } from 'svelte'
  import { page } from '$app/state'
  import Typography from '@common/components/Typography.svelte'
  import { getTitleIcon } from '$lib/config/title-icon'
  import { twMerge } from 'tailwind-merge'

  interface Props {
    title?: string
    /**
     * 타이틀 좌측 아이콘. 기본은 **현재 경로로 자동 해소**된다
     * (`config/title-icon.ts` = GNB 메뉴 구조가 정본).
     * 등록 경로가 아니면 아이콘 없음 — 상세·하위 화면은 자동으로 빠진다.
     */
    icon?: Component
    className?: string
  }

  let { title = '타이틀', icon, className = '' }: Props = $props()

  const Icon = $derived(icon ?? getTitleIcon(page.url.pathname))
</script>

<!-- svelte-ignore slot_element_deprecated -->
<!--
  XL 타이틀 영역 = 높이 44 고정 (Web_Design.md §Title system).
  shrink-0 필수 — 세로 flex 안에서 아래 콘텐츠가 공간을 더 요구하면
  shrink 기본값(1) 때문에 44 미만으로 눌린다(선언 높이가 최댓값이 돼버림).
-->
<div
  class={twMerge(
    'flex min-h-11 shrink-0 items-center justify-between',
    className
  )}
>
  <div class="flex items-center gap-2">
    {#if Icon}
      <Icon />
    {/if}
    <Typography variant="headline-01-normal-semibold">
      {title}
    </Typography>
  </div>
  <slot name="extraBtn" />
</div>
