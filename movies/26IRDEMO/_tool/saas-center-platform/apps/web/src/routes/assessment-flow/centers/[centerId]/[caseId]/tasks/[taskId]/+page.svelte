<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import AssessmentComplete from '$lib/assets/AssessmentComplete.svelte'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'
  import AssessmentEndConfirmModal from '$lib/components/modal/AssessmentEndConfirmModal.svelte'

  const centerId = $derived(page.params.centerId ?? '')
  const caseId = $derived(page.params.caseId ?? '')
  const taskId = $derived(page.params.taskId ?? '')

  interface Question {
    number?: number
    question_number?: number
    text?: string
    question_text?: string
    options?: Array<{ value: number; label?: string } | number | string>
  }

  interface AssessmentInfo {
    code: string
    kor_name: string
    workflow_type: string
    definition: {
      description?: string
      estimated_time?: number
      total_items?: number
      questions?: Question[]
    }
  }

  interface TaskData {
    id: string
    status: string
    workflow_type?: string
    assessment?: AssessmentInfo | null
  }

  const PAGE_SIZE = 5

  let task = $state<TaskData | null>(null)
  let loading = $state(true)
  let submitting = $state(false)
  let error = $state('')
  let responses = $state<Record<number, number>>({})
  let completed = $state(false)
  let currentPage = $state(1)
  let formRef = $state<HTMLFormElement | null>(null)

  const questions = $derived(task?.assessment?.definition?.questions ?? [])
  const totalItems = $derived(
    task?.assessment?.definition?.total_items ?? questions.length
  )
  const totalPages = $derived(Math.ceil(questions.length / PAGE_SIZE) || 1)
  const visibleQuestions = $derived(
    questions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  )
  const answeredCount = $derived(
    Object.keys(responses).filter((k) => responses[Number(k)] != null).length
  )
  function getQuestionNumber(q: Question, index: number): number {
    return q.number ?? q.question_number ?? index + 1
  }

  const canSubmit = $derived(
    questions.length > 0 &&
      questions.every((q, i) => responses[getQuestionNumber(q, i)] != null)
  )

  onMount(() => {
    void loadTask()
  })

  async function loadTask() {
    loading = true
    error = ''
    try {
      // 검사 화면 진입 = 시작 — POST /start가 pending이면 in_progress로 전환하고 task를 반환(멱등).
      const res = await fetch(
        `/api/assessment/proxy/centers/${centerId}/tasks/${taskId}/start`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 조회에 실패했습니다.'
        )
      }
      const data = await res.json()
      task = data

      if (data.status === 'completed') {
        completed = true
      }
    } catch (e) {
      error = e instanceof Error ? e.message : '검사 조회에 실패했습니다.'
    } finally {
      loading = false
    }
  }

  function getQuestionText(q: Question, displayNum: number): string {
    return q.text ?? q.question_text ?? `문항 ${displayNum}`
  }

  function getOptions(q: Question): Array<{ value: number; label: string }> {
    const opts = q.options
    if (!opts || !Array.isArray(opts)) {
      return [
        { value: 1, label: '전혀 그렇지 않다' },
        { value: 2, label: '때때로 그렇다' },
        { value: 3, label: '자주 그렇다' },
        { value: 4, label: '항상 그렇다' }
      ]
    }
    return opts.map((o) => {
      if (typeof o === 'object' && o !== null && 'value' in o) {
        const v = o as { value: number; label?: string }
        return { value: v.value, label: v.label ?? String(v.value) }
      }
      const num = typeof o === 'number' ? o : parseInt(String(o), 10)
      return { value: num, label: String(o) }
    })
  }

  function setResponse(questionNumber: number, value: number) {
    responses = { ...responses, [questionNumber]: value }
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    submitting = true
    error = ''
    try {
      const payload = {
        workflow_type: 'self_report',
        responses: Object.entries(responses)
          .filter(([, v]) => v != null)
          .map(([qn, v]) => ({
            question_number: parseInt(qn, 10),
            answer_value: v
          }))
          .sort((a, b) => a.question_number - b.question_number),
        current_item: totalItems
      }
      const res = await fetch(
        `/api/assessment/proxy/centers/${centerId}/tasks/${taskId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 제출에 실패했습니다.'
        )
      }
      completed = true
      snackbarStore.success('검사가 완료되었습니다.')
    } catch (e) {
      error = e instanceof Error ? e.message : '검사 제출에 실패했습니다.'
    } finally {
      submitting = false
    }
  }

  /** 검사 목록(cases 통합 페이지)으로 이동 */
  function goToCaseList() {
    const params = new URLSearchParams(page.url.search)
    const clientId = params.get('clientId') ?? ''
    goto(`/assessment-flow/centers/${centerId}/cases?clientId=${clientId}`)
  }

  /** 에러 시 목록으로 */
  function handleBackToList() {
    goToCaseList()
  }

  /** 완료 후 홈 = 검사 목록으로 돌아가서 나머지 검사 진행 */
  function handleGoHome() {
    goToCaseList()
  }

  const canProceedToNext = $derived(
    visibleQuestions.every((q, i) => {
      const num = getQuestionNumber(q, (currentPage - 1) * PAGE_SIZE + i)
      return responses[num] != null
    })
  )

  function handleEndAssessment() {
    modalStore.open({
      component: AssessmentEndConfirmModal,
      props: {
        description: '현재 검사 세션이 종료되고\n검사 목록으로 이동해요',
        onConfirm: () => {
          goToCaseList()
        }
      }
    })
  }
</script>

<svelte:head>
  <title>검사 진행 - {task?.assessment?.kor_name ?? '검사'}</title>
</svelte:head>

<div class="min-h-screen min-h-[100dvh] flex flex-col bg-[#F6F6F6]">
  <AssessmentFlowHeader />

  <main class="flex-1 flex flex-col min-h-0 overflow-x-hidden">
    {#if loading}
      <div
        class="flex flex-1 items-center justify-center text-center text-gray-600"
      >
        검사를 불러오는 중입니다...
      </div>
    {:else if error}
      <div class="flex flex-1 items-center justify-center p-8">
        <div
          class="rounded-lg bg-white border border-gray-200 p-8 text-center max-w-md"
        >
          <p class="text-sm text-red-600 mb-6">{error}</p>
          <button
            type="button"
            onclick={handleBackToList}
            class="min-h-[44px] h-11 px-6 rounded-md border border-gray-300 text-gray-700 touch-manipulation"
          >
            목록으로
          </button>
        </div>
      </div>
    {:else if completed}
      <div
        class="flex flex-1 flex-col items-center justify-center p-8 text-center"
      >
        <div class="flex justify-center mb-6 [&>svg]:h-40 [&>svg]:w-auto">
          <AssessmentComplete />
        </div>
        <p class="text-xl font-semibold text-gray-800 mb-8">
          검사가 완료되었습니다
        </p>
        <button
          type="button"
          onclick={handleGoHome}
          class="min-h-[44px] h-11 px-8 rounded-md bg-[#737373] text-white font-semibold touch-manipulation"
        >
          홈으로 이동
        </button>
      </div>
    {:else if task && questions.length > 0}
      <form
        bind:this={formRef}
        class="flex flex-1 flex-col min-h-0 min-w-0 overflow-auto bg-white"
        onsubmit={async (e) => {
          e.preventDefault()
          if (currentPage < totalPages) {
            currentPage += 1
            await tick()
            formRef?.scrollTo(0, 0)
            window.scrollTo(0, 0)
          } else {
            handleSubmit()
          }
        }}
      >
        <section
          class="flex flex-1 flex-col items-center justify-center bg-[#f6f6f6] px-3 sm:px-6 md:px-10 py-4 sm:py-10 w-full min-w-0 pb-[env(safe-area-inset-bottom)]"
        >
          <div
            class="mx-auto w-full max-w-4xl bg-white px-3 sm:px-6 pt-3 sm:pt-6 rounded-lg sm:rounded-[16px] min-w-0 shadow-sm sm:shadow-none"
          >
            {#each visibleQuestions as q, idx (q.number ?? q.question_number ?? (currentPage - 1) * PAGE_SIZE + idx)}
              {@const qNum = getQuestionNumber(
                q,
                (currentPage - 1) * PAGE_SIZE + idx
              )}
              <article
                class={`flex flex-col gap-4 md:flex-row md:items-center md:gap-8 ${visibleQuestions.length - 1 === idx ? '' : 'border-b border-gray-200'} pb-5 sm:pb-8 pt-5 sm:pt-8 first:pt-0`}
              >
                <p
                  class="min-w-0 flex-1 text-[15px] sm:text-lg font-medium leading-relaxed text-gray-800"
                >
                  {qNum}. {getQuestionText(q, qNum)}
                </p>
                <div
                  class="flex flex-wrap gap-3 sm:gap-6 md:gap-8 md:shrink-0 justify-center sm:justify-start"
                >
                  {#each getOptions(q) as opt}
                    {@const isSelected = responses[qNum] === opt.value}
                    <label
                      class="flex shrink-0 flex-col items-center gap-1.5 sm:gap-2 cursor-pointer select-none min-h-[44px] min-w-[44px] justify-center touch-manipulation active:opacity-80"
                    >
                      <span
                        class="whitespace-nowrap text-xs sm:text-sm text-gray-600 text-center leading-tight max-w-[72px] sm:max-w-none"
                      >
                        {opt.label}
                      </span>
                      <span
                        class="inline-flex h-10 w-10 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors {isSelected
                          ? 'border-[#737373] bg-[#737373]'
                          : 'border-gray-300 bg-white'}"
                        aria-hidden="true"
                      >
                        {#if isSelected}
                          <svg
                            class="h-5 w-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        {/if}
                      </span>
                      <input
                        type="radio"
                        name="task-{taskId}-q{qNum}"
                        value={opt.value}
                        checked={isSelected}
                        onchange={() => setResponse(qNum, opt.value)}
                        class="sr-only"
                      />
                    </label>
                  {/each}
                </div>
              </article>
            {/each}
            {#if error}
              <p class="text-sm text-red-600 mt-4">{error}</p>
            {/if}
          </div>
          <div
            class="mt-4 sm:mt-10 w-full max-w-4xl flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 pt-4 sm:pt-8 min-w-0 pb-2"
          >
            <button
              type="button"
              onclick={handleEndAssessment}
              class="order-2 md:order-1 min-h-[44px] text-sm text-gray-600 hover:text-gray-800 underline underline-offset-2 py-2 touch-manipulation self-center"
            >
              검사 나가기
            </button>
            <div class="order-1 md:order-2 flex flex-wrap gap-3 justify-end">
              {#if currentPage > 1}
                <button
                  type="button"
                  onclick={() => (currentPage -= 1)}
                  class="flex-1 sm:flex-initial min-h-[48px] sm:h-12 px-6 sm:px-8 rounded-full border border-gray-200 bg-white text-gray-600 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                >
                  이전
                </button>
              {/if}
              {#if currentPage < totalPages}
                <button
                  type="submit"
                  disabled={!canProceedToNext}
                  class="flex-1 sm:flex-initial min-h-[48px] sm:h-12 px-6 sm:px-8 rounded-full font-semibold text-white transition-colors disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed bg-etc-orange hover:bg-etc-orange/90 active:bg-etc-orange/80 touch-manipulation"
                >
                  다음
                </button>
              {:else}
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  class="flex-1 sm:flex-initial min-h-[48px] sm:h-12 px-6 sm:px-8 rounded-full font-semibold text-white transition-colors disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed bg-etc-orange hover:bg-etc-orange/90 active:bg-etc-orange/80 touch-manipulation"
                >
                  {submitting ? '제출 중...' : '제출'}
                </button>
              {/if}
            </div>
          </div>
        </section>
      </form>
    {:else}
      <div class="flex flex-1 items-center justify-center p-8">
        <div
          class="rounded-lg bg-white border border-gray-200 p-8 text-center max-w-md"
        >
          <p class="text-sm text-gray-600 mb-6">
            문항 정보를 불러올 수 없습니다.
          </p>
          <button
            type="button"
            onclick={handleBackToList}
            class="min-h-[44px] h-11 px-6 rounded-md border border-gray-300 text-gray-700 touch-manipulation"
          >
            목록으로
          </button>
        </div>
      </div>
    {/if}
  </main>
</div>
