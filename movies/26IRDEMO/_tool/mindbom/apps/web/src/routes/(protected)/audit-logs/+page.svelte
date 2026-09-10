<script lang="ts">
  import { fade } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  // 지역 상태 `page`(페이지 번호)와 이름이 겹쳐 별칭으로 받는다
  import { page as page_ } from '$app/state'
  import { auth } from '$lib/stores/auth'
  import { institutionId } from '$lib/stores/institution.store'
  import { get } from '$lib/services/api/instances'
  import Pagination from '$components/ui/Pagination.svelte'
  import DatePickerInput from '$lib/components/ui/DatePickerInput.svelte'
  import Select from '$components/ui/Select.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import PageTitleSection from '$components/ui/PageTitleSection.svelte'
  import ListCountHeader from '$components/ui/ListCountHeader.svelte'
  import EmptyState from '$components/ui/EmptyState.svelte'
  import FilterResetButton from '$components/ui/FilterResetButton.svelte'
  import DataTable, { type DataTableColumn } from '$components/ui/DataTable.svelte'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'

  interface AuditLog {
    id: string
    entity_type: string
    entity_id: string
    action: string
    actor_id: string | null
    actor_email: string
    actor_role: string | null
    institution_id: string | null
    trace_id: string | null
    ip_address: string | null
    user_agent: string | null
    old_value: string | null
    new_value: string | null
    metadata_json: string | null
    created_at: string
  }

  interface AuditListResponse {
    items: AuditLog[]
    total: number
    page: number
    size: number
    pages: number
  }

  // admin 외 진입 차단
  let isAuthorized = $state(false)
  onMount(() => {
    if ($auth.user && $auth.user.role !== 'admin') {
      goto('/dashboard', { replaceState: true })
      return
    }
    isAuthorized = true
  })

  /**
   * 필터 상태 — 초기값은 URL에서 읽는다.
   *
   * 다른 목록 페이지(검사현황·내담자·직원관리)는 필터를 URL에 싣는데 여기만
   * 빠져 있었다. 목록 상태가 주소에 없으면 새로고침·뒤로가기·링크 공유에서
   * 보던 화면이 사라진다 — 감사 로그는 "그 페이지를 그대로 다시 보여줘야"
   * 하는 성격이라 특히 필요하다.
   */
  const url0 = page_.url
  let actionFilter = $state(url0.searchParams.get('action') ?? '')
  let actorEmailSearch = $state(url0.searchParams.get('search') ?? '')
  let dateFrom = $state(url0.searchParams.get('from') ?? '')
  let dateTo = $state(url0.searchParams.get('to') ?? '')
  let page = $state(Number(url0.searchParams.get('page')) || 1)
  const SIZE = 20

  /** 기본값이면 파라미터를 싣지 않는다 — 주소가 지저분해지지 않게 */
  function syncUrl() {
    const p = new URLSearchParams()
    if (page > 1) p.set('page', String(page))
    if (actionFilter) p.set('action', actionFilter)
    if (actorEmailSearch.trim()) p.set('search', actorEmailSearch.trim())
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo) p.set('to', dateTo)
    const qs = p.toString()
    goto(qs ? `/audit-logs?${qs}` : '/audit-logs', {
      replaceState: true,
      keepFocus: true,
      noScroll: true
    })
  }

  // 데이터
  let items = $state<AuditLog[]>([])
  let total = $state(0)
  let totalPages = $state(1)
  let isLoading = $state(false)
  let expanded = $state<Set<string>>(new Set())

  const ACTION_LABELS: Record<string, string> = {
    login_success: '로그인',
    login_failed: '로그인 실패',
    logout: '로그아웃',
    account_locked: '계정 잠김',
    concurrent_session_invalidated: '중복 세션 종료',
    password_change: '비밀번호 변경',
    create: '생성',
    update: '수정',
    update_results: '결과 수정',
    delete: '삭제',
    activate: '활성화',
    deactivate: '비활성화',
    state_change: '상태 전이',
    ai_analyze: 'AI 분석',
    generate_report: '보고서 생성',
    transcribe: '전사',
    transcribe_diarize: '전사+화자분리',
    invite: '초대',
    role_change: '역할 변경'
  }

  // Select용 옵션 — 빈 문자열이 '전체 행위'
  const actionOptions = [
    { value: '', label: '전체 행위' },
    ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))
  ]

  const ENTITY_LABELS: Record<string, string> = {
    examination: '검사',
    client: '내담자',
    account: '계정',
    member: '직원',
    transcription: '전사',
    institution: '기관'
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원'
  }

  const ACTION_TONE: Record<string, string> = {
    login_success: 'bg-green-50 text-green-700 border-green-200',
    login_failed: 'bg-red-50 text-red-700 border-red-200',
    account_locked: 'bg-red-100 text-red-800 border-red-300',
    logout: 'bg-gray-50 text-gray-600 border-gray-200',
    password_change: 'bg-orange-50 text-orange-700 border-orange-200',
    create: 'bg-blue-50 text-blue-700 border-blue-200',
    update: 'bg-blue-50 text-blue-700 border-blue-200',
    update_results: 'bg-blue-50 text-blue-700 border-blue-200',
    delete: 'bg-red-50 text-red-700 border-red-200',
    state_change: 'bg-purple-50 text-purple-700 border-purple-200',
    ai_analyze: 'bg-purple-50 text-purple-700 border-purple-200',
    generate_report: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }

  async function load() {
    if (!isAuthorized) return
    const instId = $institutionId
    if (!instId) return
    isLoading = true
    try {
      const params: Record<string, string | number> = { page, size: SIZE }
      if (actionFilter) params.action = actionFilter
      if (dateFrom) params.date_from = `${dateFrom}T00:00:00`
      if (dateTo) params.date_to = `${dateTo}T23:59:59`
      const data = await get<AuditListResponse>(
        `/institutions/${instId}/audit-logs`, params
      )
      let filtered = data.items ?? []
      if (actorEmailSearch.trim()) {
        const q = actorEmailSearch.trim().toLowerCase()
        filtered = filtered.filter((it) => it.actor_email?.toLowerCase().includes(q))
      }
      items = filtered
      total = data.total
      totalPages = data.pages
    } catch {
      items = []
      total = 0
      totalPages = 1
    } finally {
      isLoading = false
    }
  }

  // 기간 필터가 바뀌면 1페이지로 돌아간다. 3페이지를 보던 중 범위를 좁히면
  // 결과가 그보다 적어져 빈 목록이 뜨기 때문이다.
  // (DatePickerInput은 bind:value라 onchange 콜백이 없어 여기서 처리한다.
  //  page를 읽지 않고 쓰기만 해야 아래 load effect와 순환하지 않는다.)
  let prevRange = dateFrom + '|' + dateTo
  $effect(() => {
    const range = dateFrom + '|' + dateTo
    if (range !== prevRange) {
      prevRange = range
      page = 1
      syncUrl()
    }
  })

  $effect(() => {
    void [page, actionFilter, dateFrom, dateTo, isAuthorized, $institutionId]
    load()
  })

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expanded = next
  }

  // 열 정의 — 가로 스크롤이 없으므로 고정폭은 꼭 필요한 열에만 준다.
  // 시간/IP는 tabular-nums라 폭이 일정하고, 행위자가 남는 폭을 흡수한다.
  let auditColumns = $derived<DataTableColumn[]>([
    { key: 'created_at', label: '시간', width: 'minmax(0, 168px)', render: timeCell },
    { key: 'action', label: '행위', width: 'minmax(0, 132px)', render: actionCell },
    { key: 'entity_type', label: '대상', width: 'minmax(0, 92px)', render: entityCell },
    { key: 'actor_email', label: '행위자', width: 'minmax(0, 1fr)', render: actorCell },
    { key: 'ip_address', label: 'IP', width: 'minmax(0, 116px)', render: ipCell },
    { key: 'chevron', label: '', width: '40px', align: 'right', render: chevronCell }
  ])

  function fmtDateTime(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  function tryFormatJson(s: string | null): string {
    if (!s) return ''
    try {
      return JSON.stringify(JSON.parse(s), null, 2)
    } catch {
      return s
    }
  }

  let hasActiveFilter = $derived(
    actionFilter !== '' || actorEmailSearch !== '' || dateFrom !== '' || dateTo !== ''
  )

  function resetFilters() {
    actionFilter = ''
    actorEmailSearch = ''
    dateFrom = ''
    dateTo = ''
    page = 1
    // prevRange를 함께 비우지 않으면 위 effect가 "범위가 바뀌었다"고 보고
    // 한 번 더 돌면서 syncUrl을 중복 호출한다.
    prevRange = '|'
    syncUrl()
    // actorEmailSearch는 클라이언트 측 필터라 아래 load effect의 의존성에 없다.
    // 이메일만 입력된 상태에서 초기화하면 effect가 안 돌아 목록이 그대로 남는다.
    load()
  }
</script>

{#if isAuthorized}
  <!--
    한 화면에 담는다 — 페이지 자체는 스크롤하지 않고, 목록만 내부에서 스크롤한다.
    (상위 layout의 main이 overflow-y-auto라 h-full로 그 높이를 그대로 받는다)
  -->
  <div in:fade class="flex h-full min-h-0 flex-col p-4 md:p-6 lg:p-8">
    <PageTitleSection
      title="감사 추적"
      description="로그인, 검사 기록 등 시스템 활동 이력을 확인합니다"
    />

    <!-- ===== 필터 바 — 모든 컨트롤 높이 44(h-11) ===== -->
    <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
      <div
        class="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 transition-colors focus-within:border-primary-300 sm:w-75"
      >
        <Icon name="search" size="md" class="text-gray-400" />
        <input
          type="text"
          placeholder="이메일로 검색"
          bind:value={actorEmailSearch}
          oninput={() => {
            load()
            syncUrl()
          }}
          class="w-full bg-transparent text-body-02-normal-regular text-gray-900 outline-none placeholder:text-gray-400"
        />
      </div>

      <Select
        options={actionOptions}
        value={actionFilter}
        onChange={(v) => {
          actionFilter = (v as string) ?? ''
          page = 1
          syncUrl()
        }}
        className="h-11 w-36"
        ariaLabel="행위 필터"
      />

      <!-- 기간 -->
      <DatePickerInput bind:value={dateFrom} placeholder="시작일" class="w-40" />
      <span class="text-label-01-normal-regular text-gray-400">~</span>
      <DatePickerInput bind:value={dateTo} placeholder="종료일" class="w-40" />

      <FilterResetButton onclick={resetFilters} disabled={!hasActiveFilter} />
    </div>

    <ListCountHeader {total} unit="건" />

    <!-- ===== 테이블 + 페이지네이션 — 목록만 내부 스크롤, 페이지는 스크롤하지 않는다 ===== -->
    <div class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
      >
        {#if isLoading && items.length === 0}
          <div class="flex min-h-60 flex-1 items-center justify-center">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"></div>
          </div>
        {:else if items.length === 0}
          <div class="flex min-h-60 flex-1 items-center justify-center">
            <EmptyState
              icon="fact_check"
              title="조건에 해당하는 로그가 없습니다"
              description="필터를 조정해 보세요"
            />
          </div>
        {:else}
          <DataTable
            class="flex-1"
            columns={auditColumns}
            data={items}
            expandedKeys={expanded}
            onToggleExpand={(key) => toggleExpand(key as string)}
            expanded={detailRow}
          />
        {/if}
      </div>

      <div class="shrink-0 pt-6">
        <Pagination
          {page}
          {totalPages}
          onPageChange={(p) => {
            page = p
            syncUrl()
          }}
        />
      </div>
    </div>
  </div>
{/if}

<!-- ===== 셀 렌더러 — DataTable의 열 정의가 참조한다 ===== -->

{#snippet timeCell({ item }: { item: AuditLog })}
  <span class="truncate text-label-02-normal-regular tabular-nums text-gray-600">
    {fmtDateTime(item.created_at)}
  </span>
{/snippet}

{#snippet actionCell({ item }: { item: AuditLog })}
  {@const tone = ACTION_TONE[item.action] ?? 'bg-gray-50 text-gray-600 border-gray-200'}
  <span
    class="inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-label-02-normal-medium {tone}"
  >
    {ACTION_LABELS[item.action] ?? item.action}
  </span>
{/snippet}

{#snippet entityCell({ item }: { item: AuditLog })}
  <span class="truncate text-label-02-normal-regular text-gray-600">
    {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
  </span>
{/snippet}

{#snippet actorCell({ item }: { item: AuditLog })}
  <div class="min-w-0">
    <div class="truncate text-body-03-normal-medium text-gray-900">{item.actor_email}</div>
    {#if item.actor_role}
      <div class="truncate text-caption-01-normal-regular text-gray-400">
        {ROLE_LABELS[item.actor_role] ?? item.actor_role}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet ipCell({ item }: { item: AuditLog })}
  <span class="truncate text-label-02-normal-regular tabular-nums text-gray-500">
    {item.ip_address ?? '-'}
  </span>
{/snippet}

{#snippet chevronCell({ item }: { item: AuditLog })}
  <span
    class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400"
    aria-hidden="true"
  >
    <!-- 펼침 표시는 목록 화면 전체가 같은 컴포넌트를 쓴다(검사현황과 동일) -->
    <ChevronToggle open={expanded.has(item.id)} size={16} strokeWidth={2} />
  </span>
{/snippet}

<!-- 펼침 상세 — 원래 colspan=6 자리 -->
{#snippet detailRow({ item }: { item: AuditLog })}
  <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-label-02-normal-regular">
    <div>
      <dt class="mb-2 text-gray-400">entity_id</dt>
      <dd class="font-mono break-all text-gray-700">{item.entity_id}</dd>
    </div>
    <div>
      <dt class="mb-2 text-gray-400">trace_id</dt>
      <dd class="font-mono break-all text-gray-700">{item.trace_id ?? '-'}</dd>
    </div>
    {#if item.user_agent}
      <div class="col-span-2">
        <dt class="mb-2 text-gray-400">user_agent</dt>
        <dd class="break-all text-gray-700">{item.user_agent}</dd>
      </div>
    {/if}
    {#if item.metadata_json}
      <div class="col-span-2">
        <dt class="mb-2 text-gray-400">metadata</dt>
        <dd>
          <pre
            class="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 font-mono text-label-02-normal-regular whitespace-pre-wrap text-gray-700">{tryFormatJson(
              item.metadata_json
            )}</pre>
        </dd>
      </div>
    {/if}
    {#if item.old_value}
      <div class="col-span-2">
        <dt class="mb-2 text-gray-400">old_value</dt>
        <dd>
          <pre
            class="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 font-mono text-label-02-normal-regular whitespace-pre-wrap text-gray-700">{tryFormatJson(
              item.old_value
            )}</pre>
        </dd>
      </div>
    {/if}
    {#if item.new_value}
      <div class="col-span-2">
        <dt class="mb-2 text-gray-400">new_value</dt>
        <dd>
          <pre
            class="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 font-mono text-label-02-normal-regular whitespace-pre-wrap text-gray-700">{tryFormatJson(
              item.new_value
            )}</pre>
        </dd>
      </div>
    {/if}
  </dl>
{/snippet}
