<script lang="ts">
  import { t } from '$lib/ontology/terms'
  import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
  import { formatBirthDate } from '$lib/types/assessmentStatus'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import Table from '$lib/components/Table.svelte'
  import KebabMenu from './cells/KebabMenu.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { sentResultIds } from '$lib/stores/syncDelete'
  import { HIDE_SEND_LINK_AND_RESULT_FOR_BETA } from '$lib/features/assessment/status/constants'
  import { modalStore } from '$lib/stores/modal'
  import BaroLinkInfoModal from '$lib/components/modal/BaroLinkInfoModal.svelte'

  interface Props {
    data: AssessmentStatusRow[]
    onSendResult?: (row: AssessmentStatusRow) => void
    onSendLink?: (row: AssessmentStatusRow) => void
    canSendLink?: boolean
    onCancel?: (row: AssessmentStatusRow) => void
    onEdit?: (row: AssessmentStatusRow) => void
    onDelete?: (row: AssessmentStatusRow) => void
    onRollbackCancel?: (row: AssessmentStatusRow) => void
    onComplete?: (row: AssessmentStatusRow) => void
    onRollbackComplete?: (row: AssessmentStatusRow) => void
    onRowClick?: (row: AssessmentStatusRow) => void
    onBilling?: (row: AssessmentStatusRow) => void
    /** 청구 권한(write:billing) — 없으면 청구하기 버튼 미노출 */
    canBill?: boolean
    showCheckbox?: boolean
    selectedIds?: string[]
    onCheckChange?: (ids: string[]) => void
    class?: string
    /** 화면 높이에 맞춰 계산된 행 높이(px). 모든 페이지 공통. 기본 80 */
    rowHeightPx?: number
  }

  let {
    data,
    onEdit,
    onSendResult,
    onSendLink,
    canSendLink = false,
    onCancel,
    onDelete,
    onRollbackCancel,
    onComplete,
    onRollbackComplete,
    onRowClick,
    onBilling,
    canBill = false,
    class: className = '',
    rowHeightPx = 80
  }: Props = $props()

  const formatAssessments = (assessments: string[]) => {
    if (!assessments || assessments.length === 0) {
      return { main: '-', extra: 0 }
    }
    const [first, ...rest] = assessments
    return { main: first, extra: rest.length }
  }

  // 케밥 = 검사 완료하기 · 수정 · 삭제 (카드와 동일 구성).
  // 맨 위 항목이 주어('검사')를 밝히므로 아래 항목은 짧게 둔다.
  function getMenuItems(row: AssessmentStatusRow) {
    const items = []

    if (row.status === 'completed') {
      if (onRollbackComplete) {
        items.push({
          label: '완료 되돌리기',
          onClick: () => onRollbackComplete?.(row),
          variant: 'default' as const
        })
      }
    } else if (onComplete && row.status !== 'cancelled') {
      items.push({
        label: '검사 완료하기',
        onClick: () => onComplete?.(row),
        variant: 'default' as const
      })
    }

    if (onEdit && row.status !== 'cancelled') {
      items.push({
        label: '수정',
        onClick: () => onEdit?.(row),
        variant: 'default' as const
      })
    }

    if (row.status === 'pending' || row.status === 'in_progress') {
      items.push({
        label: '삭제',
        onClick: () => onDelete?.(row),
        variant: 'danger' as const
      })
    } else if (row.status === 'cancelled') {
      items.push({
        label: '취소 되돌리기',
        onClick: () => onRollbackCancel?.(row),
        variant: 'default' as const
      })
    } else if (row.status === 'completed') {
      // 완료된 검사만 결과 전송 가능 (베타에서 숨김 처리된 경우 제외)
      if (!HIDE_SEND_LINK_AND_RESULT_FOR_BETA) {
        items.push({
          label: $sentResultIds.has(row.id) ? '결과 재전송' : '결과 전송',
          onClick: () => onSendResult?.(row),
          variant: 'default' as const
        })
      }
      items.push({
        label: '삭제',
        onClick: () => onDelete?.(row),
        variant: 'danger' as const
      })
    }

    return items
  }
</script>

