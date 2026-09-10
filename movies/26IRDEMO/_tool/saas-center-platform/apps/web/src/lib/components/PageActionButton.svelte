<script lang="ts">
  /**
   * PageActionButton — 페이지 우상단 메인 CTA (등록·추가 등).
   *
   * MD Title 사이즈 primary 버튼 규격을 고정한다:
   * 높이 44 · 패딩 좌우 20 · radius 8 · bg primary-500 / hover primary-600 ·
   * 보더 없음(Solid) · 아이콘 20(PlusWhiteIcon20) · 아이콘–텍스트 gap 8 ·
   * 레이블 Body_01(16) Medium 흰색. Disabled bg primary-200 · 텍스트 primary-300.
   *
   * 페이지는 label(+ onclick)만 넘긴다. 전 페이지 CTA가 이걸로 통일된다.
   */
  import Typography from '@common/components/Typography.svelte'
  import PlusWhiteIcon20 from '$lib/assets/PlusWhiteIcon20.svelte'

  let {
    label,
    onclick,
    disabled = false,
    /** 플러스 아이콘 표시 (기본 true) */
    icon = true,
    type = 'button',
    class: className = ''
  }: {
    label: string
    onclick?: (e: MouseEvent) => void
    disabled?: boolean
    icon?: boolean
    type?: 'button' | 'submit'
    class?: string
  } = $props()
</script>

<button
  {type}
  {onclick}
  {disabled}
  class="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-5 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-action-primary-disabled {className}"
>
  {#if icon}
    <PlusWhiteIcon20 />
  {/if}
  <Typography variant="body-01-medium" color="text-white">
    {label}
  </Typography>
</button>
