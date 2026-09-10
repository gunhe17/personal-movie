<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { modalStore } from '$lib/stores/modal'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'
  import AssessmentEndConfirmModal from '$lib/components/modal/AssessmentEndConfirmModal.svelte'

  const centerId = $derived(page.params.centerId ?? '')

  interface SetSummary {
    set_id?: string
    name?: string
  }

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

  interface AssessmentCase {
    id: string
    case_id?: string
    case_code: string
    status: string
    created_at: string
    set_name?: string | null
    assessment_summary?: Array<{ kor_name?: string; code?: string }>
    set_summary?: SetSummary | null
  }

  /** case + 해당 case의 온라인 tasks를 묶은 구조 */
  interface CaseWithTasks {
    case_info: AssessmentCase
    set_name: string | null
    created_at: string
    tasks: TaskItem[]
  }

  let clientId = $state<string | null>(null)
  let clientName = $state<string>('')
  let caseGroups = $state<CaseWithTasks[]>([])
  let loading = $state(true)
  let error = $state('')
  let openCaseIds = $state<Set<string>>(new Set())

  onMount(() => {
    const params = new URLSearchParams(page.url.search)
    const cid = params.get('clientId')
    if (!cid) {
      error = '내담자 정보가 없습니다. 처음부터 다시 진행해주세요.'
      loading = false
      return
    }
    clientId = cid
    void loadAllData(cid)
  })

  async function loadAllData(cid: string) {
    loading = true
    error = ''
    try {
      // 1. 해당 내담자의 검사 케이스 목록 조회
      const casesRes = await fetch(
        `/api/assessment/proxy/centers/${centerId}/assessment-cases/by-client/${cid}`
      )
      if (!casesRes.ok) {
        const err = await casesRes.json().catch(() => ({}))
        throw new Error(
          err.detail ?? err.message ?? '검사 목록을 불러오지 못했습니다.'
        )
      }
      const casesBody = await casesRes.json()
      // by-client 응답: AssessmentCaseResponse[] (배열)
      const rawItems = Array.isArray(casesBody)
        ? casesBody
        : (casesBody.items ?? casesBody.data ?? [])
      const cases: AssessmentCase[] = rawItems

      if (cases.length === 0) {
        error = '진행 가능한 검사가 없습니다.'
        return
      }

      // 2. 각 case의 상세(set_name, clients) + tasks를 병렬로 불러오기
      const results = await Promise.all(
        cases.map(async (c) => {
          const caseId = c.case_id ?? c.id
          const [caseDetailRes, tasksRes] = await Promise.all([
            fetch(
              `/api/assessment/proxy/centers/${centerId}/assessment-cases/${caseId}`
            ),
            fetch(
              `/api/assessment/proxy/centers/${centerId}/assessment-cases/${caseId}/tasks?execution_method=online`
            )
          ])

          let setName: string | null = c.set_summary?.name ?? null
          let createdAt = c.created_at
          let name = ''

          if (caseDetailRes.ok) {
            const detail = await caseDetailRes.json()
            setName = detail.set_name ?? setName
            createdAt = detail.created_at ?? createdAt
            const client = (detail.clients ?? []).find(
              (cl: { client_id: string; name: string }) => cl.client_id === cid
            )
            if (client?.name) name = client.name
          }

          let tasks: TaskItem[] = []
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json()
            tasks = Array.isArray(tasksData) ? tasksData : []
          }

          if (name && !clientName) clientName = name

          return {
            case_info: { ...c, id: caseId },
            set_name: setName,
            created_at: createdAt,
            tasks
          } satisfies CaseWithTasks
        })
      )

      // tasks가 있는 case만 표시
      caseGroups = results.filter((g) => g.tasks.length > 0)

      if (caseGroups.length === 0) {
        error = '온라인 검사가 없습니다.'
        return
      }

      // 첫 번째 세트 아코디언은 기본 펼침
      const firstSet = caseGroups.find((g) => !!g.set_name)
      if (firstSet) {
        openCaseIds = new Set([firstSet.case_info.id])
      }
    } catch (e) {
      error =
        e instanceof Error ? e.message : '검사 목록을 불러오지 못했습니다.'
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

  function getEstimatedTime(t: TaskItem): string | null {
    const minutes =
      t.assessment?.duration ?? t.assessment?.definition?.estimated_time ?? 0
    if (minutes > 0) return `약 ${minutes}분`
    return null
  }

  function getTotalItems(t: TaskItem): number | null {
    const n = t.assessment?.definition?.total_items
    return typeof n === 'number' && n > 0 ? n : null
  }

  function isTaskActionable(t: TaskItem): boolean {
    return t.status === 'pending' || t.status === 'in_progress'
  }

  /** 내담자 관점에서 완료 = 제출완료(submitted) 또는 검수완료(completed) */
  function isTaskDone(t: TaskItem): boolean {
    return t.status === 'submitted' || t.status === 'completed'
  }

  function isTaskExpired(t: TaskItem): boolean {
    return !isTaskActionable(t) && !isTaskDone(t)
  }

  function getDueDate(t: TaskItem): string | null {
    return t.assessment?.definition?.due_date ?? null
  }

  function getSetStatus(tasks: TaskItem[]): 'completed' | 'in_progress' {
    return tasks.every(
      (t) => t.status === 'submitted' || t.status === 'completed'
    )
      ? 'completed'
      : 'in_progress'
  }

  function toggleAccordion(caseId: string) {
    const next = new Set(openCaseIds)
    if (next.has(caseId)) {
      next.delete(caseId)
    } else {
      next.add(caseId)
    }
    openCaseIds = next
  }

  function handleTaskClick(caseId: string, t: TaskItem) {
    if (!isTaskActionable(t)) return
    const cid = clientId ?? ''
    const q = cid ? `?clientId=${cid}` : ''
    goto(`/assessment-flow/centers/${centerId}/${caseId}/tasks/${t.id}${q}`)
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

<div
  class="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-50 to-gray-100 flex flex-col"
>
  <AssessmentFlowHeader />

  <main
    class="flex-1 mx-auto max-w-[720px] w-full min-w-0 px-4 sm:px-8 py-6 sm:py-12 pb-[env(safe-area-inset-bottom)]"
  >
    <section class="w-full">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-24 gap-3">
          <div
            class="w-8 h-8 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin"
          ></div>
          <p class="text-sm text-gray-500">검사 목록을 불러오는 중...</p>
        </div>
      {:else if error === '진행 가능한 검사가 없습니다.' || error === '온라인 검사가 없습니다.'}
        <div class="rounded-lg bg-white p-10 sm:p-14 text-center shadow-sm">
          <div
            class="mx-auto mb-5 w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center"
          >
            <svg
              class="w-7 h-7 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p class="text-lg font-semibold text-gray-800 mb-2">
            {error === '진행 가능한 검사가 없습니다.'
              ? '진행 가능한 검사가 없습니다'
              : '온라인 검사가 없습니다'}
          </p>
          <p class="text-sm text-gray-500 mb-8">
            {error === '진행 가능한 검사가 없습니다.'
              ? '현재 진행 가능한 검사가 없습니다. 직원에게 문의하세요.'
              : '이번에는 센터 방문 검사만 있습니다. 직원에게 문의하세요.'}
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onclick={handleGoToIdentify}
              class="min-h-[44px] h-11 px-6 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition touch-manipulation"
            >
              처음으로
            </button>
          </div>
        </div>
      {:else if error}
        <div class="rounded-lg bg-white p-10 text-center shadow-sm">
          <div
            class="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 flex items-center justify-center"
          >
            <svg
              class="w-7 h-7 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
              />
            </svg>
          </div>
          <p class="text-sm text-red-600 mb-6">{error}</p>
          <button
            type="button"
            onclick={handleGoToIdentify}
            class="min-h-[44px] h-11 px-6 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition touch-manipulation"
          >
            처음으로
          </button>
        </div>
      {:else}
        <!-- 헤더 -->
        <div class="flex items-center justify-between mb-6 px-1">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-gray-900">
              {clientName ? `${clientName}님의 검사 목록` : '검사 목록'}
            </h2>
            <p class="text-sm text-gray-500 mt-1">진행할 검사를 선택해주세요</p>
          </div>
          <button
            type="button"
            onclick={handleGoToIdentify}
            class="min-h-[40px] h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-white hover:text-gray-700 transition touch-manipulation"
          >
            내담자 변경
          </button>
        </div>

        <!-- 검사 목록 -->
        <div class="space-y-3">
          {#each caseGroups as group}
            {#if group.set_name}
              <!-- 세트: 아코디언 -->
              {@const isOpen = openCaseIds.has(group.case_info.id)}
              {@const setStatus = getSetStatus(group.tasks)}
              {@const setDone = group.tasks.filter((t) => isTaskDone(t)).length}
              <div class="rounded-lg bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onclick={() => toggleAccordion(group.case_info.id)}
                  class="w-full flex items-center gap-4 py-4 px-5 sm:px-6 text-left hover:bg-gray-50/70 transition-colors"
                >
                  <div
                    class="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center {setStatus ===
                    'completed'
                      ? 'bg-emerald-50'
                      : 'bg-blue-50'}"
                  >
                    {#if setStatus === 'completed'}
                      <svg
                        class="w-5 h-5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    {:else}
                      <svg
                        class="w-5 h-5 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="font-semibold text-gray-900"
                      >{group.set_name}</span
                    >
                    <p class="text-xs text-gray-400 mt-0.5">
                      {setDone}/{group.tasks.length}개 완료
                    </p>
                  </div>
                  <svg
                    class="w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 {isOpen
                      ? 'rotate-180'
                      : ''}"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {#if isOpen}
                  <div class="px-5 sm:px-6 pb-5 pt-1 border-t border-gray-100">
                    <div class="space-y-2.5 mt-3">
                      {#each group.tasks as t, idx}
                        {@const expired = isTaskExpired(t)}
                        {@const done = isTaskDone(t)}
                        {@const actionable = isTaskActionable(t)}
                        <div
                          class="group rounded-lg border p-4 sm:p-5 flex items-center gap-4 transition-all {expired
                            ? 'border-gray-100 bg-gray-50/50 opacity-60'
                            : done
                              ? 'border-emerald-100 bg-emerald-50/30'
                              : actionable
                                ? 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm cursor-pointer'
                                : 'border-gray-100 bg-gray-50/50'}"
                          onclick={() =>
                            actionable &&
                            handleTaskClick(group.case_info.id, t)}
                          onkeydown={(e) =>
                            e.key === 'Enter' &&
                            actionable &&
                            handleTaskClick(group.case_info.id, t)}
                          role={actionable ? 'button' : undefined}
                          tabindex={actionable ? 0 : undefined}
                        >
                          <!-- 번호/상태 -->
                          <div
                            class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold {done
                              ? 'bg-emerald-500 text-white'
                              : actionable
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-200 text-gray-400'}"
                          >
                            {#if done}
                              <svg
                                class="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            {:else}
                              {idx + 1}
                            {/if}
                          </div>
                          <!-- 검사 정보 -->
                          <div class="flex-1 min-w-0">
                            <p
                              class="font-medium text-[15px] {expired
                                ? 'text-gray-400'
                                : done
                                  ? 'text-emerald-700'
                                  : 'text-gray-800'}"
                            >
                              {t.assessment?.kor_name ?? '검사'}
                            </p>
                            <div class="flex items-center gap-3 mt-1">
                              {#if getEstimatedTime(t)}
                                <span
                                  class="text-xs {expired
                                    ? 'text-gray-300'
                                    : 'text-gray-400'}"
                                >
                                  {getEstimatedTime(t)}
                                </span>
                              {/if}
                              {#if getTotalItems(t)}
                                <span
                                  class="text-xs {expired
                                    ? 'text-gray-300'
                                    : 'text-gray-400'}"
                                >
                                  {getTotalItems(t)}문항
                                </span>
                              {/if}
                            </div>
                          </div>
                          <!-- 액션 -->
                          {#if actionable}
                            <svg
                              class="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          {:else if done}
                            <span
                              class="text-xs font-medium text-emerald-600 shrink-0"
                              >완료</span
                            >
                          {:else if expired}
                            <span class="text-xs text-gray-400 shrink-0"
                              >만료</span
                            >
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {:else}
              <!-- 단일 검사 -->
              {#each group.tasks as t}
                {@const expired = isTaskExpired(t)}
                {@const done = isTaskDone(t)}
                {@const actionable = isTaskActionable(t)}
                <div
                  class="group rounded-lg bg-white shadow-sm border p-5 sm:p-6 flex items-center gap-4 transition-all {expired
                    ? 'border-gray-100 opacity-60'
                    : done
                      ? 'border-emerald-100'
                      : actionable
                        ? 'border-gray-100 hover:border-blue-200 hover:shadow-md cursor-pointer'
                        : 'border-gray-100'}"
                  onclick={() =>
                    actionable && handleTaskClick(group.case_info.id, t)}
                  onkeydown={(e) =>
                    e.key === 'Enter' &&
                    actionable &&
                    handleTaskClick(group.case_info.id, t)}
                  role={actionable ? 'button' : undefined}
                  tabindex={actionable ? 0 : undefined}
                >
                  <!-- 상태 아이콘 -->
                  <div
                    class="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center {done
                      ? 'bg-emerald-50'
                      : actionable
                        ? 'bg-blue-50'
                        : 'bg-gray-100'}"
                  >
                    {#if done}
                      <svg
                        class="w-5 h-5 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    {:else if actionable}
                      <svg
                        class="w-5 h-5 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    {:else}
                      <svg
                        class="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                    {/if}
                  </div>
                  <!-- 검사 정보 -->
                  <div class="flex-1 min-w-0">
                    <p
                      class="font-semibold text-[15px] sm:text-base {expired
                        ? 'text-gray-400'
                        : done
                          ? 'text-gray-700'
                          : 'text-gray-900'}"
                    >
                      {t.assessment?.kor_name ?? '검사'}
                    </p>
                    <div class="flex items-center gap-3 mt-1">
                      {#if getEstimatedTime(t)}
                        <span
                          class="text-xs {expired
                            ? 'text-gray-300'
                            : 'text-gray-400'}"
                        >
                          {getEstimatedTime(t)}
                        </span>
                      {/if}
                      {#if getTotalItems(t)}
                        <span
                          class="text-xs {expired
                            ? 'text-gray-300'
                            : 'text-gray-400'}"
                        >
                          {getTotalItems(t)}문항
                        </span>
                      {/if}
                    </div>
                  </div>
                  <!-- 액션 -->
                  {#if actionable}
                    <div class="shrink-0 flex items-center gap-2">
                      <span
                        class="text-sm font-medium text-blue-600 hidden sm:block group-hover:text-blue-700"
                        >시작</span
                      >
                      <svg
                        class="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  {:else if done}
                    <span
                      class="text-xs font-medium text-emerald-600 shrink-0 px-2.5 py-1 rounded-full bg-emerald-50"
                      >완료</span
                    >
                  {:else if expired}
                    <span class="text-xs text-gray-400 shrink-0">만료</span>
                  {/if}
                </div>
              {/each}
            {/if}
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>