{#snippet sendLinkHeader()}
  <div class="flex items-center gap-1">
    <span>바로링크</span>
    <button
      type="button"
      aria-label="바로링크 안내"
      onclick={() =>
        modalStore.open({
          component: BaroLinkInfoModal,
          props: {},
          options: { customWidth: 640 }
        })}
      class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-primary-500"
      >ⓘ</button
    >
  </div>
{/snippet}

{#snippet sendLinkCell({ item }: { item: AssessmentStatusRow })}
  {#if !HIDE_SEND_LINK_AND_RESULT_FOR_BETA && item.hasOnlineLink && item.status !== 'cancelled' && canSendLink && onSendLink}
    <button
      type="button"
      aria-label={`${$isSecretMode ? maskName(item.clientName) : item.clientName} 바로링크 전송`}
      onclick={() => onSendLink?.(item)}
      class="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-primary-200 bg-white px-3 text-body-03-normal-medium text-primary-500 hover:bg-primary-50"
      >전송</button
    >
  {:else}
    <span class="text-body-03-normal-regular text-gray-400">-</span>
  {/if}
{/snippet}

{#snippet scheduledStartCell({ item }: { item: AssessmentStatusRow })}
  {#if item.scheduledDateLabel}
    {@const isToday = item.scheduledDDay === 'D-Day'}
    {@const isPast = item.scheduledDDay?.startsWith('D+') ?? false}
    <div class="flex flex-col justify-center gap-2">
      <Typography variant="body-01-normal-regular" color="text-gray-800">
        {item.scheduledDateLabel}
      </Typography>
      <div class="flex items-center gap-1.5">
        <Typography variant="body-02-normal-regular" color="text-body-default">
          {item.scheduledTimeLabel}
        </Typography>
        <!-- 지난 일정(D+)은 D-day를 감춘다 (카드 뷰와 동일) -->
        {#if !isPast}
          <span
            class="text-body-03-normal-medium {isToday
              ? 'text-imomtae'
              : 'text-primary-500'}"
          >
            {item.scheduledDDay}
          </span>
        {/if}
      </div>
    </div>
  {:else}
    <Typography variant="body-02-normal-regular" color="text-gray-400">
      -
    </Typography>
  {/if}
{/snippet}

{#snippet clientCell({ item }: { item: AssessmentStatusRow })}
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
            `${t('subject')} 없음`}
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
      {#if item.birthDate && item.clientCount <= 1}
        <ClientBirthGender
          birthDate={formatBirthDate(item.birthDate)}
          gender={item.clientGender}
        />
      {/if}
    </div>
  </div>
{/snippet}

<!-- 검사 코드 = 케이스 식별자. 검사(속성) 셀에서 분리한 전용 칼럼 -->
{#snippet caseCodeCell({ item }: { item: AssessmentStatusRow })}
  {#if item.accessCode}
    <BadgeRectangle label={item.accessCode} size="sm" />
  {:else}
    <Typography variant="body-01-normal-regular" color="text-gray-400"
      >-</Typography
    >
  {/if}
{/snippet}

{#snippet assessmentsCell({ item }: { item: AssessmentStatusRow })}
  {@const assessmentInfo = formatAssessments(item.assessments)}
  <div class="flex items-center justify-start gap-1.5 overflow-hidden">
    {#if item.reportStatus === 'done'}
      <BadgeRectangle label="보고서" color="green" size="sm" />
    {:else if item.reportStatus === 'pending'}
      <BadgeRectangle label="미작성" size="sm" />
    {/if}
    {#if item.setName}
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="truncate-safe"
      >
        {item.setName}
      </Typography>
    {:else}
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="truncate-safe"
      >
        {assessmentInfo.main}
      </Typography>
      {#if assessmentInfo.extra > 0}
        {#snippet assessmentList()}
          <div class="flex min-w-32 flex-col gap-1.5 py-0.5 text-left">
            {#each item.assessments as name, i (name + i)}
              <span
                class="whitespace-nowrap text-body-03-normal-medium text-white"
              >
                {name}
              </span>
            {/each}
          </div>
        {/snippet}
        <Tooltip placement="bottom" content={assessmentList}>
          <span
            class="shrink-0 whitespace-nowrap text-body-02-normal-regular text-body-default"
          >
            외 {assessmentInfo.extra}건
          </span>
        </Tooltip>
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet staffCell({ item }: { item: AssessmentStatusRow })}
  <div class="flex items-center gap-1 overflow-hidden">
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-800"
      className="truncate-safe"
    >
      {$isSecretMode ? maskName(item.staffName) : item.staffName}
    </Typography>
  </div>
{/snippet}

{#snippet progressCell({ item }: { item: AssessmentStatusRow })}
  {@const total = item.totalCount}
  {@const done = item.completedCount}
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

{#snippet billingCell({ item }: { item: AssessmentStatusRow })}
  <div class="flex items-center justify-start">
    {#if item.hasUninvoicedSessions}
      {#if canBill}
        <button
          type="button"
          onclick={() => onBilling?.(item)}
          class="inline-flex h-8 items-center rounded-lg px-3 border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover"
        >
          <Typography
            variant="body-03-normal-medium"
            color="text-current"
            tag="span"
          >
            청구하기
          </Typography>
        </button>
      {/if}
    {:else}
      <Typography variant="body-01-normal-regular" color="text-gray-400">
        -
      </Typography>
    {/if}
  </div>
{/snippet}

<!-- 결과 전송: 케밥 메뉴 액션으로 이동하여 컬럼/셀 주석 처리
{#snippet resultHeader()}
  <div class="flex items-center justify-center gap-1">
    <Typography variant="body-02-normal-medium" color="text-gray-600"
      >결과 전송</Typography
    >
  </div>
{/snippet}

{#snippet resultStatusCell({ item }: { item: AssessmentStatusRow })}
  {#if HIDE_SEND_LINK_AND_RESULT_FOR_BETA}
    <span class="text-body-03-normal-regular text-gray-400">-</span>
  {:else}
    <div class="flex w-full items-center justify-center">
      <Button
        class="h-8  rounded-lg border border-primary-200 bg-white px-4 transition hover:bg-primary-50"
        onclick={() => onSendResult?.(item)}
      >
        <Typography variant="body-03-medium" color="text-primary-400">
          전송
        </Typography>
      </Button>
    </div>
  {/if}
{/snippet}
-->

{#snippet moreMenuCell({ item }: { item: AssessmentStatusRow })}
  <KebabMenu items={getMenuItems(item)} />
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
        key: 'client',
        label: t('subject'),
        width: 'minmax(180px, 1.5fr)',
        align: 'left',
        render: clientCell
      },
      {
        key: 'staff',
        label: '담당자',
        width: 'minmax(120px, 1fr)',
        align: 'left',
        cellClass: 'flex items-center',
        render: staffCell
      },
      {
        key: 'assessments',
        label: '검사',
        width: '1.75fr',
        align: 'left',
        render: assessmentsCell
      },
      {
        key: 'progress',
        label: '진행률',
        width: 'minmax(200px, 1fr)',
        align: 'left',
        render: progressCell
      },
      {
        key: 'billing',
        label: '청구',
        width: 'minmax(140px, 1fr)',
        align: 'left',
        // 바로링크 컬럼과의 간격 보강 (컬럼 공통 gap-4 + 16)
        cellClass: 'pl-4',
        headerClass: 'pl-4',
        stopPropagation: true,
        render: billingCell
      },
      {
        key: 'sendLink',
        label: '바로링크',
        width: '128px',
        align: 'left',
        headerRender: sendLinkHeader,
        stopPropagation: true,
        render: sendLinkCell
      },
      // 결과 전송: 컬럼 대신 케밥 메뉴 액션으로 이동 (완료된 검사에서만 노출)
      // {
      //   key: 'result',
      //   label: '결과 전송',
      //   width: '1fr',
      //   align: 'center',
      //   headerRender: resultHeader,
      //   stopPropagation: true,
      //   render: resultStatusCell
      // },
      {
        key: 'scheduledStart',
        label: '검사 일정',
        width: 'minmax(140px, 1fr)',
        align: 'left',
        // 청구 컬럼과의 간격 보강 (컬럼 공통 gap-4 + 8)
        cellClass: 'pl-2',
        headerClass: 'pl-2',
        render: scheduledStartCell
      },
      {
        key: 'caseCode',
        label: '검사 코드',
        width: '96px',
        align: 'left',
        render: caseCodeCell
      },
      {
        key: 'more',
        label: '',
        width: '44px',
        align: 'left',
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
