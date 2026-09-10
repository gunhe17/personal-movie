<script lang="ts">
  import type { CounselingStatusRow } from '$lib/features/counseling/status/view-model'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import Table from '$lib/components/Table.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { formatBirthDate } from '$lib/types/counseling'
  import CircleCautionOrangeIcon20 from '$lib/assets/CircleCautionOrangeIcon20.svelte'
  import CheckCircleMintIcon20 from '$lib/assets/CheckCircleMintIcon20.svelte'

  interface Props {
    data: CounselingStatusRow[]
    onEdit?: (row: CounselingStatusRow) => void
    onClose?: (row: CounselingStatusRow) => void
    onReopen?: (row: CounselingStatusRow) => void
    onDelete?: (row: CounselingStatusRow) => void
    onRowClick?: (row: CounselingStatusRow) => void
    onBilling?: (row: CounselingStatusRow) => void
    canBill?: boolean
    class?: string
    /** 화면 높이에 맞춰 계산된 행 높이(px). 모든 페이지 공통. 기본 80 */
    rowHeightPx?: number
  }

  let {
    data,
    onEdit,
    onClose,
    onReopen,
    onDelete,
    onRowClick,
    onBilling,
    canBill = false,
    class: className = '',
    rowHeightPx = 80
  }: Props = $props()

  // 상태 → BadgeRound 매핑 (백엔드 3상태: active·completed·cancelled)
  const STATUS_BADGE: Record<
    string,
    { badge: 'in_progress' | 'completed' | 'cancelled'; label: string }
  > = {
    active: { badge: 'in_progress', label: '진행중' },
    completed: { badge: 'completed', label: '종결' },
    cancelled: { badge: 'cancelled', label: '취소' }
  }
</script>

