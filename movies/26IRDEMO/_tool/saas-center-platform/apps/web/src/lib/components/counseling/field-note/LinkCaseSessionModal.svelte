<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCounselingsByCenterId,
    getCounselingDetailById
  } from '$lib/hooks/actions/counseling.action'
  import {
    getCasesByCenterId,
    getCaseById
  } from '$lib/hooks/actions/case.action'
  import { centerId } from '$lib/stores/center.store'
  import { formatUtcToKst } from '$lib/utils/date'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'

  interface Props {
    closeModal?: () => void
    onConfirm?: (scheduleId: string) => void | Promise<void>
  }

  let { closeModal, onConfirm }: Props = $props()

  type CaseTypeTab = 'counseling' | 'assessment'

  let step = $state<1 | 2>(1)
  let caseTypeTab = $state<CaseTypeTab>('counseling')
  let searchInput = $state('')
  let searchQuery = $state('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  let selectedCaseId = $state<string | null>(null)
  let selectedScheduleId = $state<string | null>(null)
  let selectedAssessmentTaskId = $state<string | null>(null)
  let isSubmitting = $state(false)

  type CaseStatusChip = 'all' | 'active' | 'completed'
  let caseStatusChip = $state<CaseStatusChip>('all')

  const STATUS_CHIPS: { value: CaseStatusChip; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'active', label: '진행중' },
    { value: 'completed', label: '완료' }
  ]

  // 탭별로 백엔드 status 값이 달라 매핑이 필요함
  // - counseling: 'active' / 'completed'
  // - assessment: 'processing' / 'completed'
  function chipToCounselingStatus(chip: CaseStatusChip): string | undefined {
    return chip === 'all' ? undefined : chip
  }
  function chipToAssessmentStatus(chip: CaseStatusChip): string | undefined {
    if (chip === 'all') return undefined
    if (chip === 'active') return 'processing'
    return 'completed'
  }

  function handleSearchInput(e: Event) {
    searchInput = (e.currentTarget as HTMLInputElement).value
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.trim()
    }, 250)
  }

  function handleTabChange(tab: string) {
    const next = tab as CaseTypeTab
    if (next === caseTypeTab) return
    caseTypeTab = next
    selectedCaseId = null
    selectedScheduleId = null
    selectedAssessmentTaskId = null
  }

  // 상담 케이스 목록
  const counselingsQuery = $derived(
    queryBuilder(
      getCounselingsByCenterId,
      () =>
        $centerId
          ? {
              centerId: $centerId,
              queryParams: {
                page: 1,
                size: 50,
                sort: 'desc' as const,
                search: searchQuery || undefined,
                status: chipToCounselingStatus(caseStatusChip)
              }
            }
          : (null as any),
      () => ({
        enabled: !!$centerId && step === 1 && caseTypeTab === 'counseling'
      })
    )
  )

  // 검사 케이스 목록 (필드노트는 현장 녹음이라 세션 있는 케이스만)
  const assessmentCasesQuery = $derived(
    queryBuilder(
      getCasesByCenterId,
      () => ({
        centerId: $centerId,
        queryParams: {
          page: 1,
          size: 50,
          search: searchQuery || undefined,
          status: chipToAssessmentStatus(caseStatusChip),
          has_schedule: true
        }
      }),
      () => ({
        enabled: !!$centerId && step === 1 && caseTypeTab === 'assessment'
      })
    )
  )

  interface CaseListVM {
    caseId: string
    primaryName: string
    primaryBirth: string | null
    primaryGender: string | null
    extraCount: number
    subtitle: string
    progress: string
    scheduledStart: string | null
  }

  const caseItems = $derived<CaseListVM[]>(
    (() => {
      if (caseTypeTab === 'counseling') {
        const items = counselingsQuery.data?.items ?? []
        return items.map((item) => {
          const primary = item.clients?.[0]
          const typeLabel =
            item.case_type === 'individual'
              ? '개인'
              : item.case_type === 'group'
                ? '그룹'
                : item.case_type
          return {
            caseId: item.case_id,
            primaryName: primary?.name ?? '-',
            primaryBirth: primary?.birth_date ?? null,
            primaryGender: primary?.gender ?? null,
            extraCount: Math.max((item.clients?.length ?? 0) - 1, 0),
            subtitle:
              `${item.program_name ?? ''}${typeLabel ? ` - ${typeLabel}` : ''}`.trim(),
            progress: `${item.completed_sessions}/${item.total_sessions}`,
            scheduledStart: null
          }
        })
      }
      const items = assessmentCasesQuery.data?.data ?? []
      return items.map((item: any) => {
        const primary = item.clients?.[0]
        const names = (item.assessment_names ?? []) as string[]
        const subtitle = item.set_name
          ? item.set_name
          : names.length > 1
            ? `${names[0]} 외 ${names.length - 1}건`
            : (names[0] ?? '-')
        return {
          caseId: item.case_id,
          primaryName: primary?.name ?? '-',
          primaryBirth: primary?.birth_date ?? null,
          primaryGender: primary?.gender ?? null,
          extraCount: Math.max((item.clients?.length ?? 0) - 1, 0),
          subtitle,
          progress: `${item.completed_count ?? 0}/${item.total_count ?? 0}`,
          scheduledStart: item.scheduled_start ?? null
        }
      })
    })()
  )

  const isCasesLoading = $derived(
    caseTypeTab === 'counseling'
      ? counselingsQuery.isLoading
      : assessmentCasesQuery.isLoading
  )

  const counselingDetailQuery = $derived(
    queryBuilder(
      getCounselingDetailById,
      () => ({
        centerId: $centerId!,
        counselingId: selectedCaseId ?? ''
      }),
      () => ({
        enabled:
          !!$centerId &&
          !!selectedCaseId &&
          step === 2 &&
          caseTypeTab === 'counseling'
      })
    )
  )

  const assessmentDetailQuery = $derived(
    queryBuilder(
      getCaseById,
      () => ({
        centerId: $centerId,
        caseId: selectedCaseId ?? ''
      }),
      () => ({
        enabled:
          !!$centerId &&
          !!selectedCaseId &&
          step === 2 &&
          caseTypeTab === 'assessment'
      })
    )
  )

  interface ScheduleListVM {
    scheduleId: string
    start: string | Date
    counselorName: string
    roomName: string
    status: string
  }

  const scheduleItems = $derived<ScheduleListVM[]>(
    caseTypeTab === 'counseling'
      ? (counselingDetailQuery.data?.sessions ?? []).map((s) => ({
          scheduleId: s.schedule_id,
          start: s.start,
          counselorName: s.counselors?.[0]?.counselor_name ?? '-',
          roomName: s.room_name ?? '-',
          status: s.status
        }))
      : []
  )

  interface AssessmentTaskVM {
    taskId: string
    name: string
    status: string
  }

  const assessmentTaskItems = $derived<AssessmentTaskVM[]>(
    (assessmentDetailQuery.data?.data?.tasks ?? []).map((t) => ({
      taskId: t.id,
      name: t.assessment_name || '-',
      status: t.status
    }))
  )

  const assessmentScheduleId = $derived(
    assessmentDetailQuery.data?.data?.schedule?.schedule_id ?? null
  )

  const isDetailLoading = $derived(
    caseTypeTab === 'counseling'
      ? counselingDetailQuery.isLoading
      : assessmentDetailQuery.isLoading
  )

  const TABS = [
    { value: 'counseling', label: '상담' },
    { value: 'assessment', label: '검사' }
  ]

  const SESSION_STATUS_LABELS: Record<string, string> = {
    scheduled: '예정',
    completed: '완료',
    cancelled: '취소'
  }

  const SESSION_STATUS_STYLES: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-600',
    completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500'
  }

  const TASK_STATUS_LABELS: Record<string, string> = {
    pending: '대기',
    in_progress: '진행중',
    submitted: '제출',
    completed: '완료',
    refused: '거부',
    cancelled: '취소'
  }

  const TASK_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-blue-50 text-blue-600',
    submitted: 'bg-blue-50 text-blue-600',
    completed: 'bg-green-50 text-green-700',
    refused: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-gray-100 text-gray-500'
  }

  function handleSelectCase(caseId: string) {
    selectedCaseId = caseId
  }

  function handleNext() {
    if (!selectedCaseId) return
    step = 2
    selectedScheduleId = null
    selectedAssessmentTaskId = null
  }

  function handleBack() {
    step = 1
    selectedScheduleId = null
    selectedAssessmentTaskId = null
  }

  const confirmableScheduleId = $derived(
    caseTypeTab === 'counseling'
      ? selectedScheduleId
      : selectedAssessmentTaskId
        ? assessmentScheduleId
        : null
  )

  const headerSubtitle = $derived(
    step === 1
      ? caseTypeTab === 'counseling'
        ? '상담을 선택해주세요'
        : '검사를 선택해주세요'
      : caseTypeTab === 'counseling'
        ? '연결할 회기를 선택해주세요'
        : '연결할 검사를 선택해주세요'
  )

  async function handleConfirm() {
    if (!confirmableScheduleId) return
    isSubmitting = true
    try {
      await onConfirm?.(confirmableScheduleId)
      closeModal?.()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  closeModal={() => closeModal?.()}
  headerClass="px-5 py-4 items-start"
  footerClass="px-5 pt-4 pb-5 h-[80px]"
  bodyScrollable={false}
  bodyClass="flex min-h-0 flex-1 flex-col"
  showHeaderBorder={true}
>
  {#snippet header()}
    <div class="flex flex-col gap-2">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        필드노트를 연결할게요
      </Typography>
      <Typography variant="body-01-normal-medium" color="text-gray-600">
        {headerSubtitle}
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    {#if step === 1}
      <div class="px-5 pt-5">
        <!-- 탭 (상담 / 검사) -->
        <TabBar
          tabs={TABS}
          activeTab={caseTypeTab}
          onTabChange={handleTabChange}
          class="shrink-0 "
        />
      </div>

      <!-- 바디 -->
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 pb-7">
        <!-- 검색 -->
        <div class="relative shrink-0">
          <div class="absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="내담자 이름을 입력해주세요"
            value={searchInput}
            oninput={handleSearchInput}
            class="field-input pl-10 text-body-01-normal-regular text-gray-700 outline-none transition-colors placeholder:text-placeholder focus:border-gray-300"
          />
        </div>

        <!-- 상태 칩 -->
        <div class="flex shrink-0 flex-wrap items-center gap-1">
          {#each STATUS_CHIPS as chip (chip.value)}
            {@const isActive = caseStatusChip === chip.value}
            <button
              type="button"
              onclick={() => {
                caseStatusChip = chip.value
                selectedCaseId = null
              }}
              class="h-[35px] rounded-full px-4 transition-colors {isActive
                ? 'bg-gray-700'
                : 'border border-gray-200 bg-white hover:bg-gray-50'}"
            >
              <Typography
                variant="body-01-normal-medium"
                color={isActive ? 'text-gray-50' : 'text-gray-500'}
              >
                {chip.label}
              </Typography>
            </button>
          {/each}
        </div>

        <!-- 케이스 리스트 + 하단 fade -->
        <div class="relative min-h-0 flex-1">
          <div class="absolute inset-0 overflow-y-auto">
            {#if isCasesLoading}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  불러오는 중...
                </Typography>
              </div>
            {:else if caseItems.length === 0}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  {caseTypeTab === 'counseling'
                    ? '해당하는 상담이 없어요'
                    : '해당하는 검사가 없어요'}
                </Typography>
              </div>
            {:else}
              <ul class="flex flex-col gap-2 px-0.5 pt-0.5 pb-4">
                {#each caseItems as item (item.caseId)}
                  {@const isActive = selectedCaseId === item.caseId}
                  <li>
                    <button
                      type="button"
                      onclick={() => handleSelectCase(item.caseId)}
                      class="flex h-[74px] w-full items-center justify-between gap-3 rounded-lg px-4 text-left transition-colors {isActive
                        ? 'bg-primary-50'
                        : 'bg-gray-50 hover:bg-gray-100'}"
                    >
                      <div class="flex flex-col gap-1 min-w-0">
                        <div
                          class="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                        >
                          <Typography
                            variant="body-01-normal-semibold"
                            color="text-gray-900"
                          >
                            {item.primaryName}
                          </Typography>
                          <ClientBirthGender
                            birthDate={item.primaryBirth}
                            gender={item.primaryGender}
                          />
                          {#if item.extraCount > 0}
                            <Typography
                              variant="body-03-normal-regular"
                              color="text-gray-400"
                            >
                              외 {item.extraCount}명
                            </Typography>
                          {/if}
                        </div>
                        <Typography
                          variant="body-02-normal-regular"
                          color="text-gray-500"
                        >
                          {item.subtitle}
                        </Typography>
                      </div>
                      {#if caseTypeTab === 'assessment'}
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-500"
                          className="shrink-0"
                        >
                          {item.scheduledStart
                            ? formatUtcToKst(
                                item.scheduledStart,
                                'YYYY-MM-DD(d) HH:mm'
                              )
                            : '-'}
                        </Typography>
                      {:else}
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-500"
                          className="shrink-0"
                        >
                          {item.progress}
                        </Typography>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <!-- 하단 fade (더 있음을 암시) -->
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent"
          ></div>
        </div>
      </div>
    {:else if caseTypeTab === 'counseling'}
      <!-- 바디 (회기 리스트) -->
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-5">
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          className="shrink-0"
        >
          총 {scheduleItems.length}회기
        </Typography>
        <div class="relative min-h-0 flex-1">
          <div class="absolute inset-0 overflow-y-auto">
            {#if isDetailLoading}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  불러오는 중...
                </Typography>
              </div>
            {:else if scheduleItems.length === 0}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  회기가 없어요
                </Typography>
              </div>
            {:else}
              <ul class="flex flex-col gap-2 px-0.5 pt-0.5 pb-4">
                {#each scheduleItems as sched (sched.scheduleId)}
                  {@const isActive = selectedScheduleId === sched.scheduleId}
                  {@const statusLabel =
                    SESSION_STATUS_LABELS[sched.status] ?? sched.status}
                  {@const statusStyle =
                    SESSION_STATUS_STYLES[sched.status] ??
                    'bg-gray-100 text-gray-500'}
                  <li>
                    <button
                      type="button"
                      onclick={() => (selectedScheduleId = sched.scheduleId)}
                      class="flex h-[74px] w-full items-center justify-between gap-3 rounded-lg border px-4 text-left transition-colors {isActive
                        ? 'bg-primary-50 border-primary-400'
                        : 'bg-white border-gray-200 hover:bg-gray-50'}"
                    >
                      <div class="flex flex-col gap-0.5 min-w-0">
                        <Typography
                          variant="body-01-normal-semibold"
                          color="text-gray-900"
                        >
                          {formatUtcToKst(sched.start, 'YYYY-MM-DD(d) HH:mm')}
                        </Typography>
                        <Typography
                          variant="body-03-normal-regular"
                          color="text-gray-500"
                        >
                          {sched.counselorName} · {sched.roomName}
                        </Typography>
                      </div>
                      <span
                        class="shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium {statusStyle}"
                      >
                        {statusLabel}
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent"
          ></div>
        </div>
      </div>
    {:else}
      <!-- 바디 (검사 리스트) -->
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-5">
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          className="shrink-0"
        >
          총 {assessmentTaskItems.length}개
        </Typography>
        <div class="relative min-h-0 flex-1">
          <div class="absolute inset-0 overflow-y-auto">
            {#if isDetailLoading}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  불러오는 중...
                </Typography>
              </div>
            {:else if assessmentTaskItems.length === 0}
              <div class="flex items-center justify-center py-10">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  검사가 없어요
                </Typography>
              </div>
            {:else}
              <ul class="flex flex-col gap-2 px-0.5 pt-0.5 pb-4">
                {#each assessmentTaskItems as task (task.taskId)}
                  {@const isActive = selectedAssessmentTaskId === task.taskId}
                  {@const statusLabel =
                    TASK_STATUS_LABELS[task.status] ?? task.status}
                  {@const statusStyle =
                    TASK_STATUS_STYLES[task.status] ??
                    'bg-gray-100 text-gray-500'}
                  <li>
                    <button
                      type="button"
                      onclick={() => (selectedAssessmentTaskId = task.taskId)}
                      class="flex h-[60px] w-full items-center justify-between gap-3 rounded-lg border px-4 text-left transition-colors {isActive
                        ? 'bg-primary-50 border-primary-400'
                        : 'bg-white border-gray-200 hover:bg-gray-50'}"
                    >
                      <Typography
                        variant="body-01-normal-medium"
                        color="text-gray-900"
                        className="min-w-0 truncate-safe"
                      >
                        {task.name}
                      </Typography>
                      <span
                        class="shrink-0 inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium {statusStyle}"
                      >
                        {statusLabel}
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent"
          ></div>
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if step === 1}
      <button
        type="button"
        onclick={handleNext}
        disabled={!selectedCaseId}
        class="h-11 w-[140px] rounded-[8px] text-body-01-normal-medium text-white transition-colors {selectedCaseId
          ? 'bg-primary-500 hover:bg-primary-600'
          : 'cursor-not-allowed bg-primary-300'}"
      >
        다음
      </button>
    {:else}
      <button
        type="button"
        onclick={handleBack}
        class="h-11 w-[140px] rounded-[8px] border border-gray-200 bg-white text-body-01-normal-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        이전
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!confirmableScheduleId || isSubmitting}
        class="h-11 w-[140px] rounded-[8px] text-body-01-normal-medium text-white transition-colors {confirmableScheduleId &&
        !isSubmitting
          ? 'bg-primary-500 hover:bg-primary-600'
          : 'cursor-not-allowed bg-primary-300'}"
      >
        연결
      </button>
    {/if}
  {/snippet}
</BaseModal>
