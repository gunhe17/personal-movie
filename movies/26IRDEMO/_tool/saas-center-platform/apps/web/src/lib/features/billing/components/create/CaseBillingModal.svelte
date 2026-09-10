<script lang="ts">
  import type { ClientListItem } from '$lib/hooks/actions/client.action'
  import type { CreateBillablePayload } from '$lib/hooks/actions/billable.action'
  import Typography from '@common/components/Typography.svelte'
  import BillableModalShell from './parts/BillableModalShell.svelte'
  import ClientField from './parts/ClientField.svelte'
  import VoucherField, {
    type SelectedVoucher
  } from './parts/VoucherField.svelte'
  import SessionSelectList from './parts/SessionSelectList.svelte'
  import SubsidyField from './parts/SubsidyField.svelte'
  import AmountSummary from './parts/AmountSummary.svelte'
  import NotesField from './parts/NotesField.svelte'
  import type { ItemRow, PrefillItem, SessionOption } from './types'
  import { buildCreatePayload, buildVoucherPatch, sumItems } from './helpers'

  let {
    modalId = '',
    closeModal = () => {},
    client,
    sessions = [],
    priceTemplate,
    caseRelatedType,
    relatedCaseId,
    onConfirm
  } = $props<{
    modalId?: string
    closeModal?: () => void
    client: ClientListItem
    /** 케이스의 전체 회기 (청구됨·취소 포함 — 선택 불가로 함께 노출) */
    sessions?: SessionOption[]
    /** 회기 1건에 적용할 단가/바우처 템플릿 (단가표 매칭 결과) */
    priceTemplate: PrefillItem
    /** 예: 'counseling_case' — 부분 선택 시 '_session'으로 자동 전환된다 */
    caseRelatedType: string
    relatedCaseId: string
    onConfirm?: (payload: CreateBillablePayload) => Promise<void>
  }>()

  // 모달 열릴 때 1회 초기값
  // svelte-ignore state_referenced_locally
  let selectedClient = $state<ClientListItem | null>(client)

  const sessionRelatedType = $derived(
    caseRelatedType.replace('_case', '_session')
  )

  // 청구 가능한 회기 = 미청구 + 취소 아님
  const selectableSessions = $derived(
    sessions.filter((s: SessionOption) => !s.billed && s.status !== 'cancelled')
  )
  // 이미 청구된 회기가 하나라도 있으면 케이스 전체를 덮는 패키지는 발행할 수 없다
  // (백엔드도 '개별 청구가 있으면 패키지 차단')
  const hasBilledSession = $derived(
    sessions.some((s: SessionOption) => s.billed)
  )

  function makeItem(session: SessionOption, id: number): ItemRow {
    return {
      id,
      description: priceTemplate.description,
      quantity: 1,
      unitPrice: priceTemplate.unitPrice ?? 0,
      priceListId: priceTemplate.priceListId ?? null,
      itemType: priceTemplate.itemType ?? 'service',
      locked: false,
      relatedSessionId: session.id,
      clientVoucherId: priceTemplate.clientVoucherId ?? null,
      voucherName: priceTemplate.voucherName ?? null,
      voucherRemaining: priceTemplate.voucherRemaining ?? null,
      voucherTotal: priceTemplate.voucherTotal ?? null,
      voucherSupportText: priceTemplate.voucherSupportText ?? null
    }
  }

  // 기본값 = 아무 회기도 선택 안 됨 — 무엇을 청구할지는 사용자가 고른다
  let selectedIds = $state<string[]>([])
  let items = $state<ItemRow[]>([])
  let nextId = $state(1)
  let notes = $state('')
  let discountAmount = $state(0)
  let subsidyAmount = $state(0)
  let isSubmitting = $state(false)
  let selectedVoucher = $state<SelectedVoucher | null>(null)

  /**
   * 선택 회기 → 청구 항목 동기화.
   * 이미 있던 항목은 회기 기준으로 그대로 유지해 사용자가 고친 단가·내역이 날아가지 않게 한다.
   */
  function syncItems(nextSelected: string[]) {
    const bySession = new Map<string, ItemRow>(
      items
        .filter((it) => !!it.relatedSessionId)
        .map((it) => [it.relatedSessionId as string, it])
    )
    items = sessions
      .filter((s: SessionOption) => nextSelected.includes(s.id))
      .map((s: SessionOption) => bySession.get(s.id) ?? makeItem(s, nextId++))
  }

  function toggleSession(sessionId: string) {
    const next = selectedIds.includes(sessionId)
      ? selectedIds.filter((id) => id !== sessionId)
      : [...selectedIds, sessionId]
    selectedIds = next
    syncItems(next)
  }

  function toggleAll() {
    const allIds = selectableSessions.map((s: SessionOption) => s.id)
    const allSelected = allIds.every((id: string) => selectedIds.includes(id))
    const next = allSelected ? [] : allIds
    selectedIds = next
    syncItems(next)
  }

  // 전량 선택 = 패키지 선결제, 부분 선택 = 회기별 청구 (모바일 통합 청구 시트와 동일 규칙)
  const isPackageMode = $derived(
    !hasBilledSession &&
      selectableSessions.length > 1 &&
      selectableSessions.every((s: SessionOption) => selectedIds.includes(s.id))
  )
  const relatedType = $derived(
    isPackageMode ? caseRelatedType : sessionRelatedType
  )

  function handleVoucherChange(voucher: SelectedVoucher | null) {
    const patch = buildVoucherPatch(voucher)
    items = items.map((it) => ({ ...it, ...patch }))
    if (!voucher) subsidyAmount = 0
  }

  $effect(() => {
    const v = selectedVoucher
    if (!v) return
    const needsPatch = items.some((it) => it.clientVoucherId !== v.id)
    if (!needsPatch) return
    const patch = buildVoucherPatch(v)
    items = items.map((it) =>
      it.clientVoucherId === v.id ? it : { ...it, ...patch }
    )
  })

  const subtotal = $derived(sumItems(items))
  const subsidyExceedsSubtotal = $derived(subsidyAmount > subtotal)

  const voucherSessionsShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v) return false
    const totalSessions = items.reduce(
      (sum, it) => sum + (it.clientVoucherId ? it.quantity : 0),
      0
    )
    return totalSessions > v.remainingSessions
  })

  const voucherAmountShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v || v.remainingAmount == null) return null
    if (subsidyAmount <= v.remainingAmount) return null
    return v.remainingAmount - subsidyAmount
  })

  const canSubmit = $derived(
    !!selectedClient &&
      selectedIds.length > 0 &&
      items.length > 0 &&
      items.every((i) => i.description.trim()) &&
      discountAmount + subsidyAmount <= subtotal &&
      !subsidyExceedsSubtotal &&
      !voucherSessionsShortage
  )

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !onConfirm || !selectedClient) return
    isSubmitting = true
    try {
      const payload = buildCreatePayload({
        clientId: selectedClient.id,
        items,
        notes,
        discountAmount,
        subsidyAmount,
        relatedType,
        relatedCaseId
        // 회기별 relatedSessionId는 각 item이 들고 있다
      })
      await onConfirm(payload)
      closeModal()
    } catch {
      // 에러는 service에서 처리
    } finally {
      isSubmitting = false
    }
  }
