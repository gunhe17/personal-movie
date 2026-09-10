<script lang="ts">
  // ============================================================
  // 바우처 현황 — 바우처(사업) 기준
  // ============================================================
  //
  // 좌: 센터가 쓰는 바우처(사업) 레일 / 우: 그 사업을 쓰는 내담자 테이블.
  // 내담자를 골라 서류를 일괄 발급하는 것이 이 화면의 일이다.
  // (옛 내담자 기준 목록은 내담자 도메인과 겹쳐 폐기 — 한 사람의 여러 바우처는
  //  내담자 상세 `바우처` 탭이 정본이다.)
  //
  // 데이터 제약 — `/voucher-clients`가 내담자 축이라 center_voucher_id 필터가 없다.
  //   · 센터 전체를 상한(VOUCHER_ROW_LOAD_SIZE) 안에서 한 번에 받아 화면에서 사업별로 가른다
  //   · 사업 매칭 키가 id가 아니라 이름(catalog.name)이다
  //   백엔드에 `center_voucher_id` 필터가 생기면 둘 다 걷어낸다.

  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'

  import Typography from '@common/components/Typography.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import Table, { type TableColumn } from '$lib/components/Table.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import Select from '$lib/components/Select.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import ArrowRightIcon16 from '$lib/assets/ArrowRightIcon16.svelte'
  import VoucherDocumentIssueModal from '$lib/components/voucher/VoucherDocumentIssueModal.svelte'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getVoucherClientList } from '$lib/hooks/actions/clientVoucher.action'
  import { getCenterVoucherList } from '$lib/hooks/actions/centerVoucher.action'
  import { centerId } from '$lib/stores/center.store'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { hasPermission } from '$lib/stores/permission.view'
  import { maskName } from '$lib/utils/maskingHandler'
  import { responsive } from '$lib/stores/responsive.svelte'

  import { useVoucherClientFilters } from '$lib/features/voucher/clients/hooks.svelte'
  import { buildVoucherClientListInput } from '$lib/features/voucher/clients/query-builders'
  import {
    flattenVoucherProgramRows,
    type VoucherProgramRowVM
  } from '$lib/features/voucher/clients/view-model'
  import {
    VOUCHER_ROW_LOAD_SIZE,
    VOUCHER_ROW_SORT_OPTIONS,
    VOUCHER_STATUS_TABS,
    type VoucherRowSort
  } from '$lib/features/voucher/clients/constants'
  import type { VoucherStatusFilter } from '$lib/features/voucher/clients/filters'
  import { mapToCenterVoucherVMs } from '$lib/features/voucher/center-voucher/view-model'
  import { buildCenterVoucherListInput } from '$lib/features/voucher/center-voucher/query-builders'
  import { DEFAULT_FILTERS as CENTER_VOUCHER_DEFAULTS } from '$lib/features/voucher/center-voucher/filters'

  const queryClient = useQueryClient()
  const pathname = page.url.pathname
  const filters = useVoucherClientFilters(page.url, pathname)
  const isOverlayMode = $derived(!responsive.isDesktop)
  const canWrite = $derived($hasPermission('write:voucher'))

  /** 만료 임박 배지 기준 — D-7 이하에만 붙인다 */
  const URGENT_DAYS = 7

  // ── 좌 레일: 센터가 쓰는 사업 ──
  const programQuery = $derived(
    queryBuilder(getCenterVoucherList, () =>
      buildCenterVoucherListInput($centerId, CENTER_VOUCHER_DEFAULTS)
    )
  )
  const allPrograms = $derived(mapToCenterVoucherVMs(programQuery.data?.items))

  let hideEnded = $state(true)
  // 내담자 목록이 스크롤됐는지 — 고정 영역(패널 헤더·필터 툴바) 그림자 on/off
  let isRowsScrolled = $state(false)
  let programSearch = $state('')

  const endedCount = $derived(allPrograms.filter((p) => p.isExpired).length)
  /** 레일의 범위(= `전체` 행이 세는 대상) — 종료 숨김만 반영 */
  const railPrograms = $derived(
    hideEnded ? allPrograms.filter((p) => !p.isExpired) : allPrograms
  )
  /** 실제로 그리는 목록 — 사업 검색은 목록만 좁힌다(전체 카운트는 안 흔든다) */
  const railListPrograms = $derived(
    programSearch.trim()
      ? railPrograms.filter((p) => p.catalogName.includes(programSearch.trim()))
      : railPrograms
  )

  // ── 우 패널: 행(내담자 × 바우처) ──
  // 검색·상태·시그널은 서버 필터, 사업 분류·정렬은 화면에서 한다(위 데이터 제약 참고)
  const rowQuery = $derived(
    queryBuilder(getVoucherClientList, () => ({
      ...buildVoucherClientListInput($centerId!, filters.buildFilters()),
      page: 1,
      size: VOUCHER_ROW_LOAD_SIZE
    }))
  )
  const loadedClients = $derived(rowQuery.data?.items ?? [])
  const totalClients = $derived(rowQuery.data?.total ?? 0)
  /** 상한에 걸려 일부만 받은 상태 — 화면에 고지한다 */
  const isCapped = $derived(totalClients > VOUCHER_ROW_LOAD_SIZE)

  const allRows = $derived(flattenVoucherProgramRows(loadedClients))

  // 레일(좌측 사업 목록) 카운트 전용 — status 칩만 'all'로 고정한 같은 조회.
  // 레일 숫자는 "이 사업에 몇 명이 있나"라는 고정 사실이라 칩(진행중/완료)을 따라
  // 흔들리면 안 된다. 검색 등 나머지 축은 그대로 반영한다.
  const railCountQuery = $derived(
    queryBuilder(getVoucherClientList, () => ({
      ...buildVoucherClientListInput($centerId!, {
        ...filters.buildFilters(),
        status: 'all'
      }),
      page: 1,
      size: VOUCHER_ROW_LOAD_SIZE
    }))
  )
  const railRows = $derived(
    flattenVoucherProgramRows(railCountQuery.data?.items ?? [])
  )

  const activeProgram = $derived(
    filters.voucherId
      ? (allPrograms.find((p) => p.id === filters.voucherId) ?? null)
      : null
  )
  const isAllView = $derived(!activeProgram)

  /** 사업별 행 수 — 상태 칩과 무관한 '전체' 기준(railRows) */
  const rowCountByProgram = $derived.by(() => {
    const map = new Map<string, number>()
    for (const row of railRows) {
      map.set(row.programName, (map.get(row.programName) ?? 0) + 1)
    }
    return map
  })
  const countOfProgram = (catalogName: string) =>
    rowCountByProgram.get(catalogName) ?? 0
  const visibleRowCount = $derived(
    railPrograms.reduce((sum, p) => sum + countOfProgram(p.catalogName), 0)
  )

  const baseRows = $derived(
    activeProgram
      ? allRows.filter((r) => r.programName === activeProgram.catalogName)
      : allRows.filter((r) =>
          railPrograms.some((p) => p.catalogName === r.programName)
        )
  )

  let sort = $state<VoucherRowSort>('expiring')

  const rows = $derived.by(() => {
    const sorted = [...baseRows]
    if (sort === 'expiring') {
      sorted.sort((a, b) => (a.dday ?? 99999) - (b.dday ?? 99999))
    } else if (sort === 'remaining') {
      sorted.sort((a, b) => a.remainingSessions - b.remainingSessions)
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    return sorted
  })

  // ── 선택 ──
  let selectedIds = $state<string[]>([])
  const selectedRows = $derived(rows.filter((r) => selectedIds.includes(r.id)))

  /** 사업·필터가 바뀌면 선택은 버린다 (보이지 않는 행이 선택된 채 남지 않도록) */
  $effect(() => {
    void filters.voucherId
    void filters.status
    void filters.searchQuery
    selectedIds = []
  })

  const allChecked = $derived(
    rows.length > 0 && selectedIds.length === rows.length
  )
  const toggleRow = (id: string) => {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((v) => v !== id)
      : [...selectedIds, id]
  }
  const toggleAll = () => {
    selectedIds = allChecked ? [] : rows.map((r) => r.id)
  }

  // ── 서류 준비 ──
  let issueModalOpen = $state(false)
  const onIssued = () => {
    queryClient.invalidateQueries({
      queryKey: ['getVoucherFormInstances'],
      exact: false
    })
    selectedIds = []
  }

  const openRowDetail = (row: VoucherProgramRowVM) =>
    goto(`/vouchers/${row.id}`)

  const displayName = (name: string) => ($isSecretMode ? maskName(name) : name)
  const formatDate = (date: string | null) =>
    date ? date.replaceAll('-', '. ') : '-'

  // ── 테이블 컬럼 ──
  // 서류 진행(n/m) 열은 아직 없다 — 바우처별 서류 집계 API가 생기면 추가한다.
  const columns = $derived.by<TableColumn<VoucherProgramRowVM>[]>(() => {
    const base: TableColumn<VoucherProgramRowVM>[] = [
      {
        // 체크박스 시각 박스는 20 — 열을 28로 잡아 오른쪽에 8을 남긴다.
        // 실제 간격 = 열 여유 8 + Table 열 gap 16 = 24 (한 단계 넓힘, 이전 20).
        // Table의 gap을 건드리면 이 테이블을 쓰는 다른 화면의 모든 열이 같이 벌어진다.
        key: 'select',
        label: '',
        width: '28px',
        stopPropagation: true,
        headerRender: selectHeader,
        render: selectCell
      },
      {
        key: 'client',
        label: '내담자',
        width: 'minmax(160px, 1fr)',
        render: clientCell
      }
    ]
    if (isAllView) {
      base.push({
        key: 'program',
        label: '바우처',
        width: 'minmax(140px, 1fr)',
        render: programCell
      })
    }
    base.push(
      {
        key: 'sessions',
        label: '사용 회기',
        width: '168px',
        render: sessionCell
      },
      { key: 'valid', label: '유효기간', width: '164px', render: validCell },
      { key: 'go', label: '', width: '24px', align: 'center', render: goCell }
    )
    return base
  })
</script>

{#snippet selectHeader()}
  <Checkbox id="voucher-select-all" checked={allChecked} onchange={toggleAll} />
{/snippet}

{#snippet selectCell({ item }: { item: VoucherProgramRowVM })}
  <Checkbox
    id={`voucher-row-${item.id}`}
    checked={selectedIds.includes(item.id)}
    onchange={() => toggleRow(item.id)}
  />
{/snippet}

{#snippet clientCell({ item }: { item: VoucherProgramRowVM })}
  <div class="flex min-w-0 items-center gap-3">
    <ClientAvatar
      profileImageUrl={item.profileImageUrl}
      name={displayName(item.name)}
      gender={item.gender}
      sizeClass="h-10 w-10"
      textClass="text-body-02-normal-semibold"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-800"
        className="truncate-safe"
        tag="span"
      >
        {displayName(item.name)}
      </Typography>
      <ClientBirthGender birthDate={item.birth || null} gender={item.gender} />
    </div>
  </div>
{/snippet}

{#snippet programCell({ item }: { item: VoucherProgramRowVM })}
  <Typography
    variant="body-01-normal-regular"
    color="text-gray-600"
    className="truncate-safe"
    tag="span"
  >
    {item.programName}
  </Typography>
{/snippet}

{#snippet sessionCell({ item }: { item: VoucherProgramRowVM })}
  {@const used = Math.max(0, item.totalSessions - item.remainingSessions)}
  {@const isCompleted = item.totalSessions > 0 && item.remainingSessions <= 0}
  {@const pct =
    item.totalSessions > 0
      ? Math.min(100, Math.round((used / item.totalSessions) * 100))
      : 0}
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline gap-1">
      <Typography variant="body-01-normal-medium" color="text-gray-800">
        {used}
      </Typography>
      <Typography variant="body-03-normal-regular" color="text-body-subtle">
        / {item.totalSessions}회
      </Typography>
    </div>
    <!-- 색 규칙은 상담 현황과 동일: 완료(소진)=primary-500 / 진행중=gray-500.
         숫자·막대 모두 '사용' 기준 — 잔여를 그리면 소진 시 폭이 0이라
         완료색이 칠해질 자리가 없고, 숫자와 막대가 반대로 움직인다. -->
    <div class="h-1 w-32 overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full {isCompleted
          ? 'bg-primary-500'
          : 'bg-gray-500'}"
        style="width: {pct}%"
      ></div>
    </div>
  </div>
{/snippet}

{#snippet validCell({ item }: { item: VoucherProgramRowVM })}
  <div class="flex items-center gap-2">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      {formatDate(item.validUntil)}
    </Typography>
    <!-- 배지는 D-7 이하에만 (그 위는 날짜만) — 경고를 남발하면 무뎌진다 -->
    {#if item.dday !== null && item.dday >= 0 && item.dday <= URGENT_DAYS}
      <span
        class="flex h-6 shrink-0 items-center rounded-sm bg-status-danger-bg px-2 text-label-01-normal-medium text-status-danger"
      >
        D-{item.dday}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet goCell()}
  <span class="text-gray-300">
    <ArrowRightIcon16 />
  </span>
{/snippet}

<div in:fade class="flex h-full min-h-0 flex-col">
  <!-- 타이틀 아래가 면 컨테이너 → 간격 16 (§Title system 타이틀 → 바로 아래 요소) -->
  <PageTitleSection title="바우처 현황" className="mb-4" />

  <!-- 좁은 화면(<xl): 좌 레일 대신 상단 드롭다운으로 사업을 고른다 -->
  {#if isOverlayMode}
    <div class="mb-4">
      <Select
        class="h-11 w-full"
        selected={filters.voucherId}
        options={[
          { value: '', title: `전체 (${visibleRowCount})` },
          ...railPrograms.map((p) => ({
            value: p.id,
            title: `${p.catalogName} (${countOfProgram(p.catalogName)})`
          }))
        ]}
        on:change={(e) => (filters.voucherId = e.detail.value)}
      />
    </div>
  {/if}

  <!-- 한 덩어리 컨테이너 + 세로 구분선 (권한 설정과 같은 형태).
       좌 280 = §Layout Patterns > 목록 레일 폭 -->
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card xl:flex-row"
  >
    <!-- ── 좌: 사업 레일 ── -->
    <aside
      class="hidden min-h-0 w-70 shrink-0 flex-col border-r border-gray-200 xl:flex"
    >
      <!-- 사업 검색 (내담자 검색은 우측이 소유 — 필터가 두 군데로 갈리지 않게) -->
      <div class="shrink-0 p-5">
        <div
          class="flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-3"
        >
          <SearchIcon />
          <input
            type="text"
            bind:value={programSearch}
            placeholder="바우처 사업명을 입력해주세요"
            class="w-full text-body-02-normal-regular placeholder:text-placeholder outline-none"
          />
        </div>
      </div>

      <!-- 사업 목록 (메뉴 사이 간격 8) -->
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-5">
        <!-- `전체` — 사업을 가로지르는 뷰 (대시보드 소진·만료 임박 딥링크 착지점) -->
        <button
          type="button"
          onclick={() => (filters.voucherId = '')}
          class="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors {isAllView
            ? 'bg-primary-50'
            : 'hover:bg-gray-50'}"
        >
          <Typography
            variant="body-01-normal-semibold"
            color={isAllView ? 'text-primary-600' : 'text-gray-700'}
            className="flex-1 truncate-safe"
            tag="span"
          >
            전체
          </Typography>
          <Typography
            variant="body-02-normal-medium"
            color={isAllView ? 'text-primary-600' : 'text-gray-400'}
            tag="span"
          >
            {visibleRowCount}
          </Typography>
        </button>

        <!-- 전체 ↔ 구분선 ↔ 첫 바우처 = 각 16 (컨테이너 gap 8 + my-2) -->
        <div class="my-2 h-px shrink-0 bg-gray-100"></div>

        {#each railListPrograms as program (program.id)}
          {@const active = filters.voucherId === program.id}
          <button
            type="button"
            onclick={() => (filters.voucherId = program.id)}
            class="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors {active
              ? 'bg-primary-50'
              : 'hover:bg-gray-50'}"
          >
            <span class="flex min-w-0 flex-1 flex-col gap-2">
              <span class="flex min-w-0 items-center gap-2">
                <Typography
                  variant="body-01-normal-semibold"
                  color={active ? 'text-primary-600' : 'text-gray-800'}
                  className="truncate-safe"
                  tag="span"
                >
                  {program.catalogName}
                </Typography>
                {#if program.isExpired}
                  <span
                    class="flex h-6 shrink-0 items-center rounded-sm bg-gray-100 px-2 text-label-01-normal-medium text-gray-500"
                  >
                    종료
                  </span>
                {/if}
              </span>
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
                className="truncate-safe"
                tag="span"
              >
                {program.programYear} · {program.programOrganization}
              </Typography>
            </span>
            <Typography
              variant="body-02-normal-medium"
              color={active ? 'text-primary-600' : 'text-gray-400'}
              tag="span"
            >
              {countOfProgram(program.catalogName)}
            </Typography>
          </button>
        {/each}
      </div>

      <!-- 종료된 사업 숨기기 (바우처 관리 화면과 같은 토글) -->
      {#if endedCount > 0}
        <div
          class="mt-auto flex h-14 shrink-0 items-center justify-between border-t border-gray-100 px-5"
        >
          <Typography variant="body-02-normal-regular" color="text-gray-600">
            종료된 사업 숨기기
            <span class="text-gray-400">({endedCount})</span>
          </Typography>
          <Switch bind:checked={hideEnded} ariaLabel="종료된 사업 숨기기" />
        </div>
      {/if}
    </aside>

    <!-- ── 우: 내담자 패널 ── -->
    <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <!-- 패널 헤더: 사업 정체 + 규모 -->
      <!-- 타이틀 섹션 ↔ 칩 줄 구분선은 한 단 진하게(gray-200) — gray-100은 거의 안 보인다 -->
      <header class="shrink-0 border-b border-gray-200 p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <!-- 패널 타이틀 = Title L(20) — 페이지 타이틀(24) 아래 한 단 -->
            <Typography
              variant="headline-02-normal-semibold"
              color="text-gray-900"
              className="truncate-safe block"
              tag="h2"
            >
              {activeProgram?.catalogName ?? '전체 바우처'}
            </Typography>
            {#if activeProgram}
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
                className="mt-2 block"
                tag="p"
              >
                {activeProgram.programYear} · {activeProgram.programOrganization}{activeProgram.programPeriod
                  ? ` · ${activeProgram.programPeriod}`
                  : ''}
              </Typography>
            {/if}
          </div>

          {#if activeProgram}
            <button
              type="button"
              onclick={() => goto(`/settings/vouchers/${activeProgram.id}`)}
              class="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-gray-600 transition-colors hover:bg-gray-50"
            >
              <span class="text-body-02-normal-medium">바우처 관리</span>
              <ArrowRightIcon16 />
            </button>
          {/if}
        </div>
      </header>

      <!-- 필터 툴바 — 컨트롤 높이는 .filter-bar가 소유(44).
           아래 목록이 스크롤되면 최소 그림자를 얹어 고정 영역이 한 층 위라는 걸 보인다.
           z-10은 그림자가 행 위에 그려지게 한다 -->
      <div
        class="filter-bar relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-3 pb-2 transition-shadow duration-200 {isRowsScrolled
          ? 'shadow-sticky'
          : ''}"
      >
        <div class="flex items-center gap-1">
          {#each VOUCHER_STATUS_TABS as tab (tab.value)}
            {@const active = filters.status === tab.value}
            <button
              type="button"
              onclick={() =>
                (filters.status = tab.value as VoucherStatusFilter)}
              class="flex h-9 w-16 items-center justify-center rounded-full transition-colors {active
                ? 'bg-gray-700 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
            >
              <span class="text-body-02-normal-regular">{tab.label}</span>
            </button>
          {/each}
        </div>

        <div class="flex items-center gap-2">
          <div
            class="filter-bar-field flex w-56 items-center gap-2 rounded-lg border border-gray-200 px-3"
          >
            <SearchIcon />
            <input
              type="text"
              bind:value={filters.searchQuery}
              placeholder="내담자 이름을 입력해주세요"
              class="w-full text-body-02-normal-regular placeholder:text-placeholder outline-none"
            />
          </div>
          <Select
            class="w-32 rounded-lg bg-white"
            selected={sort}
            options={[...VOUCHER_ROW_SORT_OPTIONS]}
            on:change={(e) => (sort = e.detail.value)}
          />
        </div>
      </div>

      <!-- 카운트 헤더 + 테이블 = 한 스크롤.
           '총 N명'은 상단 고정이 아니라 리스트와 함께 흐른다 — 스크롤 주체를 여기로 올리고
           Table 자신의 세로 스크롤은 푼다(헤더 sticky는 이미 static으로 풀려 있다). -->
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto"
        onscroll={(e) => (isRowsScrolled = e.currentTarget.scrollTop > 0)}
      >
        <!-- 카운트 헤더 — 리스트 위 '총 N명' (Web_Design §Layout Patterns 규격:
             높이 44 · body-02 Medium · text-body-subtle · 아래 콘텐츠와 gap 4).
             상태 칩을 따라 변한다(레일 숫자와 달리 지금 보고 있는 집합의 크기). -->
        <div class="flex h-11 shrink-0 items-center gap-2 px-5">
          <Typography variant="body-02-normal-medium" color="text-body-subtle">
            총 {baseRows.length}명
          </Typography>
          {#if isCapped}
            <span class="h-3 w-px bg-border-strong" aria-hidden="true"></span>
            <Typography
              variant="body-02-normal-medium"
              color="text-body-subtle"
            >
              최근 {VOUCHER_ROW_LOAD_SIZE}명까지만 표시돼요 — 검색으로 좁혀
              주세요
            </Typography>
          {/if}
        </div>

        <!-- 내담자 테이블 -->
        <div class="mt-1 flex flex-1 flex-col">
          {#if rowQuery.isLoading}
            <div class="flex flex-1 items-center justify-center py-12">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else if rows.length === 0}
            <div class="flex flex-1 items-center justify-center py-12">
              <NoDataSection
                description={activeProgram
                  ? '이 바우처를 사용하는 내담자가 없어요'
                  : '바우처를 보유한 내담자가 없어요'}
              />
            </div>
          {:else}
            <!-- 공용 Table: 셀 인셋을 20으로 맞추고, 헤더 sticky·자체 스크롤을 풀어
                 카운트 헤더까지 한 스크롤에 담는다 -->
            <Table
              {columns}
              data={rows}
              keyField="id"
              hoverEnabled
              rowHeight="min-h-20"
              containerClass="h-auto!"
              bodyClass="overflow-y-visible!"
              headerClass="px-5! static!"
              rowClass="px-5!"
              onRowClick={openRowDetail}
            />
          {/if}
        </div>
      </div>

      <!-- 선택 액션바 — 선택이 있을 때만 나타난다 -->
      {#if selectedIds.length > 0}
        <div
          in:fade={{ duration: 120 }}
          class="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-5 pt-4 pb-5"
        >
          <Typography variant="body-01-normal-medium" color="text-gray-800">
            {selectedIds.length}명 선택
          </Typography>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => (selectedIds = [])}
              class="h-11 rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              선택 해제
            </button>
            {#if canWrite}
              <button
                type="button"
                onclick={() => (issueModalOpen = true)}
                class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
              >
                서류 준비
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

{#if issueModalOpen && $centerId}
  <VoucherDocumentIssueModal
    centerId={$centerId}
    rows={selectedRows.map((r) => ({ id: r.id, name: r.name }))}
    onClose={() => (issueModalOpen = false)}
    {onIssued}
  />
{/if}
