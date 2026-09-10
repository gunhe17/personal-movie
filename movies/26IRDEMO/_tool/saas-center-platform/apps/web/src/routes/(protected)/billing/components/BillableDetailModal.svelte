<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import { mapToBillableDetailVM } from '$lib/features/billing/view-model'
  import { BILLABLE_STATUS_COLORS } from '$lib/features/billing/constants'
  import {
    getBillableDetail,
    getPaymentList,
    type CreatePaymentPayload,
    PAYMENT_METHOD_LABELS
  } from '$lib/hooks/actions/billable.action'
  import { formatUtcToKst } from '$lib/utils/date'
  import { modalStore } from '$lib/stores/modal'
  import PaymentModal from './PaymentModal.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import Counsel20Icon from '$lib/assets/Counsel20Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'

  interface Props {
    modalId?: string
    closeModal?: () => void
    billableId: string
    canWrite?: boolean
    clientName?: string
    clientBirthDate?: string
    clientGender?: 'male' | 'female'
    clientProfileImageUrl?: string | null
    /** agent prefill(?action=pay) — 상세 로드 후 납부 등록 창을 자동으로 연다 */
    autoOpenPayment?: boolean
    onDelete?: () => Promise<void>
    onUpdateNotes?: (notes: string) => Promise<void>
    onCreatePayment?: (payload: CreatePaymentPayload) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    billableId,
    canWrite = false,
    clientName,
    clientBirthDate,
    clientGender,
    clientProfileImageUrl,
    autoOpenPayment = false,
    onDelete,
    onUpdateNotes,
    onCreatePayment
  }: Props = $props()

  // 청구 상세 + 납부 기록 쿼리 (invalidate 시 자동 갱신)
  const detailQuery = $derived(
    queryBuilder(getBillableDetail, () => ({
      centerId: $centerId,
      billableId
    }))
  )
  const paymentsQuery = $derived(
    queryBuilder(getPaymentList, () => ({
      centerId: $centerId,
      billableId
    }))
  )

  const detail = $derived(
    detailQuery.data ? mapToBillableDetailVM(detailQuery.data) : null
  )
  const payments = $derived(paymentsQuery.data ?? null)

  const displayName = $derived(clientName ?? detail?.clientName ?? '-')
  // 아바타·생년월일·성별은 호출부가 넘겨주면 그걸 쓰고, 없으면 상세 응답이 실어준 값으로 채운다
  // (목록 밖에서 열리는 진입점이 많아 prop만 믿으면 이니셜 폴백으로 떨어진다)
  const displayGender = $derived(clientGender ?? detail?.clientGender ?? null)
  const displayBirthDate = $derived(
    clientBirthDate ?? detail?.clientBirthDate ?? undefined
  )
  const displayProfileImageUrl = $derived(
    clientProfileImageUrl ?? detail?.clientProfileImageUrl ?? null
  )

  let isProcessing = $state(false)

  function openPaymentModal(unpaidAmount: number) {
    modalStore.open({
      component: PaymentModal,
      props: { unpaidAmount, onConfirm: onCreatePayment },
      options: { customWidth: 420 }
    })
  }

  // 상세는 비동기 조회라 열린 뒤에야 미수금을 안다 — 로드 완료 시점에 1회만 연다
  let paymentAutoOpened = false
  $effect(() => {
    if (!autoOpenPayment || paymentAutoOpened || !detail) return
    if (!canWrite || detail.status !== 'issued' || detail.unpaidAmount <= 0)
      return
    paymentAutoOpened = true
    openPaymentModal(detail.unpaidAmount)
  })

  async function handleDelete() {
    if (isProcessing || !onDelete) return
    isProcessing = true
    try {
      await onDelete()
    } finally {
      isProcessing = false
    }
  }

  const canDeleteBillable = $derived(detail?.status === 'draft' && canWrite)

  // 케이스 코드는 항목별 필드라 한 청구서에 여러 케이스가 섞일 수 있다
  // (대량 청구는 내담자 단위로 묶는다 — BulkBillingPreviewModal).
  // 전 항목이 같은 케이스면 코드를 섹션 헤더에 한 번만 노출하고 행에서는 뺀다.
  // 섞이거나 코드 없는 수기 항목이 하나라도 있으면 행별 배지를 유지한다.
  const sharedCaseCode = $derived.by(() => {
    const items = detail?.items ?? []
    if (items.length === 0) return null
    const codes = new Set(items.map((i) => i.related_case_code ?? null))
    if (codes.size !== 1) return null
    return [...codes][0]
  })
  // 하단 액션 바(결제하기·삭제)는 스크롤 밖 고정 — 본문이 길어져도 항상 손에 닿는다
  const canPayBillable = $derived(
    !!detail &&
      detail.status === 'issued' &&
      canWrite &&
      detail.unpaidAmount > 0
  )

  // 청구 항목 앞 아이콘: related_type(counseling_session / assessment_session 등)으로만 판정.
  // 수기 항목처럼 유래를 알 수 없으면 아이콘 없이 이름만 노출한다.
  function itemIconKind(
    relatedType: string | null
  ): 'counseling' | 'assessment' | null {
    if (!relatedType) return null
    if (relatedType.includes('assessment')) return 'assessment'
    if (relatedType.includes('counseling')) return 'counseling'
    return null
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  bodyClass="px-5 pt-5 pb-7"
  bodyScrollable={true}
  headerClass="px-5 py-4"
  footerClass={detail ? 'px-5 pt-4 pb-5 shadow-sticky-top' : 'hidden'}
  showFooterBorder={false}
>
  <!-- 헤더는 스크롤 밖(BaseModal header 슬롯)에 둔다 — 청구 항목이 많아 본문이 넘칠 때
       제목·닫기가 함께 밀려 올라가지 않게 한다. 패딩은 §modal 규격 — 헤더 px-5 py-4(좌우 20·상하 16).
       닫기 버튼은 BaseModal 기본(CloseIcon32 · icon-secondary)을 그대로 쓴다 -->
  {#snippet header()}
    <Typography variant="headline-02-normal-semibold" color="text-body-strong">
      청구서
    </Typography>
  {/snippet}

  {#snippet body()}
    {#if detail}
      <!-- 영수증 레이아웃(Figma 9859:338916). 좌우·상단은 모달 기준선 20으로 맞춘다
           (옛 24는 Figma 실측값이었으나 §Components>modal 정본이 이긴다 — 2026-08-18).
           하단 40 = footer 없는 모달 규격(액션 바가 있으면 20 + 푸터).
           블록 간 16 · 점선 구분선 위아래 20(my-1) · 진한 실선 위아래 24(my-2) -->
      <div class="flex flex-col gap-4">
        <!-- 내담자 + 메모 (블록 내부 간격 20) -->
        <div class="flex flex-col gap-5">
          <!-- 내담자: 아바타 + 이름/생년월일·성별 + 상태 뱃지 -->
          <div class="flex items-center gap-4">
            <ClientAvatar
              profileImageUrl={displayProfileImageUrl}
              name={displayName}
              gender={displayGender}
              sizeClass="h-10 w-10"
              textClass="text-body-02-normal-semibold"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <Typography
                variant="title-01-normal-semibold"
                color="text-body-strong"
                className="block truncate-safe"
              >
                {displayName}
              </Typography>
              <ClientBirthGender
                birthDate={displayBirthDate}
                gender={displayGender}
                variant="body-01-normal-regular"
                color="text-gray-700"
              />
            </div>
            <span
              class="shrink-0 inline-flex h-8 items-center rounded-full px-3 text-body-02-normal-medium {BILLABLE_STATUS_COLORS[
                detail.status
              ] ?? ''}"
            >
              {detail.statusLabel}
            </span>
          </div>

          <!-- 메모 (보기 전용) -->
          <div class="flex flex-col gap-1 rounded-lg bg-gray-50 p-3">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              메모
            </Typography>
            <Typography
              variant="body-01-reading-regular"
              color={detail.notes ? 'text-gray-800' : 'text-gray-400'}
              className="whitespace-pre-wrap"
            >
              {detail.notes || '메모가 없습니다'}
            </Typography>
          </div>
        </div>

        <!-- 실선 구분 (영수증 절취선 위 강조선) -->
        <div class="my-2 border-t border-border-emphasis"></div>

        <!-- 청구 항목 + 금액 요약 (블록 내부 간격 16) -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              청구 항목 ({detail.items.length}건)
            </Typography>
            {#if sharedCaseCode}
              <span
                class="inline-flex h-6 shrink-0 items-center rounded bg-gray-100 px-2 text-label-01-normal-medium text-gray-600"
              >
                {sharedCaseCode}
              </span>
            {/if}
          </div>

          {#each detail.items as item (item.id)}
            {@const iconKind = itemIconKind(item.related_type)}
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex items-center gap-2">
                  {#if iconKind === 'counseling'}
                    <span class="inline-flex shrink-0 items-center">
                      <Counsel20Icon />
                    </span>
                  {:else if iconKind === 'assessment'}
                    <span
                      class="inline-flex shrink-0 items-center [&>svg]:h-5 [&>svg]:w-5"
                    >
                      <AssessmentStack />
                    </span>
                  {/if}
                  <Typography
                    variant="body-01-normal-semibold"
                    color="text-gray-900"
                    className="truncate-safe"
                  >
                    {item.description}
                  </Typography>
                  {#if !sharedCaseCode && item.related_case_code}
                    <span
                      class="inline-flex h-6 shrink-0 items-center rounded bg-gray-100 px-2 text-label-01-normal-medium text-gray-600"
                    >
                      {item.related_case_code}
                    </span>
                  {/if}
                </div>
                <Typography
                  variant="body-02-reading-regular"
                  color="text-gray-600"
                >
                  {item.quantity}개 x {item.unit_price.toLocaleString()}원
                </Typography>
                {#if item.voucher_name}
                  <!-- 항목 금액(우측)은 총액 기준이라, 이 항목에 붙은 바우처
                       지원금은 여기서 차감분(-)으로 함께 읽힌다 -->
                  <Typography
                    variant="body-02-reading-regular"
                    color="text-mint-500"
                  >
                    {item.subsidy_amount > 0
                      ? `바우처 · ${item.voucher_name} · -${item.subsidy_amount.toLocaleString('ko-KR')}원`
                      : `바우처 · ${item.voucher_name}`}
                  </Typography>
                {/if}
              </div>
              <Typography
                variant="body-01-normal-medium"
                color="text-gray-900"
                className="shrink-0"
              >
                {item.amount.toLocaleString()}원
              </Typography>
            </div>
          {/each}
        </div>

        <!-- 납부 기록 (결제하기 버튼은 하단 고정 액션 바가 소유) -->
        {#if !canPayBillable && payments && payments.items.length > 0}
          <div class="flex flex-col gap-4">
            <div class="my-2 border-t border-border-emphasis"></div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
            >
              납부 ({payments.items.length}건)
            </Typography>
            <div class="flex flex-col gap-2">
              {#each payments.items as payment (payment.id)}
                <div
                  class="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <span
                      class="shrink-0 rounded bg-gray-100 px-2 py-1 text-label-02-normal-medium text-gray-600"
                    >
                      {PAYMENT_METHOD_LABELS[payment.payment_method] ??
                        payment.payment_method}
                    </span>
                    <div class="min-w-0">
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-gray-900"
                        className="block"
                      >
                        {formatUtcToKst(payment.paid_at, 'YYYY. MM. DD HH:mm')}
                      </Typography>
                      {#if payment.receipt_number}
                        <Typography
                          variant="body-03-normal-regular"
                          color="text-title-subtitle"
                          className="mt-1 block"
                        >
                          영수증 : {payment.receipt_number}
                        </Typography>
                      {/if}
                    </div>
                  </div>
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-gray-900"
                    className="shrink-0"
                  >
                    {payment.amount.toLocaleString()}원
                  </Typography>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex min-h-60 flex-col items-center justify-center gap-3">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary-500"
        ></div>
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          불러오는 중...
        </Typography>
      </div>
    {/if}
  {/snippet}

  <!-- 하단 고정 영역 — 본문이 스크롤돼도 금액 요약·미수금·액션은 자리를 지킨다.
       구분선 대신 shadow-sticky-top(위로 향하는 연한 그림자)으로 층을 알린다 —
       콘텐츠가 밑을 지나가는 층이라 선보다 그림자가 정확하다. 상단 패딩 16 = §modal 푸터 규격 -->
  {#snippet footer()}
    {#if detail}
      <div class="flex w-full flex-col gap-4">
        <!-- 금액 요약 (총액·지원금·할인·납부액 행 간격 12) -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <Typography variant="body-01-normal-regular" color="text-gray-600">
              총액
            </Typography>
            <Typography
              variant="headline-02-normal-medium"
              color="text-gray-900"
            >
              {detail.subtotalAmountFormatted}
            </Typography>
          </div>
          {#if detail.hasSubsidy}
            <div class="flex items-center justify-between gap-3">
              <Typography
                variant="body-01-normal-regular"
                color="text-gray-600"
              >
                바우처 지원금
              </Typography>
              <Typography
                variant="body-01-normal-regular"
                color="text-mint-500"
              >
                -{detail.subsidyAmountFormatted}
              </Typography>
            </div>
          {/if}
          {#if detail.hasDiscount}
            <div class="flex items-center justify-between gap-3">
              <Typography
                variant="body-01-normal-regular"
                color="text-gray-600"
              >
                묶음 할인
              </Typography>
              <Typography
                variant="body-01-normal-regular"
                color="text-mint-500"
              >
                -{detail.discountAmountFormatted}
              </Typography>
            </div>
          {/if}
          <div class="flex items-center justify-between gap-3">
            <Typography variant="body-01-normal-regular" color="text-gray-600">
              납부액
            </Typography>
            <Typography variant="body-01-normal-regular" color="text-gray-900">
              {detail.paidAmountFormatted}
            </Typography>
          </div>
        </div>

        <!-- 점선 구분 -->
        <div class="my-1 border-t border-dashed border-border-strong"></div>

        <!-- 미수금 -->
        <div class="flex items-center justify-between gap-3">
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            미수금
          </Typography>
          <Typography
            variant="headline-02-normal-medium"
            color="text-status-danger"
          >
            {detail.unpaidAmountFormatted}
          </Typography>
        </div>

        {#if canPayBillable && detail}
          <!-- 요약(정보) ↔ 액션 구분 24 = gap 16 + mt-2 -->
          <button
            onclick={() => openPaymentModal(detail.unpaidAmount)}
            class="mt-2 flex-center h-13 w-full rounded-lg bg-billing-solid text-body-01-normal-medium text-white transition-colors hover:bg-billing-solid-hover"
          >
            결제하기
          </button>
        {:else if canDeleteBillable}
          <div class="mt-2 flex w-full justify-center">
            <button
              onclick={handleDelete}
              disabled={isProcessing}
              class="flex-center h-11 gap-2 rounded-lg px-4 text-body-02-normal-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <TrashIcon24 />
              청구서 삭제
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}
</BaseModal>
