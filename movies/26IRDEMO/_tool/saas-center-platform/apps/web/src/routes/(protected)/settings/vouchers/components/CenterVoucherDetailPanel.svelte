<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import type { CenterVoucherVM } from '$lib/features/voucher/center-voucher/view-model'
  import VoucherMetaTab from './VoucherMetaTab.svelte'
  import VoucherDocumentSection from './VoucherDocumentSection.svelte'

  let {
    item,
    canWrite = false,
    canDelete = false,
    onEdit,
    onDelete,
    onToggleActive
  }: {
    item: CenterVoucherVM
    canWrite?: boolean
    canDelete?: boolean
    onEdit?: (item: CenterVoucherVM) => void
    onDelete?: (item: CenterVoucherVM) => void
    onToggleActive?: (item: CenterVoucherVM) => void
  } = $props()

  let activeTab = $state<string>('meta')
  const tabs = [
    { value: 'meta', label: '정보' },
    { value: 'documents', label: '관련 자료' }
  ]

  // 수정 외 액션은 케밥으로 — 검사·상담 상세 헤더와 같은 규칙
  const menuItems = $derived([
    ...(canWrite
      ? [
          {
            label: item.isActive ? '비활성화' : '활성화',
            onClick: () => onToggleActive?.(item)
          }
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: '등록 해제',
            onClick: () => onDelete?.(item),
            variant: 'danger' as const,
            divider: true
          }
        ]
      : [])
  ])

  // 바우처가 바뀌면 메타 탭으로 리셋
  $effect(() => {
    void item.id
    activeTab = 'meta'
  })
</script>

<div class="flex h-full min-h-0 flex-col">
  <!-- 헤더 — [바우처명(+상태 배지) + 서브문구] 묶음 | 우측 액션.
       서브문구를 타이틀과 같은 컬럼에 두어야 간격 4가 실제로 4가 된다
       (액션 버튼 40이 행 높이를 정하므로 형제로 두면 간격이 벌어진다) -->
  <header class="shrink-0">
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 flex-col">
        <div class="flex min-w-0 items-center gap-2">
          <Typography
            variant="headline-02-normal-semibold"
            tag="h2"
            color="text-gray-900"
            className="truncate-safe"
          >
            {item.catalogName}
          </Typography>
          {#if item.isExpired}
            <BadgeRound
              status="cancelled"
              label="종료"
              class="min-w-[60px] px-3"
            />
          {:else if !item.isActive}
            <BadgeRound
              status="completed"
              label="비활성"
              class="min-w-[60px] bg-tag-gray-bg px-3 text-tag-gray-fg"
            />
          {/if}
        </div>

        <!-- 타이틀 ↔ 서브문구 12 -->
        <Typography
          variant="body-02-normal-regular"
          tag="p"
          color="text-gray-500"
          className="mt-3 block truncate-safe"
        >
          {item.catalogDetailSummary}
        </Typography>
      </div>

      {#if canWrite || menuItems.length > 0}
        <!-- 수정 + 더보기는 한 묶음 — 각 버튼이 패딩 8을 가지므로 그룹 gap은 0 -->
        <div class="flex shrink-0 items-center">
          {#if canWrite}
            <button
              type="button"
              onclick={() => onEdit?.(item)}
              aria-label="수정"
              class="inline-flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <EditIcon />
              <span class="text-body-02-normal-medium">수정</span>
            </button>
          {/if}
          {#if menuItems.length > 0}
            <div class="shrink-0">
              <KebabMenu items={menuItems} size={20} />
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <!-- 메인 탭 바 -->
  <TabBar {tabs} bind:activeTab class="mt-3 shrink-0" />

  <!-- 탭 본문 — 탭바↔콘텐츠 간격 24 -->
  <div class="min-h-0 flex-1 overflow-y-auto pt-6">
    {#if activeTab === 'meta'}
      <VoucherMetaTab {item} />
    {:else}
      <VoucherDocumentSection centerVoucherId={item.id} />
    {/if}
  </div>
</div>
