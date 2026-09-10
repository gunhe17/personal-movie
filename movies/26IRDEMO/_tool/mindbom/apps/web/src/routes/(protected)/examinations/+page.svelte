<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { SvelteSet } from 'svelte/reactivity'
  import { institutionId } from '$lib/stores/institution.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import Select from '$lib/components/ui/Select.svelte'
  import PersonAvatar from '$lib/components/ui/PersonAvatar.svelte'
  import PageTitleSection from '$lib/components/ui/PageTitleSection.svelte'
  import ListCountHeader from '$lib/components/ui/ListCountHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import FilterResetButton from '$lib/components/ui/FilterResetButton.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { postRaw } from '$lib/services/api/instances'
  import { requireInstitutionId } from '$lib/stores/institution.store'
  import ExamCreateModal from '$lib/features/examination/common/components/ExamCreateModal.svelte'
  import ExamTypeBadge from '$lib/features/examination/common/components/ExamTypeBadge.svelte'
  import ExamStatusPill from '$lib/features/examination/common/components/ExamStatusPill.svelte'
  import Search from '$lib/assets/icons/Search.svelte'
  import Plus from '$lib/assets/icons/Plus.svelte'
  import DataTable from '$lib/components/ui/DataTable.svelte'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import FileText from '$lib/assets/icons/FileText.svelte'
  import ClientBirthGender from '$lib/features/clients/components/ClientBirthGender.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getExamList } from '$lib/features/examination/common/query-builders'
  import { useExamFilters } from '$lib/features/examination/common/hooks.svelte'
  import { filtersToApiParams } from '$lib/features/examination/common/filters'
  import { isConfirmed } from '$lib/features/examination/core/status'
  import type {
    ExamType,
    ExamStatus
  } from '$lib/features/examination/common/constants'
  import type {
    ExamItem,
    ExamListResponse
  } from '$lib/features/examination/common/types'
  import { examProgressPath } from '$lib/features/examination/common/exam-route'
  import {
    isSupportedExamType,
    EXAM_TYPES
  } from '$lib/features/examination/core/registry'
  import { examTypeLabel } from '$lib/features/examination/common/exam-visual'
  import {
    EXAM_STATUS_ORDER,
    EXAM_STATUS_VISUAL
  } from '$lib/features/examination/common/exam-visual'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { maskName } from '$lib/utils/masking'

  // --- Constants ---

  // 8개 상태를 모두 노출한다. 일부만 두면 대시보드 도넛에서 드릴다운해 온
  // 상태(ai_draft_ready 등)가 필터에 없어 화면과 선택값이 어긋난다.
  const STATUS_OPTIONS = [
    { value: 'all', label: '전체 상태' },
    ...EXAM_STATUS_ORDER.map((s) => ({
      value: s,
      label: EXAM_STATUS_VISUAL[s].label
    }))
  ]

  // 레지스트리에서 파생 — 새 검사를 붙이면 필터에 자동으로 나타난다.
  const TYPE_OPTIONS = [
    { value: 'all', label: '전체 검사' },
    ...EXAM_TYPES.map((t) => ({ value: t, label: examTypeLabel(t) }))
  ]

  // --- State ---

  const queryClient = useQueryClient()
  const filters = useExamFilters(page.url, '/examinations')

  let searchInput = $state(filters.search)

  // --- Queries (TanStack Svelte Query — placeholderData로 깜빡임 방지) ---

  const examQuery = queryBuilder<ExamListResponse, ExamListResponse>(
    getExamList,
    () => filtersToApiParams($institutionId ?? '', filters.buildFilters()),
    () => ({ enabled: Boolean($institutionId) })
  )

  // 집계(stats) 조회는 두지 않는다 — 상단 메트릭 카드를 걷어내면서 화면에
  // 쓰이는 데가 없어졌다. 같은 숫자는 대시보드가 보여준다.

  // --- Derived ---

  let items = $derived<ExamItem[]>(examQuery.data?.items ?? [])
  let total = $derived(examQuery.data?.total ?? 0)
  let totalPages = $derived(examQuery.data?.pages ?? 1)
  // 첫 진입 로딩만 스피너 (이후 검색/페이지네이션은 placeholderData 유지)
  let isInitialLoading = $derived(examQuery.isLoading)

  // --- Filter handlers (필터 변경 시 페이지 리셋은 hook 내부에서) ---

  function selectStatus(value: string) {
    filters.setStatus(value)
  }

  function selectType(value: string) {
    filters.setType(value)
  }

  function handleSearch(e: Event) {
    searchInput = (e.target as HTMLInputElement).value
    filters.setSearch(searchInput)
  }

  // hook의 reset()은 필터 모델만 비운다. 검색 input은 로컬 $state라
  // 여기서 같이 비우지 않으면 초기화 후에도 글자가 남는다.
  function resetFilters() {
    searchInput = ''
    filters.reset()
  }

  // --- Actions ---

  function openCreateModal() {
    modalStore.open({
      component: ExamCreateModal,
      props: {
        onConfirm: async (data: {
          client_id: string
          examiner_id: string
          exam_types: string[]
          scheduled_at?: string
          note?: string
        }) => {
          const instId = requireInstitutionId()
          const { exam_types, ...rest } = data
          if (exam_types.length <= 1) {
            // 단일 검사
            await postRaw(`/institutions/${instId}/examinations`, {
              ...rest,
              exam_type: exam_types[0]
            })
            snackbarStore.success('검사가 등록되었습니다.')
          } else {
            // 배터리 (복수 검사)
            await postRaw(`/institutions/${instId}/examinations/battery`, {
              ...rest,
              exam_types
            })
            snackbarStore.success(
              `${exam_types.length}개 검사가 등록되었습니다.`
            )
          }
          queryClient.invalidateQueries({
            queryKey: ['getExamList'],
            exact: false
          })
          // 대시보드 통계는 TanStack 캐시를 쓰지 않는다(fetchDashboardStats 직접 호출).
          // 예전에는 여기서 'getExamDashboardStats'도 무효화했는데, 그 키로
          // 조회하는 쿼리가 없어 아무 일도 하지 않았다.
        }
      },
      options: { size: 'md' }
    })
  }

  // --- Helpers ---

  /**
   * 검사일은 없을 수 있다 — 일정을 정하지 않고 등록한 검사.
   *
   * 그 자리를 등록일로 메우지 않는다. 아무도 그 날로 잡은 적이 없기 때문이다
   * (docs/온톨로지/앵커개념-제거.md). '-'로 비워 두고, 등록일은 제 컬럼에 적는다.
   */
  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  function openExam(item: ExamItem) {
    // 지원 판정은 레지스트리 하나에서 — 리터럴 배열로 재구현하면
    // 새 검사를 붙일 때 여기를 잊고 "준비 중입니다"가 뜬다.
    if (!isSupportedExamType(item.exam_type)) {
      snackbarStore.info(
        `${item.exam_type.toUpperCase()} 검사 화면은 준비 중입니다.`
      )
      return
    }
    goto(examProgressPath(item.id, item.exam_type))
  }

  // --- 배터리 그룹핑 (현재 페이지 내 묶음) ---
  // id: DataTable의 keyField. 배터리와 단일 검사가 한 배열에 섞이므로
  // 접두사로 갈라 둔다(검사 id와 배터리 id가 겹칠 일은 없지만 의도를 드러낸다).
  type ExamRow =
    | { kind: 'single'; id: string; exam: ExamItem }
    | {
        kind: 'battery'
        id: string
        battery_id: string
        exams: ExamItem[]
      }

  // 담는 값은 ExamRow.id(`b-${battery_id}`) — DataTable이 keyField로 조회한다.
  let expandedBatteries = $state(new SvelteSet<string>())

  let groupedRows = $derived.by((): ExamRow[] => {
    const counts = new Map<string, number>()
    for (const it of items) {
      if (it.battery_id)
        counts.set(it.battery_id, (counts.get(it.battery_id) ?? 0) + 1)
    }
    const rows: ExamRow[] = []
    const added = new Set<string>()
    for (const it of items) {
      const bid = it.battery_id
      if (bid && (counts.get(bid) ?? 0) >= 2) {
        if (added.has(bid)) continue
        added.add(bid)
        rows.push({
          kind: 'battery',
          id: `b-${bid}`,
          battery_id: bid,
          exams: items.filter((e) => e.battery_id === bid)
        })
      } else {
        rows.push({ kind: 'single', id: it.id, exam: it })
      }
    }
    return rows
  })

  function toggleBattery(rowId: string) {
    if (expandedBatteries.has(rowId)) expandedBatteries.delete(rowId)
    else expandedBatteries.add(rowId)
  }

  /**
   * 행 클릭의 의미가 행 종류마다 다르다 — 배터리는 펼치고, 단일은 연다.
   * DataTable은 onRowClick이 있으면 그쪽으로만 보내므로 여기서 가른다.
   */
  function activateRow(row: ExamRow) {
    if (row.kind === 'battery') toggleBattery(row.id)
    else openExam(row.exam)
  }

  function batteryDoneCount(exams: ExamItem[]): number {
    return exams.filter((e) => isConfirmed(e.status)).length
  }

  function startBatteryReport(exams: ExamItem[], e: MouseEvent) {
    e.stopPropagation()
    const confirmedExams = exams.filter((x) => isConfirmed(x.status))
    if (confirmedExams.length < 2) return
    // 종합보고서 에디터로 이동 (배터리 확정 검사 전체를 묶어 전달)
    const ids = confirmedExams.map((x) => x.id)
    goto(`/examinations/${ids[0]}/report?ids=${ids.join(',')}`)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!--
  한 화면에 담는다 — 페이지 자체는 스크롤하지 않고, 목록만 내부에서 스크롤한다.
  (상위 layout의 main이 overflow-y-auto라 h-full로 그 높이를 그대로 받는다)
-->
<div in:fade class="flex h-full min-h-0 flex-col p-4 md:p-6 lg:p-8">
  <PageTitleSection title="검사 현황" description="진행중인 검사를 관리합니다">
    {#snippet actions()}
      <button
        onclick={openCreateModal}
        class="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
      >
        <Plus size={18} />
        새 검사 등록
      </button>
    {/snippet}
  </PageTitleSection>

  <!-- ===== 필터 바 — 모든 컨트롤 높이 44(h-11) ===== -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 transition-colors focus-within:border-primary-300 sm:w-75"
    >
      <Search size={20} class="shrink-0 text-gray-400" />
      <input
        type="text"
        value={searchInput}
        oninput={handleSearch}
        placeholder="내담자 이름으로 검색"
        class="w-full bg-transparent text-body-02-normal-regular text-gray-900 outline-none placeholder:text-gray-400"
      />
    </div>

    <Select
      options={STATUS_OPTIONS}
      value={filters.status}
      onChange={(v) => selectStatus(v as string)}
      className="h-11 w-32"
      ariaLabel="상태 필터"
    />

    <!-- 검사 유형 -->
    <Select
      options={TYPE_OPTIONS}
      value={filters.type}
      onChange={(v) => selectType(v as string)}
      className="h-11 w-36"
      ariaLabel="검사 유형 필터"
    />

    <FilterResetButton
      onclick={resetFilters}
      disabled={!filters.hasActiveFilter}
    />
  </div>

  <ListCountHeader {total} unit="건" />

  <!-- ===== 테이블 + 페이지네이션 (페이지네이션은 컨테이너 하단 고정) ===== -->
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      {#if isInitialLoading}
        <div class="flex min-h-60 flex-1 items-center justify-center">
          <div
            class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
          ></div>
        </div>
      {:else if items.length === 0}
        <div class="flex min-h-60 flex-1 items-center justify-center">
          <EmptyState
            icon="assignment"
            title="등록된 검사가 없습니다"
            description="새 검사를 등록해보세요"
          />
        </div>
      {:else}
        {#snippet statusBadge(status: string)}
          <ExamStatusPill status={status as ExamStatus} />
        {/snippet}

        <!--
          내담자 셀 — 아바타 옆에 이름과 `생년월일 | 성별`을 2줄로 싣는다.
          배터리 행은 first(첫 검사)의 내담자를 대표로 쓴다.
        -->
        {#snippet clientCell({ item }: { item: ExamRow })}
          {@const c = item.kind === 'battery' ? item.exams[0] : item.exam}
          <div class="flex min-w-0 items-center gap-2.5">
            <PersonAvatar
              name={c.client_name ?? '?'}
              gender={c.client_gender}
              role="client"
              size={40}
            />
            <div class="min-w-0">
              <div class="truncate text-body-01-normal-semibold text-gray-900">
                {c.client_name
                  ? secretModeStore.enabled
                    ? maskName(c.client_name)
                    : c.client_name
                  : '-'}
              </div>
              <ClientBirthGender
                birthDate={c.client_birth_date}
                gender={c.client_gender}
                class="mt-1 text-body-02-normal-regular text-gray-500"
              />
            </div>
          </div>
        {/snippet}

        {#snippet examinerCell({ item }: { item: ExamRow })}
          {@const c = item.kind === 'battery' ? item.exams[0] : item.exam}
          <span class="truncate text-body-01-normal-regular text-gray-700">
            {c.examiner_name
              ? secretModeStore.enabled
                ? maskName(c.examiner_name)
                : c.examiner_name
              : '-'}
          </span>
        {/snippet}

        <!--
          배터리 표식은 검사 유형 칸에 둔다 — 묶였다는 사실은 "어떤 검사인가"에
          대한 정보이지 내담자 정보가 아니다. 이름 옆에 두면 긴 이름과 부딪혀
          칸이 찌그러졌다.
        -->
        {#snippet typeCell({ item }: { item: ExamRow })}
          {#if item.kind === 'battery'}
            <div class="flex min-w-0 flex-wrap items-center gap-1">
              <span
                class="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-caption-01-normal-medium text-primary-600"
                >배터리 · {item.exams.length}종</span
              >
              {#each item.exams as ex (ex.id)}
                <ExamTypeBadge type={ex.exam_type as ExamType} size="xs" />
              {/each}
            </div>
          {:else}
            <ExamTypeBadge type={item.exam.exam_type as ExamType} />
          {/if}
        {/snippet}

        {#snippet statusCell({ item }: { item: ExamRow })}
          {#if item.kind === 'battery'}
            {@const done = batteryDoneCount(item.exams)}
            {@const total = item.exams.length}
            <span
              class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold {done ===
              total
                ? 'text-green-600'
                : 'text-gray-600'}"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full {done === total
                  ? 'bg-green-500'
                  : 'bg-gray-400'}"
              ></span>
              확정 {done}/{total}
            </span>
          {:else}
            {@render statusBadge(item.exam.status)}
          {/if}
        {/snippet}

        <!--
          배터리 행은 first를 대표로 쓴다. 묶인 검사들의 일정이 다르면 첫 검사
          것만 보이지만, 배터리 자체가 폐기 예정이라 헬퍼를 만들지 않는다.
        -->
        {#snippet scheduledCell({ item }: { item: ExamRow })}
          {@const c = item.kind === 'battery' ? item.exams[0] : item.exam}
          <span class="truncate text-body-02-normal-regular text-gray-500"
            >{formatDate(c.scheduled_at)}</span
          >
        {/snippet}

        {#snippet createdCell({ item }: { item: ExamRow })}
          {@const c = item.kind === 'battery' ? item.exams[0] : item.exam}
          <span class="truncate text-body-02-normal-regular text-gray-500"
            >{formatDate(c.created_at)}</span
          >
        {/snippet}

        <!-- 펼침 표시 — 배터리 행에만. 두 획이 평평해졌다 반대로 꺾인다 -->
        {#snippet expandCell({ item }: { item: ExamRow })}
          {#if item.kind === 'battery'}
            <ChevronToggle
              open={expandedBatteries.has(item.id)}
              size={18}
              class="shrink-0 text-primary-500"
            />
          {/if}
        {/snippet}

        <!-- 펼침 상세 — 개별 검사 목록, 그 아래 종합보고서 -->
        {#snippet batteryDetail({ item }: { item: ExamRow })}
          {#if item.kind === 'battery'}
            {@const done = batteryDoneCount(item.exams)}
            <div class="flex flex-col gap-1">
              {#each item.exams as ex (ex.id)}
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation()
                    openExam(ex)
                  }}
                  class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100"
                >
                  <span
                    class="shrink-0 text-body-02-normal-regular text-gray-400"
                    >└</span
                  >
                  <ExamTypeBadge type={ex.exam_type as ExamType} size="xs" />
                  <span
                    class="min-w-0 flex-1 truncate text-body-01-normal-regular text-gray-700"
                    >{examTypeLabel(ex.exam_type)} 검사 진행</span
                  >
                  <span class="shrink-0">{@render statusBadge(ex.status)}</span>
                  <span
                    class="w-24 shrink-0 text-right text-body-02-normal-regular text-gray-500"
                    >{formatDate(ex.scheduled_at)}</span
                  >
                </button>
              {/each}

              <!--
                종합보고서는 개별 검사 목록 아래에 둔다 — 묶인 검사들을 합쳐
                만드는 것이므로 그 목록 다음이 순서에 맞다. 요약 행에 버튼으로
                있을 때는 좁은 상태 칸을 비집고 들어가 확정 표시와 부딪혔다.
              -->
              {#if done >= 2}
                <div class="flex items-center gap-2 px-2 pt-1.5">
                  <span
                    class="shrink-0 text-body-02-normal-regular text-gray-400"
                    >└</span
                  >
                  <button
                    onclick={(e) => startBatteryReport(item.exams, e)}
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-body-03-normal-medium text-white transition-colors hover:bg-primary-700"
                    title="확정된 검사로 종합보고서 작성"
                  >
                    <FileText size={13} />
                    종합보고서 작성
                  </button>
                  <span class="text-body-02-normal-regular text-gray-500"
                    >확정된 {done}개 검사를 묶어 작성합니다</span
                  >
                </div>
              {/if}
            </div>
          {/if}
        {/snippet}

        <DataTable
          data={groupedRows}
          onRowClick={activateRow}
          expanded={batteryDetail}
          isExpandable={(row: ExamRow) => row.kind === 'battery'}
          expandedKeys={expandedBatteries}
          onToggleExpand={toggleBattery}
          columns={[
            {
              key: 'client',
              label: '내담자',
              width: '2.2fr',
              render: clientCell
            },
            { key: 'examiner', label: '검사자', render: examinerCell },
            {
              key: 'type',
              label: '검사 유형',
              width: '1.4fr',
              render: typeCell
            },
            { key: 'status', label: '상태', render: statusCell },
            { key: 'scheduled', label: '검사일', render: scheduledCell },
            { key: 'created', label: '등록일', render: createdCell },
            {
              key: 'expand',
              label: '',
              width: '44px',
              align: 'center',
              render: expandCell
            }
          ]}
        />
      {/if}
    </div>

    <div class="shrink-0 pt-4">
      <Pagination
        page={filters.page}
        {totalPages}
        onPageChange={filters.setPage}
      />
    </div>
  </div>
</div>
