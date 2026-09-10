<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { getVoucherUsage } from '$lib/hooks/actions/clientVoucher.action'
  import {
    getVoucherFormInstances,
    postLinkVoucherFormInstance
  } from '$lib/hooks/actions/form.action'
  import {
    buildVoucherUsageInput,
    mapToVoucherUsageItemVM,
    type ClientVoucherCardVM,
    type VoucherUsageItemVM
  } from '$lib/features/clients/detail/voucher'
  import { formatUtcToKst } from '$lib/utils/date'
  import { calcScheduleDDay } from '$lib/types/assessmentStatus'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import BillsIcon20 from '$lib/assets/BillsIcon20.svelte'
  import TemplateSearchModal from './TemplateSearchModal.svelte'

  interface Props {
    voucher: ClientVoucherCardVM
    /** 헤더 뒤로가기 → 목록으로 */
    onBack: () => void
  }

  let { voucher, onBack }: Props = $props()

  const queryClient = useQueryClient()

  // ── 상태 (진행중 / 완료) ──
  const used = $derived(
    Math.max(0, voucher.totalSessions - voucher.remainingSessions)
  )
  const isCompleted = $derived(
    voucher.totalSessions > 0 && voucher.remainingSessions <= 0
  )

  const validUntilLabel = $derived(
    voucher.rawValidUntil
      ? formatUtcToKst(voucher.rawValidUntil, 'YYYY. MM. DD')
      : null
  )
  const dday = $derived(calcScheduleDDay(voucher.rawValidUntil))

  // ── 사용 내역 ──
  const usageQuery = $derived(
    queryBuilder(
      getVoucherUsage,
      () => buildVoucherUsageInput($centerId, voucher.id),
      { enabled: browser && !!$centerId && !!voucher.id }
    )
  )
  const itemVMs = $derived(
    (usageQuery.data?.items ?? [])
      .map(mapToVoucherUsageItemVM)
      .sort((a: VoucherUsageItemVM, b: VoucherUsageItemVM) =>
        b.billableDate.localeCompare(a.billableDate)
      )
  )

  // ── 작성 필요 서류 (연결된 서식 중 미제출) ──
  const formsQuery = $derived(
    queryBuilder(
      getVoucherFormInstances,
      () => ({ centerId: $centerId, clientVoucherId: voucher.id }),
      { enabled: browser && !!$centerId && !!voucher.id }
    )
  )
  const pendingDocCount = $derived(
    ((formsQuery.data?.items ?? []) as any[]).filter(
      (i) => i.instance?.status !== 'submitted'
    ).length
  )

  const isAmountNegative = $derived(
    voucher.remainingAmount != null && voucher.remainingAmount < 0
  )

  const fmtAmount = (n: number | null | undefined) =>
    `${(n ?? 0).toLocaleString()}`

  // 사용 내역 날짜 "2026. 7. 12" (앞자리 0 없이)
  function fmtUsageDate(d: string): string {
    if (!d) return '-'
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return d
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`
  }

  // 서류 작성 = 서식 검색 모달로 연결(작성 시작)
  function openWriteDocument() {
    modalStore.open({
      component: TemplateSearchModal,
      props: {
        onSelect: async (template: { id: string; name: string }) => {
          try {
            await postLinkVoucherFormInstance().request({
              centerId: requireCenterId(),
              clientVoucherId: voucher.id,
              templateId: template.id
            })
            snackbarStore.success(`"${template.name}" 문서가 연결되었어요`)
            queryClient.invalidateQueries({
              queryKey: ['getVoucherFormInstances'],
              exact: false
            })
          } catch (err) {
            console.error('[postLinkVoucherFormInstance] failed', err)
            snackbarStore.error('문서 연결에 실패했어요')
            throw err
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // 청구서 → 청구 페이지
  const goBill = () => goto('/billing')
</script>

<div class="flex flex-col">
  <!-- 헤더: 뒤로 + 이름 + 상태 -->
  <header class="mb-4 flex items-center gap-2">
    <!-- 목록으로: 검사 상세(AssessmentMain)와 동일한 뒤로가기 에셋·버튼 규격 -->
    <button
      type="button"
      onclick={onBack}
      aria-label="목록으로"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
    >
      <ArrowBackIcon />
    </button>
    <Typography
      variant="headline-02-normal-semibold"
      color="text-title-default"
      className="min-w-0 truncate-safe"
    >
      {voucher.name}
    </Typography>
    <!-- 상태 배지 = 목록 카드와 동일한 공용 Round 배지 -->
    <BadgeRound
      status={isCompleted ? 'completed' : 'in_progress'}
      label={isCompleted ? '완료' : '진행중'}
      class={isCompleted
        ? 'bg-green-50 text-green-700'
        : 'bg-primary-50 text-primary-500'}
    />
  </header>

  <!-- 작성 필요 서류 배너 -->
  {#if pendingDocCount > 0}
    <!-- 인포 박스: radius 12(중형 블록) · padding 16 · 타이틀↔부제 8 -->
    <div class="mb-5 flex items-center gap-4 rounded-xl bg-primary-50 p-4">
      <span class="shrink-0 text-primary-500" aria-hidden="true">
        {@render docIcon()}
      </span>
      <div class="min-w-0 flex-1">
        <Typography
          variant="body-01-normal-semibold"
          color="text-title-default"
          className="block"
        >
          작성이 필요한 서류가 {pendingDocCount}건 있어요
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-body-subtle"
          className="mt-2 block"
        >
          상담일지를 바탕으로 초안을 만들어드려요.
        </Typography>
      </div>
      <!-- Medium 버튼: 높이 40 · 좌우 24 · 레이블 15 Medium -->
      <button
        type="button"
        onclick={openWriteDocument}
        class="h-10 shrink-0 rounded-lg bg-primary-500 px-6 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
      >
        서류 작성
      </button>
    </div>
  {/if}

  <!-- 통계 3칸: 사용 횟수 / 잔액 / 유효기간
       지표 규격 = 레이블 15 Medium(title-subtle) → gap 8 → 값 20 SemiBold → gap 4 → 단위 15 -->
  <div class="mb-7 grid grid-cols-3 gap-3">
    <!-- 사용 횟수 -->
    <div class="rounded-xl border border-gray-200 p-4">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="block"
      >
        사용 횟수
      </Typography>
      <div class="mt-3 flex items-baseline gap-1">
        <Typography
          variant="headline-02-normal-semibold"
          color="text-title-default"
        >
          {used}
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          /{voucher.totalSessions}
        </Typography>
      </div>
    </div>

    <!-- 잔액 -->
    <div class="rounded-xl border border-gray-200 p-4">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="block"
      >
        잔액
      </Typography>
      <div class="mt-3 flex items-baseline gap-1">
        <Typography
          variant="headline-02-normal-semibold"
          color={isAmountNegative ? 'text-red-600' : 'text-title-default'}
        >
          {fmtAmount(voucher.remainingAmount)}
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          원
        </Typography>
      </div>
    </div>

    <!-- 유효기간 -->
    <div class="rounded-xl border border-gray-200 p-4">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="block"
      >
        유효기간
      </Typography>
      <!-- D-day는 값의 단위(4)가 아니라 별개 강조 정보라 한 단계 넓은 8 -->
      <div class="mt-3 flex items-baseline gap-2">
        <Typography
          variant="headline-02-normal-semibold"
          color="text-title-default"
        >
          {validUntilLabel ? `~${validUntilLabel}` : '-'}
        </Typography>
        {#if dday}
          <Typography variant="body-02-normal-medium" color="text-primary-500">
            {dday}
          </Typography>
        {/if}
      </div>
    </div>
  </div>

  <!-- 사용 내역 — 타이틀+카운트 조합은 상담 상세 패널(내담자·회기)과 동일:
       Title_01(18 SemiBold) + gap 6 + 카운트 Body_03(14 Regular, gray-600) -->
  <div class="mb-4 flex items-center gap-1.5">
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      사용 내역
    </Typography>
    {#if itemVMs.length > 0}
      <Typography variant="body-03-normal-regular" color="text-gray-600">
        {itemVMs.length}
      </Typography>
    {/if}
  </div>

  {#if usageQuery.isLoading}
    <div class="py-10 text-center">
      <Typography variant="body-02-normal-regular" color="text-body-subtle">
        로딩 중...
      </Typography>
    </div>
  {:else if itemVMs.length === 0}
    <!-- 빈 상태: 높이 140 · sunken 면(bg-base) · radius 12(중형 블록)
         타이틀 18 SemiBold(title-default) → gap 8 → 설명 15(body-subtle) -->
    <div
      class="flex h-35 flex-col items-center justify-center gap-2 rounded-xl bg-bg-base"
    >
      <Typography variant="title-01-normal-semibold" color="text-title-default">
        사용 내역이 없어요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-body-subtle">
        아직 이 바우처로 청구한 내역이 없어요
      </Typography>
    </div>
  {:else}
    <ul>
      {#each itemVMs as item (item.billableItemId)}
        <li
          class="flex items-center gap-4 border-b border-gray-100 py-4 last:border-b-0"
        >
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            className="w-20 shrink-0"
          >
            {fmtUsageDate(item.billableDate)}
          </Typography>

          <div class="min-w-0 flex-1">
            <Typography
              variant="body-01-normal-semibold"
              color="text-title-default"
              className="block truncate-safe"
            >
              {item.description || '청구 항목'}
            </Typography>
            <!-- 인라인 병기: 덩어리 내부 4 · 구분선 주변 6 -->
            <div class="mt-2 flex items-center gap-1.5">
              <span class="flex items-baseline gap-1">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                >
                  단가
                </Typography>
                <Typography
                  variant="body-02-normal-medium"
                  color="text-body-default"
                >
                  {fmtAmount(item.amount)}원
                </Typography>
              </span>
              <span class="h-3 w-px bg-gray-300" aria-hidden="true"></span>
              <span class="flex items-baseline gap-1">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                >
                  지원 금액
                </Typography>
                <Typography
                  variant="body-02-normal-medium"
                  color="text-body-default"
                >
                  {fmtAmount(item.subsidyAmount)}원
                </Typography>
              </span>
            </div>
          </div>

          <!-- button-billing(민트 아웃라인) · Small: 높이 32 · 좌우 16 · 아이콘 16 · gap 8.
               hover는 배경이 아니라 보더·텍스트를 mint-400으로 (Web_Design.md §button-billing) -->
          <button
            type="button"
            onclick={goBill}
            class="flex-center h-8 w-22 shrink-0 gap-2 rounded-lg text-body-03-normal-medium border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover"
          >
            <!-- Small(32)의 아이콘은 16 — 16짜리 청구 에셋이 없어 20 에셋을 16 박스에 맞춘다 -->
            <BillsIcon20 className="h-4 w-4" />
            <span>청구서</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#snippet docIcon()}
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path
      d="M7 4.5h9L21 9.5V22a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 6 22V6A1.5 1.5 0 0 1 7 4.5Z"
      fill="currentColor"
      fill-opacity="0.12"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      d="M15.5 4.5V9.5H20.5M9.5 13.5h9M9.5 17h6"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}
