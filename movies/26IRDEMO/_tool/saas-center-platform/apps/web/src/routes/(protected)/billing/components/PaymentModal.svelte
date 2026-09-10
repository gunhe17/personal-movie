<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import DatePickerInput from '$lib/components/DatePickerInput.svelte'
  import TimeSelect from '$lib/components/TimeSelect.svelte'
  import type {
    CreatePaymentPayload,
    PaymentMethodType
  } from '$lib/hooks/actions/billable.action'
  import { dateToString } from '$lib/utils/date'

  interface Props {
    modalId?: string
    closeModal?: () => void
    unpaidAmount: number
    onConfirm?: (payload: CreatePaymentPayload) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    unpaidAmount = 0,
    onConfirm
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let amount = $state(unpaidAmount)
  let paymentMethod = $state<PaymentMethodType>('card')
  const now = new Date()
  let paidAt = $state(dateToString(now, 'YYYY-MM-DD'))
  let paidTime = $state(
    `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')}`
  )
  let notes = $state('')
  let isSubmitting = $state(false)

  const methodOptions = [
    { value: 'card', title: '카드' },
    { value: 'transfer', title: '계좌이체' },
    { value: 'cash', title: '현금' }
  ]

  // 과오납 방지: 금액은 1원 이상 && 미수금 이하
  const isValid = $derived(amount > 0 && amount <= unpaidAmount)

  function handleAmountInput(e: Event) {
    const target = e.target as HTMLInputElement
    const raw = target.value.replace(/[^0-9]/g, '')
    const parsed = raw ? parseInt(raw, 10) : 0
    // 과오납 방지: 미수금을 초과하지 않도록 상한 적용
    amount = Math.min(parsed, unpaidAmount)
  }

  async function handleSubmit() {
    if (!isValid || isSubmitting || !onConfirm) return
    isSubmitting = true
    try {
      await onConfirm({
        amount,
        payment_method: paymentMethod,
        paid_at: new Date(`${paidAt}T${paidTime}:00`).toISOString(),
        notes: notes.trim() || undefined
      })
      closeModal()
    } catch {
      // 에러는 service에서 처리
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="w-full">
      <Typography variant="headline-02-normal-semibold" color="text-gray-900">
        납부 등록
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="flex flex-col gap-5">
      <!-- 납부 금액 -->
      <div>
        <div class="mb-2 flex items-center justify-between">
          <Typography variant="body-01-medium" color="text-gray-700">
            납부 금액 <span class="field-required">*</span>
          </Typography>
          {#if unpaidAmount > 0}
            <span
              class="text-sm {amount > 0
                ? unpaidAmount - amount > 0
                  ? 'text-status-danger'
                  : 'text-[#2D333B]'
                : 'text-gray-400'}"
            >
              {amount > 0 ? '납부 후 미수금' : '미수금'}: {(
                unpaidAmount - amount
              ).toLocaleString()}원
            </span>
          {/if}
        </div>
        <div
          class="flex h-13 items-center rounded-lg border border-gray-200 px-4"
        >
          <input
            type="text"
            value={amount > 0 ? amount.toLocaleString() : ''}
            oninput={handleAmountInput}
            placeholder="0"
            class="w-full border-none bg-transparent text-lg font-bold text-gray-800 outline-none placeholder:text-placeholder focus:ring-0 text-right"
          />
          <span class="ml-2 shrink-0 text-sm font-medium text-gray-400">원</span
          >
        </div>
        {#if unpaidAmount > 0}
          <div class="mt-2 flex gap-2">
            {#each [25, 50, 75, 100] as pct}
              {@const pctAmount = Math.round((unpaidAmount * pct) / 100)}
              <button
                type="button"
                onclick={() => (amount = pctAmount)}
                class="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors {amount ===
                pctAmount
                  ? 'bg-[#2D333B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
              >
                {pct}%
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 납부 수단 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          납부 수단
        </Typography>
        <Select
          class="w-full rounded-lg"
          selected={paymentMethod}
          on:change={(e) => (paymentMethod = e.detail.value)}
          hoverBoxClass="left-0 w-full"
          options={methodOptions}
        />
      </div>

      <!-- 납부일시 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          납부일시
        </Typography>
        <div class="grid grid-cols-2 gap-2">
          <DatePickerInput bind:value={paidAt} />
          <TimeSelect bind:value={paidTime} />
        </div>
      </div>

      <!-- 메모 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          메모 <span class="text-body-03-normal-regular text-body-subtle"
            >(선택)</span
          >
        </Typography>
        <textarea
          bind:value={notes}
          placeholder="메모를 입력해주세요"
          rows={2}
          class="w-full rounded-lg border border-gray-200 text-body-03-reading-regular focus:border-border-active focus:outline-none resize-none px-3 py-3.5"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full flex-wrap justify-end gap-2 md:gap-3">
      <button
        onclick={closeModal}
        class="flex h-11 items-center justify-center rounded-lg border border-gray-200 px-4 md:px-6 transition-colors hover:bg-gray-50"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600"
          >취소</Typography
        >
      </button>
      <button
        onclick={handleSubmit}
        disabled={!isValid || isSubmitting}
        class="flex h-11 items-center justify-center rounded-lg px-4 md:px-6 text-white transition-colors {isValid &&
        !isSubmitting
          ? 'bg-[#2D333B] hover:bg-[#242930]'
          : 'cursor-not-allowed bg-gray-300'}"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSubmitting ? '처리 중...' : '납부 등록'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
