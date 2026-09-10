<script lang="ts">
  interface Props {
    stemNumber: number
    totalCount: number
    stem: string
    isCompound?: boolean
    answer: string
    reason: string
    onAnswerChange: (value: string) => void
    onReasonChange: (value: string) => void
    onSubmit: () => void
  }

  let {
    stemNumber,
    totalCount,
    stem,
    isCompound = false,
    answer,
    reason,
    onAnswerChange,
    onReasonChange,
    onSubmit
  }: Props = $props()

  let answerTextarea: HTMLTextAreaElement | null = $state(null)
  let reasonTextarea: HTMLTextAreaElement | null = $state(null)

  // 문항이 바뀌면 답변 textarea로 포커스 이동
  $effect(() => {
    void stemNumber
    answerTextarea?.focus()
  })

  function isPlainEnter(e: KeyboardEvent) {
    // 한글 IME 조합 중 Enter는 조합 확정용 — 무시
    if (e.isComposing || e.keyCode === 229) return false
    return e.key === 'Enter' && !e.shiftKey
  }

  function handleAnswerKeyDown(e: KeyboardEvent) {
    if (!isPlainEnter(e)) return
    if (!answer.trim()) return
    e.preventDefault()
    if (isCompound) {
      reasonTextarea?.focus()
    } else {
      onSubmit()
    }
  }

  function handleReasonKeyDown(e: KeyboardEvent) {
    if (!isPlainEnter(e)) return
    if (!answer.trim() || !reason.trim()) return
    e.preventDefault()
    onSubmit()
  }
</script>

<div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
  <div class="mb-4 flex items-center justify-between">
    <span class="text-xs font-medium text-gray-400">
      문항 {stemNumber} / {totalCount}
    </span>
    {#if isCompound}
      <span class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
        복합문항
      </span>
    {/if}
  </div>

  <p class="mb-6 text-lg font-medium leading-relaxed text-gray-900">
    {stem}<span class="text-gray-400"> ________</span>
  </p>

  <textarea
    bind:this={answerTextarea}
    value={answer}
    oninput={(e) => onAnswerChange(e.currentTarget.value)}
    onkeydown={handleAnswerKeyDown}
    placeholder="답변을 입력하세요"
    rows={3}
    class="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
  ></textarea>

  {#if isCompound}
    <div class="mt-4">
      <label for="reason-input" class="mb-1.5 block text-xs font-medium text-gray-500">
        왜냐하면…
      </label>
      <textarea
        id="reason-input"
        bind:this={reasonTextarea}
        value={reason}
        oninput={(e) => onReasonChange(e.currentTarget.value)}
        onkeydown={handleReasonKeyDown}
        placeholder="이유를 입력하세요"
        rows={2}
        class="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
      ></textarea>
    </div>
  {/if}

  <div class="mt-1.5 flex items-center justify-end text-xs text-gray-400">
    {#if isCompound}
      <span>Enter로 이유 입력 → Enter로 다음 문항</span>
    {:else}
      <span>Enter로 다음 문항</span>
    {/if}
  </div>
</div>
