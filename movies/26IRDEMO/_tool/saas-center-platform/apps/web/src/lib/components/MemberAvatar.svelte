<script lang="ts">
  /**
   * 구성원 아바타 (프로필 이미지 → 성별 상담사 일러스트 → 이니셜)
   * MemberCard·구성원 상세의 아바타 규칙을 목록 셀 등 소형 표기에 재사용한다.
   * 내담자는 ClientAvatar(이니셜 폴백)를 쓴다 — 폴백 규칙이 다르므로 컴포넌트를 나눈다.
   */
  import counselorMaleAvatar from '$lib/assets/counselor_male.png'
  import counselorFemaleAvatar from '$lib/assets/counselor_female.png'

  interface Props {
    profileImageUrl?: string | null
    name?: string
    /** 'male' | 'female' 또는 'M'/'F'/'남'/'여' 등 성별 문자열 */
    gender?: string | null
    /** 컨테이너 크기 클래스 (기본 40px) */
    sizeClass?: string
    /** 이니셜 폰트 크기 클래스 */
    textClass?: string
  }

  let {
    profileImageUrl = null,
    name = '',
    gender = null,
    sizeClass = 'h-10 w-10',
    textClass = 'text-[15px]'
  }: Props = $props()

  let imgError = $state(false)
  $effect(() => {
    profileImageUrl
    imgError = false
  })

  const genderNorm = $derived.by<'male' | 'female' | null>(() => {
    const g = (gender ?? '').toString().toLowerCase()
    if (['male', 'm', '남', '남자'].includes(g)) return 'male'
    if (['female', 'f', '여', '여자'].includes(g)) return 'female'
    return null
  })
  const counselorAvatar = $derived(
    genderNorm === 'male'
      ? counselorMaleAvatar
      : genderNorm === 'female'
        ? counselorFemaleAvatar
        : null
  )
  const avatarBg = $derived(
    genderNorm === 'male'
      ? 'bg-blue-50'
      : genderNorm === 'female'
        ? 'bg-status-danger-bg'
        : 'bg-gray-100'
  )
  const avatarFg = $derived(
    genderNorm === 'male'
      ? 'text-blue-500'
      : genderNorm === 'female'
        ? 'text-status-danger'
        : 'text-gray-500'
  )
  const showImage = $derived(!!profileImageUrl && !imgError)
  const initial = $derived((name ?? '').trim().charAt(0) || '?')
</script>

<span
  class="{sizeClass} shrink-0 overflow-hidden rounded-full flex items-center justify-center {showImage ||
  counselorAvatar
    ? ''
    : avatarBg}"
>
  {#if showImage}
    <img
      src={profileImageUrl}
      alt=""
      class="h-full w-full object-cover"
      onerror={() => (imgError = true)}
    />
  {:else if counselorAvatar}
    <img src={counselorAvatar} alt="" class="h-full w-full object-cover" />
  {:else}
    <span class="font-semibold {textClass} {avatarFg}">{initial}</span>
  {/if}
</span>
