<script lang="ts">
  import type { PDIItem } from '../types'
  import { buildDefaultPDI } from '../pdi-questions'

  interface Props {
    pdiLines: PDIItem[]
    drawingType?: string
    /** 확정된 검사 — 입력을 잠근다(내용은 계속 보인다) */
    readOnly?: boolean
    onUpdate: (pdiLines: PDIItem[]) => void
  }

  // 기본값을 특정 그림으로 두지 않는다 — 표준 질문이 붙은 뒤로는
  // 잘못된 기본값이 "집 그림에 나무 질문"으로 드러난다.
  let {
    pdiLines,
    drawingType = '',
    readOnly = false,
    onUpdate
  }: Props = $props()

  /**
   * 화면에 보이는 문항 = 저장된 것이 있으면 그것, 없으면 표준 문항.
   *
   * 표준 문항은 **보여주기만** 하고 서버에 밀어 넣지 않는다. onUpdate를 부르면
   * 1초 뒤 자동저장이 걸리는데(steps/Collect.svelte), 그러면 검사자가 묻지도
   * 않은 질문이 빈 응답인 채로 기록에 남는다. 임상가가 실제로 입력하는
   * 순간(아래 commit) 비로소 저장된다.
   */
  let lines = $derived(
    pdiLines.length > 0
      ? pdiLines
      : // 확정된 검사에는 채우지 않는다 — 기록에 없는 질문을 보여주면
        // 실제로 물어본 것처럼 읽힌다.
        readOnly
        ? []
        : buildDefaultPDI(drawingType)
  )

  /**
   * 입력 칸이 내용만큼 자란다 — 카드도 함께 늘어난다.
   *
   * 예전에는 높이가 고정이라 답변이 길어지면 칸 안에 스크롤바가 생겼고,
   * 방금 친 줄이 위로 밀려 보이지 않았다. 임상 면접 기록은 한눈에 다시
   * 읽어야 하는 것이라 스크롤로 숨기면 안 된다.
   *
   * height를 auto로 되돌린 뒤 scrollHeight를 읽는 순서가 중요하다 — 이전
   * 높이가 남아 있으면 scrollHeight가 그 값에 갇혀 줄어들지 않는다.
   */
  function autoGrow(node: HTMLTextAreaElement, getValue: () => string) {
    function resize() {
      node.style.height = 'auto'
      // 숨겨진 동안에는 재지 않는다. 이 패널은 xl 미만에서 `hidden`인 채로
      // 마운트되는데(RightPanel의 rootClass), 그때 scrollHeight는 0이라
      // 높이를 0으로 굳혀 버린다. ResizeObserver가 보일 때 다시 부른다.
      if (node.scrollHeight > 0) node.style.height = `${node.scrollHeight}px`
    }

    // 값이 밖에서 바뀔 때도(탭 전환·서버 로드) 다시 잰다
    $effect(() => {
      getValue()
      resize()
    })

    // 폭이 변하면 줄바꿈이 달라져 높이도 달라진다 — 창 크기 조절과
    // '숨김 → 보임' 전환을 함께 잡는다.
    const observer = new ResizeObserver(resize)
    observer.observe(node)

    node.addEventListener('input', resize)
    return {
      destroy() {
        observer.disconnect()
        node.removeEventListener('input', resize)
      }
    }
  }

  /** 편집 결과를 위로 올린다 — 이 시점부터 서버에 저장된다 */
  function commit(next: PDIItem[]) {
    onUpdate(next)
  }

  function updateQuestion(index: number, value: string) {
    commit(
      lines.map((item, i) =>
        i === index ? { ...item, question: value } : item
      )
    )
  }

  function updateAnswer(index: number, value: string) {
    commit(
      lines.map((item, i) => (i === index ? { ...item, answer: value } : item))
    )
  }

  function addLine() {
    commit([...lines, { question: '', answer: '' }])
  }

  function removeLine(index: number) {
    commit(lines.filter((_, i) => i !== index))
  }
</script>

<div class="p-4">
  {#if lines.length === 0}
    <!-- 그림 종류를 아직 모를 때만 여기 온다 (표준 문항을 고를 수 없음) -->
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div
        class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"
      >
        <span class="material-icons-round text-gray-400 text-xl">forum</span>
      </div>
      <p class="text-body-03-normal-regular text-gray-500 mb-1">
        사후 질문이 없습니다
      </p>
      {#if !readOnly}
        <p class="text-label-01-normal-regular text-gray-400 mb-4">
          질문을 기록하세요
        </p>
        <button
          onclick={addLine}
          class="inline-flex items-center gap-1 px-3 py-1.5 text-body-03-normal-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <span class="material-icons-round text-body-03-normal-regular"
            >add</span
          >
          질문 추가
        </button>
      {/if}
    </div>
  {:else}
    <!-- Q&A List -->
    <div class="space-y-2.5">
      {#each lines as line, index (index)}
        <div
          class="group rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
        >
          <!-- Question Row -->
          <div class="flex items-start gap-2 px-3 pt-2.5 pb-1">
            <span
              class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"
            >
              <span class="text-label-01-normal-regular font-bold">Q</span>
            </span>
            <!--
              input이 아니라 textarea다. 한 줄짜리 input은 긴 질문을 가로로
              잘라 감춘다 — 기록을 눈으로 확인할 수 없다.
              rows=1로 시작해 autoGrow가 내용만큼 키운다.
            -->
            <textarea
              disabled={readOnly}
              rows="1"
              value={line.question}
              use:autoGrow={() => line.question}
              oninput={(e) =>
                updateQuestion(index, (e.target as HTMLTextAreaElement).value)}
              placeholder="질문을 입력하세요"
              class="flex-1 min-w-0 resize-none overflow-hidden border-none bg-transparent text-body-03-reading-regular text-gray-800 outline-none placeholder:text-gray-300"
            ></textarea>
            {#if !readOnly}
              <button
                onclick={() => removeLine(index)}
                class="mt-1 p-0.5 rounded text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="삭제"
              >
                <span class="material-icons-round text-base">close</span>
              </button>
            {/if}
          </div>
          <!-- Answer Row -->
          <div class="flex items-start gap-2 px-3 pt-0 pb-2.5">
            <span
              class="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0"
            >
              <span class="text-label-01-normal-regular font-bold">A</span>
            </span>
            <textarea
              disabled={readOnly}
              rows="1"
              value={line.answer}
              use:autoGrow={() => line.answer}
              oninput={(e) =>
                updateAnswer(index, (e.target as HTMLTextAreaElement).value)}
              placeholder="응답을 입력하세요"
              class="flex-1 min-w-0 resize-none overflow-hidden border-none bg-transparent text-body-03-reading-regular text-gray-600 outline-none placeholder:text-gray-300"
            ></textarea>
          </div>
        </div>
      {/each}
    </div>

    <!-- Add Button -->
    {#if !readOnly}
      <button
        onclick={addLine}
        class="mt-3 w-full flex items-center justify-center gap-1 py-2 text-body-03-normal-regular text-gray-400 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg transition-colors"
      >
        <span class="material-icons-round text-body-03-normal-regular">add</span
        >
        질문 추가
      </button>
    {/if}
  {/if}
</div>
