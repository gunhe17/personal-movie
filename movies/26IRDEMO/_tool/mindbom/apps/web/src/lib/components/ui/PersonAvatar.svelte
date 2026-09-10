<script lang="ts" module>
  export type AvatarRole = 'client' | 'counselor'

  /**
   * 파스텔 배경 팔레트.
   *
   * 아바타 PNG가 배경 없는 투명(RGBA)이라 뒤를 이 색으로 채운다.
   * 캐릭터의 살구빛 피부·갈색 머리와 부딪히지 않도록 채도를 낮게 잡았고,
   * 이름 해시로 고르므로 같은 사람은 항상 같은 색이 나온다(목록에서 구분됨).
   */
  const PASTELS = [
    '#E3F0FF', // 하늘
    '#E8F5E9', // 연두
    '#FFF3E0', // 살구
    '#F3E8FF', // 라벤더
    '#FFE9EC', // 연분홍
    '#E0F7F5', // 민트
    '#FFF8E1', // 크림
    '#EEF2FF' // 페리윙클
  ]

  /**
   * 문자열 → 안정적인 양의 정수 해시.
   *
   * djb2로 해시한 뒤 비트를 한 번 더 섞는다(xorshift-multiply). 이 단계가 없으면
   * 한글 이름에서 결과가 심하게 쏠린다 — 한글 코드포인트(44032~55203)는 서로 가까워
   * `% n`이 하위 비트만 보게 되기 때문이다. 실측: 섞기 전 20명에 8색 중 3색이
   * 아예 안 쓰였고 한 색에 6명이 몰렸다. 섞은 뒤에는 8색 모두 고르게 배정된다.
   */
  function hashOf(seed: string): number {
    let h = 5381
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) + h + seed.charCodeAt(i)) | 0
    }
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    return Math.abs(h)
  }

  /** 같은 이름 → 항상 같은 색 */
  function pastelFor(seed: string): string {
    return PASTELS[hashOf(seed) % PASTELS.length]
  }
</script>

<script lang="ts">
  /**
   * PersonAvatar — 사람(내담자·구성원)을 나타내는 원형 아바타.
   *
   * 폴백 순서: ① 프로필 사진 → ② 성별 캐릭터 일러스트 → ③ 이니셜
   *
   * 일러스트는 role에 따라 다른 세트를 쓴다 — 내담자는 캐주얼(니트),
   * 상담사/구성원은 정장. 성별을 모르면 이니셜로 떨어진다.
   */
  import clientMale from '$lib/assets/images/client_male.png'
  import clientFemale from '$lib/assets/images/client_female.png'
  import counselorMale from '$lib/assets/images/counselor_male.png'
  import counselorFemale from '$lib/assets/images/counselor_female.png'

  interface Props {
    name: string
    /** 'male'|'female'|'남'|'여'... 없으면 이니셜로 떨어진다 */
    gender?: string | null
    /** 어떤 일러스트 세트를 쓸지 */
    role?: AvatarRole
    /** 업로드된 프로필 사진 URL (최우선) */
    profileUrl?: string | null
    /** px 지름 — 목록 40, 카드 48, 상세 58 */
    size?: number
    class?: string
  }

  let {
    name,
    gender = null,
    role = 'client',
    profileUrl = null,
    size = 40,
    class: className = ''
  }: Props = $props()

  let imgError = $state(false)

  // 서버가 어떤 표기로 주든 받아낸다 (male/m/남/남자 …)
  let genderNorm = $derived.by<'male' | 'female' | null>(() => {
    const g = (gender ?? '').toString().trim().toLowerCase()
    if (['male', 'm', '남', '남자'].includes(g)) return 'male'
    if (['female', 'f', '여', '여자'].includes(g)) return 'female'
    return null
  })

  /**
   * 성별을 모를 때 어느 일러스트를 쓸지.
   *
   * 구성원(member)에는 아직 성별 데이터가 없다(DB·API·타입 모두). 그렇다고 전원을
   * 한쪽 그림으로 두면 사실과 다른 정보를 주장하는 셈이고, 이니셜로 떨어뜨리면
   * 목록에서 내담자와 결이 어긋난다. → 이름 해시로 안정적으로 배정한다.
   * 개인의 실제 성별을 뜻하지 않으며, 같은 사람은 항상 같은 그림으로 보인다.
   * (성별 컬럼이 생기면 gender만 넘기면 되고 이 분기는 자동으로 안 탄다.)
   */
  let effectiveGender = $derived(
    genderNorm ?? (hashOf(name || '?') % 2 === 0 ? 'male' : 'female')
  )

  let illustration = $derived(
    role === 'counselor'
      ? effectiveGender === 'male'
        ? counselorMale
        : counselorFemale
      : effectiveGender === 'male'
        ? clientMale
        : clientFemale
  )

  let bg = $derived(pastelFor(name || '?'))
  let initial = $derived(name?.trim()?.slice(0, 1) || '?')

  // 지름에 비례한 글자 크기 — 토큰 사다리로는 임의 지름을 못 따라간다
  let fontSize = $derived(Math.max(12, Math.round(size * 0.42)))
</script>

<span
  class="flex shrink-0 items-center justify-center overflow-hidden rounded-full {className}"
  style="width: {size}px; height: {size}px; background-color: {bg};"
>
  {#if profileUrl && !imgError}
    <img
      src={profileUrl}
      alt=""
      class="h-full w-full object-cover"
      onerror={() => (imgError = true)}
    />
  {:else if illustration && name}
    <!--
      배경을 지운 뒤 이미지마다 여백이 다르다(실측: 상단 9~18%). 그래서 확대·이동
      보정을 걸면 그림마다 다르게 보인다 — object-cover로 원본 비율 그대로 채운다.
    -->
    <img src={illustration} alt="" class="h-full w-full object-cover" />
  {:else}
    <span class="font-semibold leading-none text-gray-600" style="font-size: {fontSize}px;">
      {initial}
    </span>
  {/if}
</span>
