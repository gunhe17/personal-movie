<script lang="ts">
  /**
   * 에이전트 채팅 전역 전송 버튼 — gradient (blue→purple) 원형.
   *
   * 사용처: AgentChatArea, SelectionList 자유 입력, AgentFloatingIcon 등
   * 상위가 form이면 type="submit", 일반 onclick은 type="button".
   */
  interface Props {
    onClick?: () => void | Promise<void>
    disabled?: boolean
    type?: 'button' | 'submit'
    size?: 'sm' | 'md'
    ariaLabel?: string
  }

  let {
    onClick,
    disabled = false,
    type = 'button',
    size = 'md',
    ariaLabel = '전송'
  }: Props = $props()

  const sizeClass = $derived(size === 'sm' ? 'h-9 w-9' : 'h-10 w-10')
  const iconSize = $derived(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')
</script>

<button
  {type}
  class="{sizeClass} shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
  {disabled}
  onclick={onClick}
  aria-label={ariaLabel}
>
  <svg class={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M5 10l7-7m0 0l7 7m-7-7v18"
    />
  </svg>
</button>
