<script lang="ts">
  /**
   * Badge — Web_Design.md §badge · §tag · §Status Badge 정본.
   *
   * 두 형태(shape)
   *   - rect  : 분류·라벨용(팀명·역할·카테고리). S(24/radius 4) · M(32/radius 6)
   *   - round : 상태 인디케이터. 높이 32, pill, 텍스트 15
   *
   * 색은 tag 10색 팔레트를 참조한다 — fg = hue 색, bg = 동일 hue 저불투명 틴트.
   * 상태 배지도 같은 팔레트를 재사용한다(별도 색 없음).
   *   pending·inactive → gray · progress → blue · done → green · canceled → red
   *
   * 짧은 라벨 전용 — 옅은 틴트 위 대비가 본문급에는 부족하다.
   */
  type Hue =
    | 'gray'
    | 'blue'
    | 'indigo'
    | 'purple'
    | 'pink'
    | 'red'
    | 'orange'
    | 'amber'
    | 'green'
    | 'teal'
  type State = 'pending' | 'progress' | 'done' | 'canceled' | 'inactive'
  type Shape = 'rect' | 'round'
  type Size = 'sm' | 'md'

  let {
    label,
    color = 'gray',
    state,
    shape = 'rect',
    size = 'sm',
    outline = false,
    class: className = ''
  }: {
    label: string
    color?: Hue
    /** 지정하면 color보다 우선한다. 상태 매핑 + canceled의 line-through 처리. */
    state?: State
    shape?: Shape
    size?: Size
    outline?: boolean
    class?: string
  } = $props()

  /** 흔하고 정상인 상태일수록 조용한 색, 종료/취소는 muted. */
  const stateHue: Record<State, Hue> = {
    pending: 'gray',
    progress: 'blue',
    done: 'green',
    canceled: 'red',
    inactive: 'gray'
  }

  // Tailwind가 클래스명을 정적으로 추출하므로 전체 문자열을 나열한다.
  const fg: Record<Hue, string> = {
    gray: 'text-tag-gray-fg',
    blue: 'text-tag-blue-fg',
    indigo: 'text-tag-indigo-fg',
    purple: 'text-tag-purple-fg',
    pink: 'text-tag-pink-fg',
    red: 'text-tag-red-fg',
    orange: 'text-tag-orange-fg',
    amber: 'text-tag-amber-fg',
    green: 'text-tag-green-fg',
    teal: 'text-tag-teal-fg'
  }
  const bg: Record<Hue, string> = {
    gray: 'bg-tag-gray-bg',
    blue: 'bg-tag-blue-bg',
    indigo: 'bg-tag-indigo-bg',
    purple: 'bg-tag-purple-bg',
    pink: 'bg-tag-pink-bg',
    red: 'bg-tag-red-bg',
    orange: 'bg-tag-orange-bg',
    amber: 'bg-tag-amber-bg',
    green: 'bg-tag-green-bg',
    teal: 'bg-tag-teal-bg'
  }
  const ol: Record<Hue, string> = {
    gray: 'border border-tag-gray-outline',
    blue: 'border border-tag-blue-outline',
    indigo: 'border border-tag-indigo-outline',
    purple: 'border border-tag-purple-outline',
    pink: 'border border-tag-pink-outline',
    red: 'border border-tag-red-outline',
    orange: 'border border-tag-orange-outline',
    amber: 'border border-tag-amber-outline',
    green: 'border border-tag-green-outline',
    teal: 'border border-tag-teal-outline'
  }

  /** rect S: 24/radius 4/13px · rect M: 32/radius 6/14px · round: 32/pill/15px */
  const shapeCls = $derived(
    shape === 'round'
      ? 'h-8 rounded-full px-3 text-body-02-normal-medium'
      : size === 'md'
        ? 'h-8 rounded-md px-3 text-body-03-normal-medium'
        : 'h-6 rounded px-2 text-label-01-normal-medium'
  )

  let hue = $derived<Hue>(state ? stateHue[state] : color)
  let cls = $derived(
    [
      'inline-flex items-center gap-1 whitespace-nowrap',
      shapeCls,
      fg[hue],
      bg[hue],
      outline ? ol[hue] : '',
      // 취소 배지는 라벨에 line-through 병행
      state === 'canceled' ? 'line-through' : '',
      className
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<span class={cls}>{label}</span>
