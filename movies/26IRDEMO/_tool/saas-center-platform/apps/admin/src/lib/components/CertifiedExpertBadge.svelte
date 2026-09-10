<!--
  CertifiedExpertBadge
  인증된 심리 전문가 배지 (파란색 원 + Ψ Psi 그리스 문자).
  메인 컬러는 web primary (#256ef4 ≈ blue-600) 톤.

  정책: 자격증 1개 이상 verified AND 학력 1개 이상 verified
  → 백엔드 AccountCredentialStats.is_certified 값으로 결정

  사용 예:
    <CertifiedExpertBadge />
    <CertifiedExpertBadge size="md" />
    <CertifiedExpertBadge size="sm" iconOnly />
-->
<script lang="ts">
  interface Props {
    /** 표시 크기 */
    size?: 'sm' | 'md'
    /** 라벨 숨기고 아이콘만 (좁은 공간용) */
    iconOnly?: boolean
    /** 호버 툴팁 텍스트 */
    title?: string
  }

  let {
    size = 'md',
    iconOnly = false,
    title = '인증된 심리 전문가'
  }: Props = $props()

  const sizeClass = $derived(
    size === 'sm'
      ? { wrapper: 'h-5 w-5 text-xs', text: 'text-[11px]' }
      : { wrapper: 'h-6 w-6 text-sm', text: 'text-xs' }
  )
</script>

<span
  class="inline-flex items-center gap-1.5 font-medium bg-linear-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent"
  {title}
>
  <span
    class="{sizeClass.wrapper} inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 via-blue-600 to-sky-600 shadow-md shadow-blue-500/30 ring-1 ring-blue-300/60 relative overflow-hidden"
  >
    <!-- 광택 (상단 highlight) -->
    <span
      class="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/30 to-transparent"
    ></span>
    <!-- Ψ Psi (그리스 문자 — 심리학 상징) -->
    <span class="relative leading-none font-serif text-white"> Ψ </span>
  </span>
  {#if !iconOnly}
    <span class={sizeClass.text}>인증된 전문가</span>
  {/if}
</span>