</script>

<!-- 타이틀은 선택 범위와 무관하게 고정한다 — 전량 선택으로 헤더가 통째로 바뀌면
     같은 모달이 다른 화면처럼 읽히고, 목록에서 연 것과 상세에서 연 것이 달라 보인다.
     패키지/회기별의 차이는 계산서 위 안내 문구가 설명한다. -->
<BillableModalShell
  {modalId}
  {closeModal}
  title="청구서를 만들게요"
  subtitle="청구할 회기를 선택해주세요"
  {canSubmit}
  {isSubmitting}
  onSubmit={handleSubmit}
  showSummary={selectedIds.length > 0}
>
  {#snippet summary()}
    <div class="flex flex-col gap-2">
      <!-- 선택 범위 안내 — 전량이면 패키지 선결제, 부분이면 회기별 청구 -->
      <Typography variant="body-02-normal-regular" color="text-body-subtle">
        {#if isPackageMode}
          총 {selectedIds.length}개 회차에 대한 선결제 청구서를 생성할게요
        {:else}
          선택한 {selectedIds.length}개 회기를 청구할게요
        {/if}
      </Typography>

      {#if items.length > 0}
        <AmountSummary
          {subtotal}
          bind:discount={discountAmount}
          subsidy={subsidyAmount}
          unitPrice={priceTemplate.unitPrice ?? 0}
          unitCount={items.length}
        />
        {#if voucherSessionsShortage}
          <div
            class="rounded-lg bg-status-danger-bg px-3 py-3 text-body-02-normal-regular text-status-danger"
          >
            선택한 바우처의 잔여 회기({selectedVoucher?.remainingSessions}회)보다
            많은 회기를 청구할 수 없어요
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}
  <ClientField bind:client={selectedClient} locked />

  <VoucherField
    clientId={selectedClient?.id ?? null}
    bind:selected={selectedVoucher}
    onChange={handleVoucherChange}
  />

  {#if selectedVoucher}
    <SubsidyField
      bind:value={subsidyAmount}
      error={subsidyExceedsSubtotal
        ? `정가 합계(${subtotal.toLocaleString()}원)를 초과할 수 없어요`
        : null}
      warning={voucherAmountShortage != null
        ? `바우처 잔여 금액(${selectedVoucher?.remainingAmount?.toLocaleString()}원)을 ${Math.abs(voucherAmountShortage).toLocaleString()}원 초과해요. 진행은 가능하지만 운영 보정이 필요해요.`
        : null}
    />
  {/if}

  <SessionSelectList
    {sessions}
    {selectedIds}
    onToggle={toggleSession}
    onToggleAll={toggleAll}
  />

  <NotesField bind:value={notes} />
</BillableModalShell>
