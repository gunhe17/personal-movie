<script lang="ts">
  /**
   * MemberChip — 담당자 선택 칩
   *
   * 3가지 상태:
   *  1. unactive  — 회색 테두리, 회색 텍스트
   *  2. selected  — 파란 테두리, 왕관 아이콘 슬라이드-인
   *  3. primary   — 주황 테두리, 주황 왕관 (대표)
   *
   * 클릭 영역:
   *  - 이름 영역 → onclick (선택/해제)
   *  - 왕관 영역 (w-[36px] x h-[48px]) → oncrownclick (대표 지정)
   */

  import CrownActiveYellowIcon20 from '$lib/assets/CrownActiveYellowIcon20.svelte'
  import CrownInactiveGrayIcon20 from '$lib/assets/CrownInactiveGrayIcon20.svelte'

  interface Props {
    name: string
    selected?: boolean
    primary?: boolean
    onclick: () => void
    /** 왕관 영역 클릭 (대표 지정). 없으면 왕관도 onclick으로 동작. */
    oncrownclick?: () => void
    /** 대표 상태 왕관 툴팁 (예: "대표(주 치료사)"). 기본: "대표". */
    primaryLabel?: string
    /** 선택(비대표) 상태 왕관 툴팁 (예: "보조 치료사"). 기본: "보조". */
    selectedLabel?: string
  }

  let {
    name,
    selected = false,
    primary = false,
    onclick,
    oncrownclick,
    primaryLabel = '대표',
    selectedLabel = '보조'
  }: Props = $props()

  const active = $derived(selected || primary)
</script>

<!--
  🔴 선택 칩 기준 규격 — 높이 48 · **radius 8**(한 줄로 끝나는 칩) · 좌우 20 ·
  레이블 Body_02/Normal-Regular(15) · text-body-default **전 상태 공통**.
  선택·대표는 면(bg)과 보더가 말한다 — 글자색을 상태마다 바꾸지 않는다.
  장소 칩(SelectableButtonGroup)이 이 값을 따라온다. 같은 폼 안에서 같은
  "고르는 칩"이라 규격이 갈리면 안 된다 — 바꿀 때는 두 컴포넌트를 함께 바꾼다.
  (§button 사다리는 radius 8 · Large 48→16을 말하지만, 이 칩 쌍은 시안 판단으로
  12·14를 쓴다. 2026-09-02 사용자 결정.)
  대표(primary)의 골드만 이 컴포넌트 고유 상태다.
-->
<div
  class="member-chip flex h-12 items-center overflow-hidden rounded-lg border transition-all duration-300 ease-out
    {primary
    ? 'border-amber-400 bg-amber-50'
    : active
      ? 'border-border-active bg-brand-subtle'
      : 'border-border-default bg-white hover:bg-gray-50'}"
>
  <!-- Name area (선택/해제) -->
  <button
    type="button"
    {onclick}
    class="h-full whitespace-nowrap px-5 text-body-02-normal-regular text-body-default cursor-pointer"
  >
    {name}
  </button>

  <!-- Crown section (animated): 36x48 -->
  <div
    class="flex h-full items-center overflow-hidden transition-all duration-300 ease-out
      {active ? 'max-w-[36px] opacity-100' : 'max-w-0 opacity-0'}"
  >
    <!-- Divider (높이 꽉 채움) -->
    <div
      class="h-full w-px shrink-0 transition-colors duration-300
        {primary ? 'bg-amber-200/50' : 'bg-action-primary-subtle'}"
    ></div>
    <!-- Crown icon area (대표 지정) -->
    <button
      type="button"
      title={primary ? primaryLabel : selectedLabel}
      aria-label={primary ? primaryLabel : selectedLabel}
      onclick={(e) => {
        e.stopPropagation()
        oncrownclick ? oncrownclick() : onclick()
      }}
      class="flex h-full w-[35px] shrink-0 cursor-pointer items-center justify-center"
    >
      {#if primary}
        <CrownActiveYellowIcon20 />
      {:else}
        <CrownInactiveGrayIcon20 />
      {/if}
    </button>
  </div>
</div>
