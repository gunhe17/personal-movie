<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import { PLAN_LABELS } from '$lib/features/subscription/constants'
  import { formatDate } from '$lib/utils/format'

  interface PaymentInfo {
    id: string
    plan: string
    amount: number
    status: string
    method: string | null
    paid_at: string | null
    created_at: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    payment: PaymentInfo
    onConfirm?: (reason: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    payment,
    onConfirm = () => {}
  }: Props = $props()

  let reason = $state('')

  const isValid = $derived(reason.trim().length > 0)

  function handleConfirm() {
    if (!isValid) return
    onConfirm(reason.trim())
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showCloseButton={true}
  headerClass="px-6 py-4"
  bodyClass="px-6 py-4"
  footerClass="px-6 py-4"
>
  {#snippet header()}
    <Typography variant="headline-02-semibold" color="text-gray-800">결제 취소</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-4">
      <!-- 결제 정보 -->
      <div class="rounded-lg bg-gray-50 p-4">
        <dl class="space-y-2">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">플랜</dt>
            <dd class="text-sm font-medium text-gray-800">{PLAN_LABELS[payment.plan] ?? payment.plan}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">금액</dt>
            <dd class="text-sm font-semibold text-gray-800">{payment.amount.toLocaleString()}원</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">결제일</dt>
            <dd class="text-sm text-gray-800">{payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.created_at)}</dd>
          </div>
          {#if payment.method}
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">결제수단</dt>
              <dd class="text-sm text-gray-800">{payment.method}</dd>
            </div>
          {/if}
        </dl>
      </div>

      <!-- 취소 사유 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="cancel-reason">
          취소 사유 <span class="text-red-500">*</span>
        </label>
        <textarea
          id="cancel-reason"
          placeholder="취소 사유를 입력하세요"
          bind:value={reason}
          rows="3"
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none resize-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        ></textarea>
      </div>

      <!-- 경고 -->
      <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <p class="text-sm text-red-700">
          결제 취소 시 토스페이먼츠를 통해 환불이 진행됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex items-center justify-center h-11 rounded-lg border border-gray-200 px-6 hover:border-gray-300 transition-colors"
    >
      <Typography variant="title-01-semibold" color="text-gray-600">닫기</Typography>
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!isValid}
      class="flex items-center justify-center h-11 rounded-lg px-6 transition-colors
        {isValid ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
    >
      <Typography variant="title-01-semibold" color={isValid ? 'text-white' : 'text-gray-400'}>취소 확인</Typography>
    </button>
  {/snippet}
</BaseModal>
