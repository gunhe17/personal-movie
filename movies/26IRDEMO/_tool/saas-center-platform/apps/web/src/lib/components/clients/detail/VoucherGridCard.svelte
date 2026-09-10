<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { browser } from '$app/environment'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { getVoucherFormInstances } from '$lib/hooks/actions/form.action'
  import { formatUtcToKst } from '$lib/utils/date'
  import { calcScheduleDDay } from '$lib/types/assessmentStatus'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import type { ClientVoucherCardVM } from '$lib/features/clients/detail/voucher'

  interface Props {
    voucher: ClientVoucherCardVM
    onSelect?: (id: string) => void
  }

  let { voucher, onSelect }: Props = $props()

  // 사용 회기 (총 - 잔여) 및 진행/완료 상태
  const used = $derived(
    Math.max(0, voucher.totalSessions - voucher.remainingSessions)
  )
  const isCompleted = $derived(
    voucher.totalSessions > 0 && voucher.remainingSessions <= 0
  )
  const progressPct = $derived(
    voucher.totalSessions > 0
      ? Math.min(100, Math.round((used / voucher.totalSessions) * 100))
      : 0
  )

  // 유효기간 (종료일 + D-day)
  const validUntilLabel = $derived(
    voucher.rawValidUntil
      ? formatUtcToKst(voucher.rawValidUntil, 'YYYY. MM. DD')
      : null
  )
  const dday = $derived(calcScheduleDDay(voucher.rawValidUntil))

  const amountLabel = $derived(
    voucher.remainingAmount != null
      ? `${voucher.remainingAmount.toLocaleString()}원`
      : null
  )

  // 금액형은 잔액, 회기형은 잔여회기를 같은 자리에 노출
  const balanceItem = $derived(
    amountLabel != null
      ? { label: '잔액', value: amountLabel }
      : voucher.totalSessions > 0
        ? { label: '잔여회기', value: `${voucher.remainingSessions}회` }
        : null
  )

  // 연결 문서 건수 (카드별 조회)
  const docsQuery = $derived(
    queryBuilder(
      getVoucherFormInstances,
      () => ({ centerId: $centerId, clientVoucherId: voucher.id }),
      { enabled: browser && !!$centerId && !!voucher.id }
    )
  )
  // 문서: 제출완료/전체 건 (예: "1/3건")
  const docTotal = $derived(docsQuery.data?.items?.length ?? null)
  const docSubmitted = $derived(
    ((docsQuery.data?.items ?? []) as any[]).filter(
      (i) => i.instance?.status === 'submitted'
    ).length
  )
</script>

<button
  type="button"
  onclick={() => onSelect?.(voucher.id)}
  class="flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-colors hover:border-gray-300 @[960px]:h-[152px]"
>
  <!-- 상단: 상태 배지 + 이름 · 진행 바 — 상하 여백 16 -->
  <div
    class="flex flex-1 flex-col gap-3 px-4 py-4 @[960px]:justify-center @[960px]:py-0"
  >
    <div class="flex items-center gap-2">
      <BadgeRound
        status={isCompleted ? 'completed' : 'in_progress'}
        label={isCompleted ? '완료' : '진행중'}
        class={isCompleted
          ? 'bg-green-50 text-green-700'
          : 'bg-primary-50 text-primary-500'}
      />
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-900"
        className="min-w-0 truncate-safe"
      >
        {voucher.name}
      </Typography>
    </div>

    <div class="flex items-center gap-3">
      <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200">
        <span
          class="block h-full rounded-full {isCompleted
            ? 'bg-primary-500'
            : 'bg-gray-500'}"
          style="width: {progressPct}%"
        ></span>
      </span>
      <Typography
        variant="body-02-normal-medium"
        color={isCompleted ? 'text-primary-500' : 'text-gray-500'}
        className="shrink-0 whitespace-nowrap"
      >
        <!-- 청구 모달의 "잔여 N/M회"와 분자 기준이 달라(사용/총) 라벨 없이는 혼동된다 -->
        사용 {used}/{voucher.totalSessions}회
      </Typography>
    </div>
  </div>

  <!-- 하단 푸터(bg-base): 유효기간 · 잔액 · 문서.
       넓을 때(케어보드 접힘 = 컨테이너 960↑)는 종전대로 한 줄 인라인 나열,
       좁아지면(케어보드 펼침) 넘쳐 접히므로 한 줄에 한 항목씩 세운다.
       세로 모드는 카드 안 레이블+데이터 가로형 규격(레이블↔값 24 · 행 20 · 행간 8) -->
  <div
    class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-2 border-t border-gray-200 bg-bg-base px-4 py-3 @[960px]:flex @[960px]:h-14 @[960px]:flex-wrap @[960px]:items-center @[960px]:justify-between @[960px]:gap-x-0 @[960px]:gap-y-1 @[960px]:py-0"
  >
    {#if validUntilLabel}
      {@render metaItem(
        '유효기간',
        `${validUntilLabel}${dday ? ` (${dday})` : ''}`
      )}
    {/if}
    {#if validUntilLabel && (balanceItem || docTotal != null)}
      <span
        class="hidden h-3 w-px bg-gray-300 @[960px]:block"
        aria-hidden="true"
      ></span>
    {/if}
    {#if balanceItem}
      {@render metaItem(balanceItem.label, balanceItem.value)}
    {/if}
    {#if balanceItem && docTotal != null}
      <span
        class="hidden h-3 w-px bg-gray-300 @[960px]:block"
        aria-hidden="true"
      ></span>
    {/if}
    {#if docTotal != null}
      {@render metaItem('문서', `${docSubmitted}/${docTotal}건`)}
    {/if}
  </div>
</button>

<!-- display:contents = 좁을 때 레이블·값이 부모 그리드의 직접 자식이 되어
     여러 행의 값 좌측이 정렬된다. 넓어지면 span이 다시 flex 묶음이 된다 -->
{#snippet metaItem(label: string, value: string)}
  <span class="contents @[960px]:flex @[960px]:items-center @[960px]:gap-1.5">
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="whitespace-nowrap"
    >
      {label}
    </Typography>
    <Typography
      variant="body-02-normal-medium"
      color="text-body-default"
      className="min-w-0 truncate-safe"
    >
      {value}
    </Typography>
  </span>
{/snippet}
