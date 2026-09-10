<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { modalStore } from '$lib/stores/modal'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'
  import AssessmentEndConfirmModal from '$lib/components/modal/AssessmentEndConfirmModal.svelte'

  const centerId = $derived(page.params.centerId ?? '')
  const caseId = $derived(page.params.caseId ?? '')

  let clientId = $state<string | null>(null)
  let clientName = $state<string>('')

  interface AssessmentInfo {
    code: string
    kor_name: string
    workflow_type: string
    duration?: number | null
    definition: {
      estimated_time?: number
      total_items?: number
      questions?: unknown[]
      due_date?: string | null
    }
  }

  interface TaskItem {
    id: string
    status: string
    completed_at: string | null
    assessment: AssessmentInfo | null
  }

  interface CaseDetail {
    set_name: string | null
    created_at: string
    clients: Array<{ client_id: string; name: string }>
  }

  let tasks = $state<TaskItem[]>([])
  let caseDetail = $state<CaseDetail | null>(null)
  let loading = $state(true)
  let error = $state('')
  let accordionOpen = $state(true)

  const hasSet = $derived(!!caseDetail?.set_name)

  onMount(() => {
    const params = new URLSearchParams(page.url.search)
    clientId = params.get('clientId')
    void loadData()
  })

  async function loadData() {
    loading = true
    error = ''
    try {
      const [caseRes, tasksRes] = await Promise.all([
        fetch(
          `/api/assessment/proxy/centers/${centerId}/assessment-cases/${caseId}`
        ),
        fetch(
          `/api/assessment/proxy/centers/${centerId}/assessment-cases/${caseId}/tasks?execution_method=online`
        )
      ])

      if (!tasksRes.ok) {
        const err = await tasksRes.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 목록 조회에 실패했습니다.'
        )
      }

      const tasksData = await tasksRes.json()
      tasks = Array.isArray(tasksData) ? tasksData : []

      if (tasks.length === 0) {
        error = '온라인 검사가 없습니다.'
        return
      }

      if (caseRes.ok) {
        const caseData = await caseRes.json()
        caseDetail = {
          set_name: caseData.set_name ?? null,
          created_at: caseData.created_at ?? '',
          clients: caseData.clients ?? []
        }
        const cid = clientId ?? ''
        const client = caseDetail.clients.find((c) => c.client_id === cid)
        clientName = client?.name ?? ''
      } else {
        caseDetail = null
      }
    } catch (e) {
      error = e instanceof Error ? e.message : '검사 목록 조회에 실패했습니다.'
    } finally {
      loading = false
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    } catch {
      return iso
    }
  }

  /** 소요시간: Assessment.duration 또는 definition.estimated_time. 없으면 null(표시 안 함) */
  function getEstimatedTime(t: TaskItem): string | null {
    const minutes =
      t.assessment?.duration ?? t.assessment?.definition?.estimated_time ?? 0
    if (minutes > 0) return `약 ${minutes}분`
    return null
  }

  /** 문항 수. 없으면 null */
  function getTotalItems(t: TaskItem): number | null {
    const n = t.assessment?.definition?.total_items
    return typeof n === 'number' && n > 0 ? n : null
  }

  function isTaskActionable(t: TaskItem): boolean {
    return t.status === 'pending' || t.status === 'in_progress'
  }

  function isTaskExpired(t: TaskItem): boolean {
    return !isTaskActionable(t) && t.status !== 'completed'
  }

  function getDueDate(t: TaskItem): string | null {
    return t.assessment?.definition?.due_date ?? null
  }

  function handleTaskClick(t: TaskItem) {
    if (!isTaskActionable(t)) return
    const cid = clientId ?? ''
    const q = cid ? `?clientId=${cid}` : ''
    goto(`/assessment-flow/centers/${centerId}/${caseId}/tasks/${t.id}${q}`)
  }

  function getSetStatus(): 'completed' | 'in_progress' {
    const allDone = tasks.every((t) => t.status === 'completed')
    return allDone ? 'completed' : 'in_progress'
  }

  function handleEndAssessment() {
    const cid = clientId ?? ''
    modalStore.open({
      component: AssessmentEndConfirmModal,
      props: {
        title: '검사를 종료할까요?',
        description: '현재 검사 세션이 종료되고\n검사 목록으로 이동해요',
        confirmButtonText: '나가기',
        onConfirm: () => {
          if (cid) {
            goto(`/assessment-flow/centers/${centerId}/cases?clientId=${cid}`)
          } else {
            goto(`/assessment-flow/centers/${centerId}/identify`)
          }
        }
      }
    })
  }

  function handleGoToIdentify() {
    modalStore.open({
      component: AssessmentEndConfirmModal,
      props: {
        title: '내담자 입력 화면으로 이동할까요?',
        description: '이동하면 다시 이름과 생년월일을 입력해 주셔야 합니다.',
        confirmButtonText: '이동',
        onConfirm: () => {
          goto(`/assessment-flow/centers/${centerId}/identify`)
        }
      }
    })
  }
