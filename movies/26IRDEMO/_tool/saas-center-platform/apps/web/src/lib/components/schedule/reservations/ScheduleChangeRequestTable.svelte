<script lang="ts">
  import Table from '$lib/components/Table.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { dateToString } from '$lib/utils/date'
  import { formatBirthDate } from '$lib/types/assessmentStatus'
  import type { ReservationVM } from '$lib/features/schedule/reservations/view-model'

  interface Props {
    data: ReservationVM[]
    busyId?: string | null
    onApprove?: (row: ReservationVM) => void
    onReject?: (row: ReservationVM) => void
    /** 행 높이 — 목록 화면 공통 기준 80px */
    rowHeightPx?: number
    class?: string
  }

  let {
    data,
    busyId = null,
    onApprove,
    onReject,
    rowHeightPx = 80,
    class: className = ''
  }: Props = $props()

  const STATUS_BADGE: Record<
    string,
    { badge: 'scheduled' | 'completed' | 'cancelled'; label: string }
  > = {
    pending: { badge: 'scheduled', label: '대기' },
    confirmed: { badge: 'completed', label: '확정' },
    cancelled: { badge: 'cancelled', label: '반려' }
  }
</script>

{#snippet statusCell({ item }: { item: ReservationVM })}
  {@const s = STATUS_BADGE[item.status]}
  <BadgeRound
    status={s.badge}
    label={s.label}
    class="w-fit min-w-[55px] px-3"
  />
{/snippet}

<!-- 내담자 표시 최소 단위(아바타 + 이름 + 생년월일|성별) — 목록 화면 공통 규격 -->
{#snippet clientCell({ item }: { item: ReservationVM })}
  <div class="flex min-w-0 items-center gap-3">
    <ClientAvatar
      profileImageUrl={item.clientProfileImageUrl}
      name={$isSecretMode ? maskName(item.client) : item.client}
      gender={item.clientGender}
      sizeClass="h-10 w-10"
      textClass="text-[15px]"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-800"
        className="min-w-0 truncate-safe"
        tag="span"
      >
        {$isSecretMode ? maskName(item.client) : item.client}
      </Typography>
      {#if item.clientBirthDate}
        <ClientBirthGender
          birthDate={formatBirthDate(item.clientBirthDate)}
          gender={item.clientGender}
        />
      {/if}
    </div>
  </div>
{/snippet}

<!-- 요청 · 사유 — 1행 프로그램명·N회기 / 2행 사유, 사이 간격 8 -->
{#snippet programCell({ item }: { item: ReservationVM })}
  <div class="flex min-w-0 flex-col justify-center gap-2">
    <Typography
      variant="body-01-normal-regular"
      color="text-body-default"
      className="min-w-0 truncate-safe"
      tag="span"
    >
      {item.subject}{item.session > 0 ? ` · ${item.session}회기` : ''}
    </Typography>
    {#if item.reason || item.decisionNote}
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="min-w-0 truncate-safe"
        tag="span"
      >
        {item.reason ?? item.decisionNote}
      </Typography>
    {/if}
  </div>
{/snippet}

{#snippet counselorCell({ item }: { item: ReservationVM })}
  <Typography
    variant="body-01-normal-regular"
    color="text-body-default"
    className="truncate-safe"
  >
    {item.manager}
  </Typography>
{/snippet}

{#snippet timeCell({ item }: { item: ReservationVM })}
  <div class="flex items-center gap-2 overflow-hidden whitespace-nowrap">
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="line-through"
    >
      {dateToString(item.originDate, 'MM.DD (d) HH:mm')}
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-body-subtle">
      →
    </Typography>
    <Typography variant="body-01-normal-medium" color="text-primary-500">
      {item.changedDate
        ? dateToString(item.changedDate, 'MM.DD (d) HH:mm')
        : '-'}
    </Typography>
  </div>
{/snippet}

{#snippet actionCell({ item }: { item: ReservationVM })}
  {#if item.status === 'pending'}
    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={busyId === item.reservationId}
        onclick={(e) => {
          e.stopPropagation()
          onReject?.(item)
        }}
        class="h-10 w-15 shrink-0 rounded-lg border border-gray-200 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:border-gray-100 disabled:text-gray-400"
      >
        반려
      </button>
      <button
        type="button"
        disabled={busyId === item.reservationId}
        onclick={(e) => {
          e.stopPropagation()
          onApprove?.(item)
        }}
        class="h-10 w-15 shrink-0 rounded-lg bg-action-primary text-body-02-normal-medium text-white transition-colors hover:bg-action-primary-hover active:bg-primary-700 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        승인
      </button>
    </div>
  {:else}
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="block text-right"
    >
      {item.statusLabel} 처리됨
    </Typography>
  {/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col" style="--row-h: {rowHeightPx}px">
  <Table
    containerClass="flex-1 min-h-0 {className}"
    bodyClass="flex-1 min-h-0 overflow-auto"
    columns={[
      {
        key: 'status',
        label: '상태',
        width: '80px',
        align: 'left',
        render: statusCell
      },
      {
        key: 'client',
        label: '내담자',
        width: 'minmax(180px, 1fr)',
        align: 'left',
        render: clientCell
      },
      {
        key: 'program',
        label: '요청 · 사유',
        width: 'minmax(240px, 2.4fr)',
        align: 'left',
        render: programCell
      },
      {
        key: 'counselor',
        label: '담당자',
        width: '88px',
        align: 'left',
        render: counselorCell
      },
      {
        key: 'time',
        label: '일시 변경',
        width: '244px',
        align: 'left',
        render: timeCell
      },
      {
        key: 'action',
        label: '',
        width: '176px',
        align: 'right',
        render: actionCell
      }
    ]}
    {data}
    keyField="reservationId"
    rowHeight="h-[var(--row-h)] shrink-0"
    headerClass="bg-white border-b border-gray-200"
    rowClass="border-gray-100 !py-0"
  />
</div>
