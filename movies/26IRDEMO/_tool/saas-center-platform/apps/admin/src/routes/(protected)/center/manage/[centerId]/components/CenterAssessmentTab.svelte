<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Select from '$components/Select.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Switch from '$components/Switch.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { modalStore } from '$lib/stores/modal'
  import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
  import {
    getCenterAssessments,
    patchCenterAssessment,
    deleteCenterAssessment,
    type CenterAssessmentItem
  } from '$hooks/actions/center-assessment.action'
  import { TYPE_LABELS } from '$lib/features/assessment/constants'
  import {
    STATUS_FILTER_OPTIONS,
    TYPE_FILTER_OPTIONS,
    TYPE_BADGE_CLASSES,
    DEFAULT_BADGE_CLASS
  } from '$lib/features/center-assessment/constants'
  import { formatDate } from '$lib/utils/format'
  import AssignAssessmentModal from './AssignAssessmentModal.svelte'

  interface Props {
    centerId: string
  }

  let { centerId }: Props = $props()

  // ─── 상태 ───
  let search = $state('')
  let typeFilter = $state('all')
  let statusFilter = $state('all')
  const queryClient = useQueryClient()

  // ─── 쿼리 ───
  const listQuery = $derived(
    queryBuilder<any, any>(getCenterAssessments, () => ({
      centerId,
      ...(statusFilter !== 'all' ? { is_active: statusFilter === 'true' } : {})
    }))
  )

  // 클라이언트 사이드 필터링 (검색 + 유형)
  const allItems = $derived.by<CenterAssessmentItem[]>(() => {
    const raw: CenterAssessmentItem[] = listQuery.data ?? []
    let filtered = raw

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.kor_name.toLowerCase().includes(term) ||
          item.eng_name.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term)
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((item) => item.type === typeFilter)
    }

    return filtered
  })

  const total = $derived(allItems.length)

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: ['getCenterAssessments'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getUnassignedAssessments'],
      exact: false
    })
  }

  // ─── 토글 ───
  async function handleToggle(item: CenterAssessmentItem, checked: boolean) {
    try {
      await patchCenterAssessment().request({
        centerId,
        assessmentId: item.assessment_id,
        is_active: checked
      })
      showSuccessSnackbar(
        checked ? '검사가 활성화되었습니다.' : '검사가 비활성화되었습니다.'
      )
      invalidate()
    } catch (e: any) {
      showErrorSnackbar(e)
    }
  }

  // ─── 할당 해제 ───
  function handleUnassign(item: CenterAssessmentItem) {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '검사 할당 해제',
        message: `"${item.kor_name}" 검사를\n센터에서 해제하시겠습니까?`,
        confirmText: '해제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteCenterAssessment().request({
              centerId,
              assessmentId: item.assessment_id
            })
            showSuccessSnackbar('검사가 해제되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  // ─── 할당 모달 ───
  function openAssignModal() {
    modalStore.open({
      component: AssignAssessmentModal,
      props: {
        centerId,
        onAssigned: () => invalidate()
      },
      options: { size: 'lg' }
    })
  }

  // ─── 필터 핸들러 ───
  function handleStatusChange(e: CustomEvent) {
    const option = e.detail
    statusFilter = typeof option === 'object' ? option.value : option
  }

  function handleTypeChange(e: CustomEvent) {
    const option = e.detail
    typeFilter = typeof option === 'object' ? option.value : option
  }

  function resetFilters() {
    search = ''
    typeFilter = 'all'
    statusFilter = 'all'
  }

  const columns: TableColumn[] = [
    { key: 'code', label: '코드', width: '1fr', cellClass: 'truncate' },
    { key: 'kor_name', label: '검사명', width: '1fr', cellClass: 'truncate' },
    { key: 'type', label: '유형', width: '100px' },
    {
      key: 'created_at',
      label: '할당일시',
      width: '0.5fr',
      cellClass: 'truncate'
    },
    {
      key: 'updated_at',
      label: '수정일시',
      width: '0.5fr',
      cellClass: 'truncate'
    },
    { key: 'is_active', label: '운영', width: '100px' },
    { key: 'actions', label: '할당해제', width: '50px' }
  ]
</script>

<div class="flex flex-1 flex-col gap-4">
  <!-- 헤더 -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Typography variant="title-01-normal-semibold" tag="h2">
        검사 관리
      </Typography>
      <span class="text-sm text-gray-400">
        총 {total}개
      </span>
    </div>
    <Button
      size="md"
      color="primary"
      content="검사 할당"
      onclick={openAssignModal}
    />
  </div>

  <!-- 필터 바 -->
  <div class="flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4"
    >
      <SearchIcon />
      <input
        type="text"
        bind:value={search}
        placeholder="검사명, 코드로 검색"
        class="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
      />
    </div>
    <Select
      options={TYPE_FILTER_OPTIONS}
      selected={typeFilter}
      showActiveHighlight={true}
      defaultValue="all"
      class="h-11 w-35 bg-white rounded-lg"
      on:change={handleTypeChange}
    />
    <Select
      options={STATUS_FILTER_OPTIONS}
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      class="h-11 w-35 bg-white rounded-lg"
      on:change={handleStatusChange}
    />
    <button
      onclick={resetFilters}
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      title="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  <!-- 테이블 -->
  {#if listQuery.isPending}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if allItems.length === 0}
    <div class="section-border flex items-center justify-center min-h-100">
      <NoDataSection description="할당된 검사가 없습니다" />
    </div>
  {:else}
    {#snippet codeCell({ item }: { item: any })}
      <span
        class="truncate rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
        title={item.code}
      >
        {item.code}
      </span>
    {/snippet}

    {#snippet typeCell({ item }: { item: any })}
      <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {TYPE_BADGE_CLASSES[item.type] ?? DEFAULT_BADGE_CLASS}">
        {TYPE_LABELS[item.type] ?? item.type}
      </span>
    {/snippet}

    {#snippet dateCell({ item }: { item: any })}
      <span
        class="truncate text-xs text-gray-500"
        title={formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}
        >{formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}</span
      >
    {/snippet}

    {#snippet updatedCell({ item }: { item: any })}
      <span
        class="truncate text-xs text-gray-500"
        title={formatDate(item.updated_at, 'YYYY-MM-DD HH:mm')}
        >{formatDate(item.updated_at, 'YYYY-MM-DD HH:mm')}</span
      >
    {/snippet}

    {#snippet activeCell({ item }: { item: any })}
      <Switch
        checked={item.is_active}
        onclick={() => handleToggle(item, !item.is_active)}
        ariaLabel="{item.kor_name} 운영 토글"
      />
    {/snippet}

    {#snippet actionsCell({ item }: { item: any })}
      <button
        onclick={() => handleUnassign(item)}
        class="flex items-center justify-center hover:scale-105 duration-200 mx-auto"
        title="할당 해제"
      >
        <TrashIcon />
      </button>
    {/snippet}

    <div class="section-border overflow-hidden rounded-lg">
      <Table
        columns={[
          { ...columns[0], render: codeCell },
          columns[1],
          { ...columns[2], render: typeCell },
          { ...columns[3], render: dateCell },
          { ...columns[4], render: updatedCell },
          { ...columns[5], render: activeCell, stopPropagation: true },
          { ...columns[6], render: actionsCell, stopPropagation: true }
        ]}
        data={allItems}
        keyField="assessment_id"
        rowClass="!min-h-14 !py-2"
        headerClass="!h-11"
      />
    </div>

  {/if}
</div>
