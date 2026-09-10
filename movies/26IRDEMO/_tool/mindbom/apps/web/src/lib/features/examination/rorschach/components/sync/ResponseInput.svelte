<script lang="ts">
  import type { DictationPhase } from '../../hooks/dictation.svelte'
  /**
   * 반응 입력란 — 타이핑이 1급 경로, 음성 전사는 초안 생성기.
   *
   * 확정 버튼을 두지 않는다. 확정은 Enter 하나로 모으고, 버튼 자리는
   * 마이크가 갖는다 — 검사 중 임상가의 손이 가장 적게 움직여야 한다.
   *
   * **전사 결과는 칸을 채우기만 한다.** 자동 확정하지 않는 이유:
   * 한국어 STT는 무음 구간에 "시청해주셔서 감사합니다" 같은 환각을 넣는
   * 알려진 문제가 있고, 로르샤하는 반응잠재시간이 임상 지표라 침묵이
   * 길어 정확히 그 발동 조건이다. 임상가가 보고 고친 뒤 확정한다
   * (AI 초안 → 사람 확인, CDSS 원칙).
   *
   * 녹음 중에는 테두리 색으로 상태를 알린다 — 검사 중에는 화면을 자세히
   * 보지 않으므로 색 하나로 읽혀야 한다.
   */
  import Icon from '$components/ui/Icon.svelte'

  // 전사 상태는 dictation 훅이 정본이다 — 여기 복제하면 값이 하나 늘 때
  // 한 곳만 고쳐지고 조용히 어긋난다.
  type Phase = DictationPhase

  interface Props {
    value: string
    placeholder?: string
    disabled?: boolean
    /** 전사 상태 — 테두리 색이 이 값을 따른다 */
    phase?: Phase
    /** 마이크를 누름. 없으면 마이크 버튼을 그리지 않는다(STT 미지원 환경) */
    onToggleMic?: () => void
    /** 줄 수 — 반응은 대개 한 줄, 질문 답변은 길어질 수 있다 */
    rows?: number
    /** Enter — 반응 확정 */
    onCommit: () => void
    onInput: (v: string) => void
    /** 포커스를 잃을 때 — 질문 답변처럼 자동저장하는 칸이 쓴다 */
    onBlur?: () => void
    /**
     * Enter의 뜻.
     * - 'commit': 반응 확정 (자유반응 — 한 칸이 반응 하나를 만든다)
     * - 'newline': 그냥 줄바꿈 (질문 답변 — 저장은 blur/반응 전환이 한다)
     */
    enterMode?: 'commit' | 'newline'
  }

  let {
    value,
    placeholder = '내담자의 말을 그대로 입력…',
    disabled = false,
    rows = 2,
    phase = 'idle',
    onToggleMic,
    onCommit,
    onInput,
    onBlur,
    enterMode = 'commit',
  }: Props = $props()

  let el = $state<HTMLTextAreaElement | null>(null)

  export function focus() {
    el?.focus()
  }

  /**
   * 테두리 색이 곧 상태 표시다.
   * 완전한 클래스명으로 분기한다 — 문자열로 조합하면 Tailwind가 스캔하지 못한다.
   */
  let frameClass = $derived(
    phase === 'recording'
      ? 'border-red-400 bg-white ring-1 ring-red-300'
      : phase === 'transcribing'
        ? 'border-primary-400 bg-white ring-1 ring-primary-300'
        : 'border-gray-200 bg-gray-50 focus-within:border-primary-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary-400'
  )


  function handleKey(e: KeyboardEvent) {
    if (enterMode !== 'commit') return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onCommit()
    }
  }
</script>

<!--
  ⚠️ 안쪽 textarea는 반드시 `block`이어야 한다.

  textarea의 기본값은 `inline-block`이라 부모의 **라인박스에 얹힌다.** 그러면
  베이스라인 아래 디센더 자리만큼(보통 4~5px) 부모가 더 높아져서, 테두리와
  글상자 사이에 아래쪽만 빈 띠가 생긴다. 테두리가 곧 상태 표시(녹음 중 빨강)라
  이 어긋남이 그대로 눈에 띈다.

  높이를 부모에 지정해 맞추면 안 된다 — 실제 높이는 `rows`가 정하는데(반응 1줄,
  질문 3줄) 부모가 자기 높이를 따로 가지면 두 값이 어긋나도 아무도 모른다.
-->
<div class="relative rounded-lg border transition-colors {frameClass}">
  <textarea
    bind:this={el}
    {value}
    {placeholder}
    disabled={disabled || phase === 'transcribing'}
    oninput={(e) => onInput(e.currentTarget.value)}
    onkeydown={handleKey}
    onblur={onBlur}
    {rows}
    class="block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 {onToggleMic
      ? 'pr-12'
      : ''}"
  ></textarea>

  {#if onToggleMic}
    <!-- 확정 버튼이 있던 자리. 누르면 녹음 → 다시 누르면 전사. -->
    <button
      type="button"
      onclick={onToggleMic}
      disabled={disabled || phase === 'transcribing'}
      aria-label={phase === 'recording'
        ? '녹음 중지하고 전사'
        : '음성으로 입력'}
      aria-pressed={phase === 'recording'}
      title={phase === 'recording' ? '녹음 중지하고 전사' : '음성으로 입력'}
      class="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {phase ===
      'recording'
        ? 'bg-red-500 text-white hover:bg-red-600'
        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}"
    >
      {#if phase === 'transcribing'}
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"
        ></span>
      {:else}
        <Icon name={phase === 'recording' ? 'stop' : 'mic'} size="sm" />
      {/if}
    </button>
  {/if}
</div>
