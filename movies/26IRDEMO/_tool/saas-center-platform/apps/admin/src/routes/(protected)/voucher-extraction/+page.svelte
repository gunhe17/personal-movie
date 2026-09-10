<script lang="ts">
  import { tick } from 'svelte'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'

  import AutocompleteInput from '$components/AutocompleteInput.svelte'
  import Button from '$components/Button.svelte'
  import FileDropZone from '$components/FileDropZone.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Select from '$components/Select.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Typography from '$components/Typography.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import {
    getVoucherExtractionList,
    uploadVoucherExtraction,
    type VoucherExtractionStatus,
    type VoucherExtractionSummary,
    type VoucherFileType
  } from '$hooks/actions/voucher-extraction.action'
  import { queryBuilder } from '$hooks/queries/builder'
  import { detectVoucherFileType } from '$lib/features/voucher/constants'
  import { titleFromFilename } from '$lib/features/voucher/document-upload'
  import {
    showErrorMessage,
    showErrorSnackbar,
    showSuccessSnackbar
  } from '$utils/errorHandler'
  import { formatDate } from '$utils/format'
  import { useUrlFilters } from '$utils/url-filters.svelte'

  const queryClient = useQueryClient()

  // ─── 라벨/뱃지 ───
  const STATUS_LABELS: Record<VoucherExtractionStatus, string> = {
    processing: '진행 중',
    review: '영역 확정 대기',
    paused: '중단됨',
    completed: '완료',
    failed: '실패'
  }
  const TYPE_LABELS: Record<string, string> = {
    business_guide: '사업안내',
    manual: '매뉴얼',
    form: '서식',
    supplementary: '참고자료',
    notice: '공고'
  }
  const STATUS_BADGE: Record<
    VoucherExtractionStatus,
    { bg: string; text: string; dot: string }
  > = {
    processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    review: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
  }

  // ═══════════════════════════════════════════════════════════
  // 1. 등록 폼 (상단) — 업로드 즉시 추출 시작
  // ═══════════════════════════════════════════════════════════

  const TYPE_OPTIONS: { value: VoucherFileType; title: string }[] = [
    { value: 'business_guide', title: '사업안내' },
    { value: 'manual', title: '매뉴얼' },
    { value: 'form', title: '서식' },
    { value: 'supplementary', title: '참고자료' },
    { value: 'notice', title: '공고' }
  ]

  // 파일 1개 = 박스(UploadRow) 1개. 기본 상태는 드롭존만 보인다.
  interface UploadRow {
    id: string
    file: File
    name: string
    /** '' = 미선택 (사용자가 골라야 함) */
    type: VoucherFileType | ''
    sourceUrl: string
    /** 자료명이 파일명에서 자동 입력되었고 아직 사용자가 수정하지 않은 상태 */
    nameAutoFilled: boolean
    /** 유형이 파일명 키워드로 자동 추정되었고 아직 사용자가 바꾸지 않은 상태 */
    typeAutoFilled: boolean
  }

  let rows = $state<UploadRow[]>([])
  let isSubmitting = $state(false)
  // 각 박스의 첫 입력(자료명) 엘리먼트 — 나열 직후 첫 박스에 포커스하기 위함
  let nameEls = $state<(HTMLInputElement | null)[]>([])

  const canSubmit = $derived(
    rows.length > 0 &&
      rows.every((r) => r.name.trim().length > 0 && r.type !== '') &&
      !isSubmitting
  )

  // 이미 입력된 출처 URL 목록 (중복 제거) — 각 박스 AutocompleteInput의 suggestions
  const enteredUrls = $derived([
    ...new Set(rows.map((r) => r.sourceUrl.trim()).filter((u) => u.length > 0))
  ])

  function rowId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `row-${Math.random().toString(36).slice(2)}`
  }

  /** 파일명에서 자료명·유형을 자동 추론해 박스 1개를 만든다. */
  function buildRow(file: File): UploadRow {
    const title = titleFromFilename(file.name)
    const detected = detectVoucherFileType(file.name)
    return {
      id: rowId(),
      file,
      name: title,
      type: detected ?? '',
      sourceUrl: '',
      nameAutoFilled: title.length > 0,
      typeAutoFilled: detected != null
    }
  }

  async function onFilesPicked(picked: File[]) {
    // 파일 1개 = 박스 1개. 이미 추가된 같은 이름 파일은 건너뜀.
    const existing = new Set(rows.map((r) => r.file.name))
    const fresh = picked.filter((f) => !existing.has(f.name))
    if (fresh.length === 0) return
    rows = [...rows, ...fresh.map(buildRow)]
    // 박스가 나열된 직후 첫 박스의 첫 값(자료명)에 포커스 + 자동 입력값 선택
    await tick()
    nameEls[0]?.focus()
    nameEls[0]?.select()
  }

  function removeRow(id: string) {
    rows = rows.filter((r) => r.id !== id)
  }

  /** 한 박스의 출처 URL을 모든 박스에 동일하게 반영 (모든 파일 URL 통일). */
  function applyUrlToAll(url: string) {
    const v = url.trim()
    if (!v) return
    for (const r of rows) r.sourceUrl = v
  }

  function resetForm() {
    rows = []
  }

  async function submit() {
    if (!canSubmit) return
    isSubmitting = true
    try {
      // 박스(파일)별로 개별 추출 작업을 생성
      const results = await Promise.allSettled(
        rows.map((r) =>
          uploadVoucherExtraction().request({
            name: r.name.trim(),
            type: r.type as VoucherFileType,
            source_url: r.sourceUrl.trim() || null,
            files: [r.file]
          })
        )
      )
      queryClient.invalidateQueries({
        queryKey: ['getVoucherExtractionList'],
        exact: false
      })

      const okCount = results.filter((x) => x.status === 'fulfilled').length
      const failCount = results.length - okCount

      if (failCount === 0) {
        showSuccessSnackbar(`${okCount}건 업로드 완료 — 추출을 시작했습니다.`)
        resetForm()
      } else {
        // 실패한 박스만 남겨 재시도 가능하게
        rows = rows.filter((_, i) => results[i].status === 'rejected')
        showErrorMessage(
          okCount > 0
            ? `${okCount}건 완료, ${failCount}건 실패 — 실패 항목만 남겼습니다.`
            : `업로드 실패 (${failCount}건)`
        )
      }
    } catch (e) {
      showErrorSnackbar(e)
    } finally {
      isSubmitting = false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. 추출 목록 (하단) — 존재하는 모든 행 표시
  // ═══════════════════════════════════════════════════════════

  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'processing', title: '진행 중' },
    { value: 'completed', title: '완료' },
    { value: 'failed', title: '실패' }
  ]

  const url = useUrlFilters({ status: 'all' })
  let statusFilter = $state(url.initial.status as string)

  let initialized = false
  $effect(() => {
    const snapshot = { status: statusFilter }
    if (!initialized) {
      initialized = true
      return
    }
    url.sync(snapshot)
  })

  function resetFilters() {
    statusFilter = 'all'
    url.reset()
  }

  // 모든 행을 한 번에 — 페이지네이션 없이 큰 size로 전부 로드
  const PAGE_SIZE = 100

  const listQuery = $derived(
    queryBuilder<any, any>(
      getVoucherExtractionList,
      () => ({
        status:
          statusFilter !== 'all'
            ? (statusFilter as VoucherExtractionStatus)
            : undefined,
        page: 1,
        size: PAGE_SIZE
      }),
      () => ({
        // 진행 중인 항목이 있으면 3초마다 폴링
        refetchInterval: (q: any) =>
          ((q.state.data?.items ?? []) as VoucherExtractionSummary[]).some(
            (it) => it.status === 'processing'
          )
            ? 3000
            : false
      })
    )
  )

  const items = $derived<VoucherExtractionSummary[]>(
    listQuery.data?.items ?? []
  )
  const total = $derived<number>(listQuery.data?.total ?? 0)
  const isLoading = $derived(listQuery.isPending)

  function handleRowClick(item: VoucherExtractionSummary) {
    goto(`/voucher-extraction/${item.id}`)
  }

  const columns: TableColumn<VoucherExtractionSummary>[] = [
    {
      key: 'name',
      label: '자료명',
      width: '1.6fr',
      cellClass: 'min-w-0',
      render: nameCell
    },
    {
      key: 'status',
      label: '상태',
      width: '140px',
      align: 'center',
      render: statusCell
    },
    {
      key: 'document_count',
      label: '문서',
      width: '90px',
      align: 'center',
      render: docCell
    },
    {
      key: 'candidate_count',
      label: '후보',
      width: '90px',
      align: 'center',
      render: candidateCell
    },
    {
      key: 'created_at',
      label: '등록일',
      width: '120px',
      align: 'center',
      render: createdCell
    }
  ]
