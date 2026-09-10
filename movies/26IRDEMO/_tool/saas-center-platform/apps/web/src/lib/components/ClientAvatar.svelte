<script lang="ts">
  /**
   * 내담자 아바타 (프로필 이미지 + 성별 톤 이니셜 폴백)
   * ClientCard 의 아바타 패턴을 목록 셀 등 소형 표기에 재사용하기 위한 공용 컴포넌트.
   */
  interface Props {
    profileImageUrl?: string | null
    name?: string
    /** 'male' | 'female' 또는 'M'/'F' 등 성별 문자열 */
    gender?: string | null
    /** 컨테이너 크기 클래스 (기본 24px) */
    sizeClass?: string
    /** 이니셜 폰트 크기 클래스 */
    textClass?: string
  }

  let {
    profileImageUrl = null,
    name = '',
    gender = null,
    sizeClass = 'h-6 w-6',
    textClass = 'text-caption-01-normal-medium'
  }: Props = $props()

  let imgError = $state(false)
  $effect(() => {
    profileImageUrl
    imgError = false
  })

  const isMale = $derived(
    (gender ?? '').toString().toLowerCase().startsWith('m')
  )
  const initial = $derived((name ?? '').trim().charAt(0) || '?')
  const showImage = $derived(!!profileImageUrl && !imgError)
</script>

<span
  class="{sizeClass} shrink-0 overflow-hidden rounded-full flex items-center justify-center {isMale
    ? 'bg-blue-50'
    : 'bg-status-danger-bg'}"
>
  {#if showImage}
    <img
      src={profileImageUrl}
      alt=""
      class="w-full h-full object-cover"
      onerror={() => (imgError = true)}
    />
  {:else}
    <span
      class="font-semibold {textClass} {isMale
        ? 'text-blue-500'
        : 'text-status-danger'}"
    >
      {initial}
    </span>
  {/if}
</span>