</script>

<svelte:head>
  <title>온라인 검사 목록 - 검사 진행</title>
</svelte:head>

<div class="min-h-screen min-h-[100dvh] bg-[#e5e5e7] flex flex-col">
  <AssessmentFlowHeader />

  <main
    class="flex-1 mx-auto max-w-[1160px] w-full min-w-0 px-3 sm:px-8 py-5 sm:py-12 pb-[env(safe-area-inset-bottom)]"
  >
    <section class="w-full max-w-2xl mx-auto">
      {#if loading}
        <div class="text-center text-gray-600 py-16">
          검사 목록을 불러오는 중입니다...
        </div>
      {:else if error === '온라인 검사가 없습니다.'}
        <div
          class="rounded-lg bg-white border border-gray-200 p-8 text-center shadow-sm"
        >
          <p class="text-lg font-semibold text-gray-700 mb-2">
            온라인 검사가 없습니다
          </p>
          <p class="text-sm text-gray-600 mb-8">
            이번에는 센터 방문 검사만 있습니다. 직원에게 문의하세요.
          </p>
          <div class="flex flex-wrap justify-center gap-4">
            <a
              href="/assessment-flow/centers/{centerId}/cases?clientId={clientId ??
                ''}"
              class="min-h-[44px] h-11 px-6 rounded-md border border-gray-300 text-gray-700 flex items-center justify-center touch-manipulation"
            >
              검사 목록으로
            </a>
            <a
              href="tel:"
              class="min-h-[44px] h-11 px-6 rounded-md bg-[#737373] text-white font-semibold flex items-center justify-center touch-manipulation"
            >
              직원 호출
            </a>
          </div>
        </div>
      {:else if error}
        <div
          class="rounded-lg bg-white border border-gray-200 p-8 text-center shadow-sm"
        >
          <p class="text-sm text-red-600 mb-6">{error}</p>
          <a
            href="/assessment-flow/centers/{centerId}/cases?clientId={clientId ??
              ''}"
            class="min-h-[44px] h-11 px-6 rounded-md border border-gray-300 text-gray-700 inline-flex items-center justify-center touch-manipulation"
          >
            검사 목록으로
          </a>
        </div>
      {:else}
        <h2 class="text-xl sm:text-2xl font-bold text-gray-800 mb-6 sm:mb-8">
          {clientName ? `${clientName}님의 검사 목록` : '온라인 검사 목록'}
        </h2>

        {#if hasSet}
          <!-- 세트 있을 때: 아코디언 (이미지와 동일 - 헤더 연한회색, 뱃지 구분, 펼침 영역 들여쓰기) -->
          <div class="space-y-4">
            <div
              class="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden"
            >
              <!-- 아코디언 헤더: 연한 회색 바, 뱃지(진행전=회색/완료=녹색) + 세트명 + 날짜 + chevron -->
              <!-- 접힌 상태: 이미지3처럼 한 줄만 (뱃지+세트명+날짜+chevron) -->
              <button
                type="button"
                onclick={() => (accordionOpen = !accordionOpen)}
                class="w-full flex items-center justify-between gap-3 py-4 px-5 text-left hover:bg-gray-200/50 transition-colors bg-gray-100 {accordionOpen
                  ? 'rounded-t-xl border-b border-gray-200'
                  : 'rounded-lg'}"
              >
                <div class="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  <span
                    class="rounded-md px-2.5 py-1 text-sm font-medium shrink-0 {getSetStatus() ===
                    'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-800'}"
                  >
                    {getSetStatus() === 'completed' ? '완료' : '진행전'}
                  </span>
                  <span class="font-bold text-gray-900">
                    {caseDetail?.set_name ?? '검사 세트'}
                  </span>
                  {#if caseDetail?.created_at}
                    <span class="text-sm text-gray-500 font-normal">
                      {formatDate(caseDetail.created_at)}
                    </span>
                  {/if}
                </div>
                <svg
                  class="w-5 h-5 text-gray-500 shrink-0 transition-transform {accordionOpen
                    ? 'rotate-180'
                    : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {#if accordionOpen}
                <!-- 펼친 상태: 이미지4처럼 "N개의 검사" + 검사 카드들 -->
                <div class="bg-white px-5 pb-5 pt-4">
                  <p class="text-sm text-gray-600 mb-3">
                    {tasks.length}개의 검사
                  </p>
                  <div class="space-y-3 pl-0 sm:pl-1">
                    {#each tasks as t}
                      {@const expired = isTaskExpired(t)}
                      {@const dueDate = getDueDate(t)}
                      <article
                        class="rounded-lg bg-gray-50 border border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 {expired
                          ? 'opacity-75'
                          : ''}"
                      >
                        <div class="flex-1 min-w-0">
                          <p
                            class="text-base sm:text-lg font-semibold break-words {expired
                              ? 'text-gray-400'
                              : 'text-gray-800'}"
                          >
                            {t.assessment?.kor_name ?? '검사'}
                          </p>
                          <div
                            class="flex flex-col gap-0.5 mt-1.5 text-sm {expired
                              ? 'text-gray-400'
                              : ''}"
                          >
                            {#if getEstimatedTime(t)}
                              <p class="flex items-center gap-1.5">
                                <svg
                                  class="w-4 h-4 shrink-0 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span
                                  class="{expired
                                    ? 'text-gray-400'
                                    : 'text-gray-500'} text-xs">소요시간</span
                                >
                                <span
                                  class={expired
                                    ? 'text-gray-400'
                                    : 'text-gray-700'}
                                  >{getEstimatedTime(t)}</span
                                >
                              </p>
                            {/if}
                            {#if dueDate}
                              <p class="flex items-center gap-1.5">
                                <svg
                                  class="w-4 h-4 shrink-0 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span
                                  class="{expired
                                    ? 'text-gray-400'
                                    : 'text-gray-500'} text-xs"
                                  >검사 만료일</span
                                >
                                <span
                                  class={expired
                                    ? 'text-gray-400'
                                    : 'text-gray-700'}
                                  >{formatDate(dueDate)}</span
                                >
                              </p>
                            {/if}
                            {#if getTotalItems(t)}
                              <p class="flex items-center gap-1.5">
                                <svg
                                  class="w-4 h-4 shrink-0 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                                  />
                                </svg>
                                <span
                                  class="{expired
                                    ? 'text-gray-400'
                                    : 'text-gray-500'} text-xs">문항 수</span
                                >
                                <span
                                  class={expired
                                    ? 'text-gray-400'
                                    : 'text-gray-700'}
                                  >{getTotalItems(t)}문항</span
                                >
                              </p>
                            {/if}
                          </div>
                        </div>
                        {#if isTaskActionable(t)}
                          <button
                            type="button"
                            onclick={() => handleTaskClick(t)}
                            class="w-full sm:w-auto shrink-0 min-h-[48px] sm:h-11 px-5 rounded-lg bg-[#525252] text-white font-semibold text-sm hover:bg-[#404040] active:bg-[#404040] transition-colors touch-manipulation"
                          >
                            검사 시작
                          </button>
                        {:else if t.status === 'completed'}
                          <div
                            class="shrink-0 flex items-center gap-1.5 text-etc-orange font-medium text-sm"
                          >
                            <span
                              class="w-5 h-5 rounded-full bg-etc-orange flex items-center justify-center shrink-0"
                              aria-hidden="true"
                            >
                              <svg
                                class="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </span>
                            <span>완료</span>
                          </div>
                        {:else}
                          <span class="shrink-0 text-sm text-gray-400"
                            >만료</span
                          >
                        {/if}
                      </article>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- 세트 없을 때: 단일 검사 평면 카드 목록 -->
          <div class="space-y-4">
            {#each tasks as t}
              {@const expired = isTaskExpired(t)}
              {@const dueDate = getDueDate(t)}
              <article
                class="rounded-lg bg-gray-50 border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 {expired
                  ? 'opacity-75'
                  : ''}"
              >
                <div class="flex-1 min-w-0">
                  <p
                    class="text-base sm:text-lg font-semibold break-words {expired
                      ? 'text-gray-400'
                      : 'text-gray-800'}"
                  >
                    {t.assessment?.kor_name ?? '검사'}
                  </p>
                  <div
                    class="flex flex-col gap-0.5 mt-2 text-sm {expired
                      ? 'text-gray-400'
                      : ''}"
                  >
                    {#if getEstimatedTime(t)}
                      <p class="flex items-center gap-1.5">
                        <svg
                          class="w-4 h-4 shrink-0 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span
                          class="{expired
                            ? 'text-gray-400'
                            : 'text-gray-500'} text-xs">소요시간</span
                        >
                        <span
                          class={expired ? 'text-gray-400' : 'text-gray-700'}
                          >{getEstimatedTime(t)}</span
                        >
                      </p>
                    {/if}
                    {#if dueDate}
                      <p class="flex items-center gap-1.5">
                        <svg
                          class="w-4 h-4 shrink-0 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span
                          class="{expired
                            ? 'text-gray-400'
                            : 'text-gray-500'} text-xs">검사 만료일</span
                        >
                        <span
                          class={expired ? 'text-gray-400' : 'text-gray-700'}
                          >{formatDate(dueDate)}</span
                        >
                      </p>
                    {/if}
                    {#if getTotalItems(t)}
                      <p class="flex items-center gap-1.5">
                        <svg
                          class="w-4 h-4 shrink-0 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                          />
                        </svg>
                        <span
                          class="{expired
                            ? 'text-gray-400'
                            : 'text-gray-500'} text-xs">문항 수</span
                        >
                        <span
                          class={expired ? 'text-gray-400' : 'text-gray-700'}
                          >{getTotalItems(t)}문항</span
                        >
                      </p>
                    {/if}
                  </div>
                </div>
                {#if isTaskActionable(t)}
                  <button
                    type="button"
                    onclick={() => handleTaskClick(t)}
                    class="w-full sm:w-auto shrink-0 min-h-[48px] sm:h-11 px-5 rounded-lg bg-[#525252] text-white font-semibold text-sm hover:bg-[#404040] active:bg-[#404040] transition-colors touch-manipulation"
                  >
                    검사 시작
                  </button>
                {:else if t.status === 'completed'}
                  <div
                    class="shrink-0 flex items-center gap-1.5 text-etc-orange font-medium text-sm"
                  >
                    <span
                      class="w-5 h-5 rounded-full bg-etc-orange flex items-center justify-center"
                    >
                      <svg
                        class="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                    완료
                  </div>
                {:else}
                  <span class="shrink-0 text-sm text-gray-400">만료</span>
                {/if}
              </article>
            {/each}
          </div>
        {/if}

        <div class="mt-8 flex justify-center">
          <button
            type="button"
            onclick={handleGoToIdentify}
            class="text-gray-600 underline underline-offset-2 text-sm hover:text-gray-800"
          >
            내담자 변경
          </button>
        </div>
      {/if}
    </section>
  </main>
</div>