</script>

{#snippet nameCell({ item }: { item: VoucherExtractionSummary; index: number; isChecked: boolean })}
  <div class="min-w-0">
    <div class="truncate text-sm font-medium text-gray-900">
      {item.name || '(이름 없음)'}
    </div>
    {#if item.type}
      <div class="mt-0.5">
        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          {TYPE_LABELS[item.type] ?? item.type}
        </span>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet statusCell({ item }: { item: VoucherExtractionSummary; index: number; isChecked: boolean })}
  {@const badge = STATUS_BADGE[item.status]}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {badge.bg} {badge.text}"
  >
    <span class="h-1.5 w-1.5 rounded-full {badge.dot}"></span>
    {STATUS_LABELS[item.status] ?? item.status}
  </span>
{/snippet}

{#snippet docCell({ item }: { item: VoucherExtractionSummary; index: number; isChecked: boolean })}
  {#if item.document_count > 0}
    <span class="text-sm font-medium text-gray-900">{item.document_count}개</span>
  {:else}
    <span class="text-sm text-gray-300">-</span>
  {/if}
{/snippet}

{#snippet candidateCell({ item }: { item: VoucherExtractionSummary; index: number; isChecked: boolean })}
  {#if item.candidate_count > 0}
    <span class="text-sm font-medium text-gray-900">{item.candidate_count}개</span>
  {:else}
    <span class="text-sm text-gray-300">-</span>
  {/if}
{/snippet}

{#snippet createdCell({ item }: { item: VoucherExtractionSummary; index: number; isChecked: boolean })}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD')}
  </span>
{/snippet}

<!-- 자동 입력된 값임을 나타내는 표시 -->
{#snippet autoBadge()}
  <span
    class="inline-flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600"
  >
    <span class="h-1 w-1 rounded-full bg-primary-500"></span>
    자동 입력
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="바우처 정보 AI 추출"
    description="업로드한 자료에서 AI가 바우처 정보를 추출합니다 · 총 {total}개"
  />

  <!-- ═══ 등록 폼 (상단) ═══ -->
  <div class="section-border mb-6 p-6">
    <Typography variant="body-01-normal-bold" color="text-gray-900" className="mb-4">
      새 자료 등록
    </Typography>

    <div class="space-y-4">
      <!-- 파일 입력 (기본 상태) -->
      <FileDropZone
        {onFilesPicked}
        multiple
        accept=".pdf,.hwpx,.hwp,.docx"
        title="PDF, HWP, HWPX 와 같은 형식의 파일을 드래그하세요."
      />

      <!-- 파일별 박스 목록 -->
      {#if rows.length > 0}
        <div class="space-y-3">
          {#each rows as row, i (row.id)}
            <div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <!-- 헤더: 파일명 + 제거 -->
              <div class="mb-3 flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium text-gray-900">
                  {row.file.name}
                </span>
                <button
                  class="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-200/60 hover:text-red-500"
                  onclick={() => removeRow(row.id)}
                  aria-label="이 파일 제거"
                >
                  ✕
                </button>
              </div>

              <div class="space-y-3">
                <!-- 자료명 -->
                <div>
                  <div class="mb-1 flex items-center gap-1.5">
                    <span class="text-xs font-medium text-gray-600">
                      자료명 <span class="text-red-500">*</span>
                    </span>
                    {#if row.nameAutoFilled}{@render autoBadge()}{/if}
                  </div>
                  <input
                    bind:this={nameEls[i]}
                    type="text"
                    bind:value={row.name}
                    oninput={() => (row.nameAutoFilled = false)}
                    placeholder="자료명을 입력하세요"
                    class="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                      {row.nameAutoFilled
                      ? 'border-primary-200 bg-primary-50/50'
                      : 'border-gray-200 bg-white'}"
                  />
                </div>

                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <!-- 유형 -->
                  <div>
                    <div class="mb-1 flex items-center gap-1.5">
                      <span class="text-xs font-medium text-gray-600">
                        유형 <span class="text-red-500">*</span>
                      </span>
                      {#if row.typeAutoFilled}{@render autoBadge()}{/if}
                    </div>
                    <Select
                      class="h-[42px] {row.typeAutoFilled
                        ? 'rounded-lg bg-primary-50/50'
                        : 'rounded-lg bg-white'}"
                      btnClass="px-3"
                      placeholder="유형 선택"
                      selected={row.type}
                      options={TYPE_OPTIONS}
                      on:change={(e) => {
                        row.type = e.detail.value as VoucherFileType
                        row.typeAutoFilled = false
                      }}
                    />
                  </div>

                  <!-- 출처 URL -->
                  <div>
                    <div class="mb-1 flex items-center gap-1.5">
                      <span class="text-xs font-medium text-gray-600">출처 URL</span>
                    </div>
                    <AutocompleteInput
                      type="url"
                      bind:value={row.sourceUrl}
                      placeholder="URL을 입력하세요"
                      maxlength={1024}
                      suggestions={enteredUrls}
                      emptyHint="입력한 URL과 일치하는 기존 출처가 없습니다"
                    >
                      {#snippet rightAction()}
                        {#if rows.length > 1 && row.sourceUrl.trim().length > 0}
                          <button
                            type="button"
                            onclick={() => applyUrlToAll(row.sourceUrl)}
                            title="이 출처를 모든 파일에 동일하게 적용"
                            class="rounded-md bg-primary-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                          >
                            전체 적용
                          </button>
                        {/if}
                      {/snippet}
                    </AutocompleteInput>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- 제출 -->
        <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <Button
            size="md"
            color="light"
            content="초기화"
            disabled={isSubmitting}
            onclick={resetForm}
          />
          <Button
            size="md"
            color="primary"
            content={isSubmitting ? '업로드 중...' : '업로드 및 추출'}
            disabled={!canSubmit}
            onclick={submit}
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- ═══ 추출 목록 (하단) ═══ -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <Select
      class="h-11 w-32 rounded-lg bg-white"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
    />

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if items.length === 0}
    <div class="section-border py-16">
      <NoDataSection description="등록된 추출 작업이 없습니다" />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={items} onRowClick={handleRowClick} hoverEnabled />
    </div>

    {#if total > items.length}
      <div class="mt-3 text-center text-xs text-gray-400">
        전체 {total}개 중 {items.length}개 표시 중
      </div>
    {/if}
  {/if}
</div>
