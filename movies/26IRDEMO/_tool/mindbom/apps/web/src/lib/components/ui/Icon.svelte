<script lang="ts">
  /**
   * Icon — Material Icons Round 폰트 래퍼.
   *
   * 크기는 Web_Design.md의 아이콘 사다리(16/20/24/32)를 px로 고정한다.
   * 이전 구현은 text-sm/base/lg 같은 상대 크기라 스펙의 px 값과 어긋났다
   * (예: 버튼 안 아이콘이 20이어야 하는데 14로 렌더).
   *
   * 색은 지정하지 않으면 부모의 currentColor를 따른다. 독립적으로 줄 때는
   * text-icon-primary / -secondary / -tertiary 토큰을 쓴다(hex 하드코딩 금지).
   */
  type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

  let {
    name,
    size = 'md',
    class: className = ''
  }: {
    name: string
    size?: Size
    class?: string
  } = $props()

  /** 스펙 사다리: 12 · 16 · 20 · 24 · 32 */
  const px: Record<Size, number> = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
  }
</script>

<span
  class="material-icons-round shrink-0 select-none leading-none {className}"
  style="font-size: {px[size]}px; width: {px[size]}px; height: {px[size]}px;"
  aria-hidden="true"
>
  {name}
</span>