{#snippet statusCell({ item }: { item: CounselingStatusRow })}
  {@const s = STATUS_BADGE[item.status]}
  {#if s}
    <BadgeRound
      status={s.badge}
      label={s.label}
      class="w-fit min-w-[63px] px-3"
    />
  {:else}
    <BadgeRound
      status="completed"
      label={item.status}
      class="w-fit min-w-[63px] bg-gray-100 px-3 text-gray-500"
    />
  {/if}
{/snippet}

{#snippet nextSessionCell({ item }: { item: CounselingStatusRow })}
  {@const ns = item.nextSession}
  {#if ns.dateLabel}
    <Typography variant="body-01-normal-regular" color="text-gray-800">
      {ns.dateLabel.replace(/-/g, '. ')}
    </Typography>
  {:else if ns.kind === 'needs_review'}
    <Tooltip text="예약된 회기가 없어요. 연장하거나 종결 처리해 주세요">
      <span class="inline-flex items-center gap-1.5">
        <CircleCautionOrangeIcon20 />
        <Typography
          variant="body-01-normal-regular"
          color="text-semantic-warning"
          tag="span"
        >
          연장 · 종결 확인
        </Typography>
      </span>
    </Tooltip>
  {:else}
    <Typography variant="body-01-normal-regular" color="text-gray-400">
      -
    </Typography>
  {/if}
{/snippet}
{#snippet progressCell({ item }: { item: CounselingStatusRow })}
  {@const total = item.totalSessions}
  {@const done = item.currentSession}
  {@const isFull = total > 0 && done >= total}
  {@const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0}
  <div class="flex items-center gap-2">
    <div
      class="h-2 w-[141px] shrink-0 overflow-hidden rounded-full bg-gray-100"
    >
      <div
        class="h-full rounded-full transition-all duration-500 {isFull
          ? 'bg-primary-500'
          : 'bg-gray-500'}"
        style="width: {pct}%"
      ></div>
    </div>
    <span
      class="shrink-0 text-body-02-normal-regular {isFull
        ? 'text-primary-500'
        : 'text-gray-700'}"
    >
      {done}/{total}
    </span>
  </div>
{/snippet}
<!-- 상담 코드 = 케이스 식별자. 프로그램(속성) 셀에서 분리한 전용 칼럼 -->
{#snippet caseCodeCell({ item }: { item: CounselingStatusRow })}
  {#if item.caseCode}
    <BadgeRectangle label={item.caseCode} size="sm" />
  {:else}
    <Typography variant="body-01-normal-regular" color="text-gray-400"
      >-</Typography
    >
  {/if}
{/snippet}

{#snippet programCell({ item }: { item: CounselingStatusRow })}
  <div class="flex items-center gap-1.5 overflow-hidden">
    {#if item.programType === 'initial_counseling'}
      <a
        href={`/counseling/status/${item.id}`}
        class="hover:text-primary-600 hover:underline"
        onclick={(e) => e.stopPropagation()}
      >
        <Typography variant="body-02-normal-regular" color="text-primary-500">
          -
        </Typography>
      </a>
    {:else}
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="truncate-safe"
      >
        {item.programName}
      </Typography>
    {/if}
  </div>
{/snippet}

{#snippet clientCell({ item }: { item: CounselingStatusRow })}
  <div class="flex min-w-0 items-center gap-3">
    <div class="relative shrink-0">
      <ClientAvatar
        profileImageUrl={item.clientProfileImageUrl}
        name={$isSecretMode ? maskName(item.clientName) : item.clientName}
        gender={item.clientGender}
        sizeClass="h-10 w-10"
        textClass="text-[15px]"
      />
      {#if item.clientCount > 1}
        <span
          class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100"
        >
          <Typography
            variant="caption-01-normal-medium"
            color="text-caption-default"
            tag="span"
          >
            +{item.clientCount - 1}
          </Typography>
        </span>
      {/if}
    </div>
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <Typography
          variant="title-01-normal-semibold"
          color="text-gray-800"
          className="min-w-0 truncate-safe"
          tag="span"
        >
          {($isSecretMode ? maskName(item.clientName) : item.clientName) ||
            '내담자 없음'}
        </Typography>
        {#if item.clientCount > 1}
          {#snippet memberList()}
            <div class="flex min-w-32 flex-col gap-1.5 py-0.5 text-left">
              {#each item.clientMembers as member (member.name + member.birthDate)}
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <span class="text-body-03-normal-medium text-white">
                    {$isSecretMode ? maskName(member.name) : member.name}
                  </span>
                  <ClientBirthGender
                    birthDate={formatBirthDate(member.birthDate)}
                    gender={member.gender}
                    variant="body-03-normal-regular"
                    color="text-gray-300"
                  />
                </div>
              {/each}
            </div>
          {/snippet}
          <Tooltip placement="bottom" content={memberList}>
            <span
              class="shrink-0 whitespace-nowrap text-body-02-normal-regular text-body-default"
            >
              외 {item.clientCount - 1}명
            </span>
          </Tooltip>
        {/if}
      </div>
      {#if item.clientBirthDate && item.clientCount <= 1}
        <ClientBirthGender
          birthDate={formatBirthDate(item.clientBirthDate)}
          gender={item.clientGender}
        />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet counselorCell({ item }: { item: CounselingStatusRow })}
  <div class="flex items-center gap-1 overflow-hidden">
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-800"
      className="truncate-safe"
    >
      {$isSecretMode ? maskName(item.counselorName) : item.counselorName}
    </Typography>
    {#if item.counselorCount > 1}
      {#snippet counselorList()}
        <div class="flex min-w-24 flex-col gap-1.5 py-0.5 text-left">
          {#each item.counselorNames as cName (cName)}
            <span
              class="whitespace-nowrap text-body-03-normal-medium text-white"
            >
              {$isSecretMode ? maskName(cName) : cName}
            </span>
          {/each}
        </div>
      {/snippet}
      <Tooltip placement="bottom" content={counselorList}>
        <span
          class="shrink-0 whitespace-nowrap text-body-02-normal-regular text-body-default"
        >
          외 {item.counselorCount - 1}명
        </span>
      </Tooltip>
    {/if}
  </div>
{/snippet}

{#snippet billingCell({ item }: { item: CounselingStatusRow })}
  <div class="flex items-center justify-start">
    {#if item.hasUninvoicedSessions}
      <!-- 권한이 없어도 버튼 자리는 지킨다(비활성 표시) — 빈 칸이면 청구 대상인지 아닌지 구분이 안 된다 -->
      <button
        type="button"
        disabled={!canBill}
        title={canBill ? undefined : '청구 권한이 없어요'}
        onclick={() => onBilling?.(item)}
        class="inline-flex h-8 items-center rounded-lg px-3 border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover disabled:cursor-not-allowed disabled:border-billing-line-disabled disabled:text-billing-fg-disabled disabled:hover:border-billing-line-disabled disabled:hover:bg-transparent disabled:hover:text-billing-fg-disabled"
      >
        <Typography
          variant="body-03-normal-medium"
          color="text-current"
          tag="span"
        >
          청구하기
        </Typography>
      </button>
    {:else}
      <span class="inline-flex items-center gap-1.5">
        <CheckCircleMintIcon20 />
        <Typography
          variant="body-01-normal-regular"
          color="text-gray-800"
          tag="span"
        >
          청구 완료
        </Typography>
      </span>
    {/if}
  </div>
{/snippet}

{#snippet moreMenuCell({ item }: { item: CounselingStatusRow })}
  <KebabMenu
    items={[
      item.status === 'completed'
        ? { label: '되돌리기', onClick: () => onReopen?.(item) }
        : { label: '상담 종결하기', onClick: () => onClose?.(item) },
      ...(onEdit ? [{ label: '수정', onClick: () => onEdit?.(item) }] : []),
      {
        label: '삭제',
        onClick: () => onDelete?.(item),
        variant: 'danger',
        divider: true
      }
    ]}
  />
{/snippet}

<div
  class="flex flex-col h-full rounded-2xl border border-gray-200 overflow-hidden {className}"
  style="--row-h: {rowHeightPx}px"
>
  <Table
    containerClass="flex-1 min-h-0"
    bodyClass="flex-1 min-h-0 overflow-auto"
    columns={[
      {
        key: 'status',
        label: '상태',
        width: '96px',
        align: 'left',
        render: statusCell
      },
      {
        key: 'client',
        label: '내담자',
        width: 'minmax(180px, 1.5fr)',
        align: 'left',
        render: clientCell
      },
      {
        key: 'counselor',
        label: '담당자',
        width: 'minmax(120px, 1fr)',
        align: 'left',
        render: counselorCell
      },
      {
        key: 'program',
        label: '프로그램',
        width: '2fr',
        align: 'left',
        render: programCell
      },
      {
        key: 'progress',
        label: '진행률',
        width: 'minmax(200px, 1fr)',
        align: 'left',
        render: progressCell
      },
      {
        key: 'nextSession',
        label: '다음 상담일',
        width: '160px',
        render: nextSessionCell
      },
      {
        key: 'billing',
        label: '청구',
        width: 'minmax(110px, 1fr)',
        align: 'left',
        stopPropagation: true,
        render: billingCell
      },
      {
        key: 'caseCode',
        label: '상담 코드',
        width: '96px',
        align: 'left',
        render: caseCodeCell
      },
      {
        key: 'more',
        label: '',
        width: '44px',
        stopPropagation: true,
        render: moreMenuCell
      }
    ]}
    {data}
    keyField="id"
    {onRowClick}
    hoverEnabled
    rowHeight="h-[var(--row-h)] shrink-0"
    headerClass="bg-white border-b border-gray-200"
    rowClass="border-gray-100 !py-0"
  />
</div>
