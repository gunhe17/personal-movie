<!--
  CertifiedExpertBadge
  인증된 심리 전문가 배지 (파란색 원 + MindScope 심볼 로고).
  메인 컬러는 web primary 톤. Admin 동일 디자인.

  정책: 자격증 1개 이상 verified AND 학력 1개 이상 verified
  → 본인 myInfo에서는 credentials 배열로 직접 판정 가능 (computeIsCertified)
  → 외부 노출에서는 백엔드가 is_certified 플래그를 응답에 포함

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
      ? { wrapper: 'h-5 w-5 text-xs', text: 'text-caption-01-normal-medium' }
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
    <!-- MindScope 심볼 로고 -->
    <svg
      class="relative {size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'}"
      viewBox="0 0 19 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.72048 17.3082V13.9252C3.97307 13.2434 3.39284 12.4468 2.97979 11.5355C2.56675 10.6241 2.36023 9.66365 2.36023 8.65399C2.36023 6.68711 3.04864 5.01527 4.42545 3.63846C5.80226 2.26165 7.4741 1.57324 9.44097 1.57324C11.08 1.57324 12.5322 2.05513 13.7976 3.01889C15.063 3.98266 15.8858 5.23818 16.266 6.78546L17.2888 10.8175C17.3544 11.0667 17.3085 11.2929 17.1511 11.4961C16.9938 11.6994 16.784 11.801 16.5217 11.801H14.9482V14.1612C14.9482 14.5939 14.7941 14.9644 14.486 15.2725C14.1779 15.5807 13.8074 15.7347 13.3747 15.7347H11.8012V17.3082H4.72048ZM7.4741 11.801C8.02483 11.801 8.49032 11.6109 8.87058 11.2306L12.0176 8.08359C12.3978 7.70333 12.588 7.23784 12.588 6.68711C12.588 6.13639 12.3978 5.6709 12.0176 5.29063C11.6373 4.91037 11.1718 4.72024 10.6211 4.72024C10.0704 4.72024 9.60488 4.91037 9.22462 5.29063C8.73946 5.12017 8.26085 5.08083 7.7888 5.17262C7.31675 5.26441 6.91682 5.47421 6.58901 5.80202C6.2612 6.12983 6.0514 6.52976 5.95961 7.00181C5.86782 7.47386 5.90716 7.95247 6.07762 8.43763C5.69736 8.81789 5.50723 9.28339 5.50723 9.83411C5.50723 10.3848 5.69736 10.8503 6.07762 11.2306C6.45788 11.6109 6.92338 11.801 7.4741 11.801Z"
        fill="white"
      />
    </svg>
  </span>
  {#if !iconOnly}
    <span class={sizeClass.text}>인증된 전문가</span>
  {/if}
</span>
