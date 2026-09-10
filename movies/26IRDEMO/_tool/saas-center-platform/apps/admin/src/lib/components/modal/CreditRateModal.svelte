<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    currentRate: number | null
    onConfirm?: (rate: number, reason: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    currentRate = null,
    onConfirm = () => {}
  }: Props = $props()

  let newRate = $state(currentRate ?? 2000)
  let reason = $state('')

  const isValid = $derived(newRate >= 100 && newRate <= 100000 && newRate !== currentRate)

  function handleConfirm() {
    if (!isValid) return
    onConfirm(newRate, reason || '비율 변경')
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
    <Typography variant="headline-02-semibold" color="text-gray-800">토큰/크레딧 비율 변경</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-4">
      <!-- 현재 비율 -->
      <div class="rounded-lg bg-gray-50 p-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">현재 비율</span>
          <span class="font-medium text-gray-800">
            {currentRate ? `${currentRate.toLocaleString()} tokens / 1 credit` : '미설정'}
          </span>
        </div>
      </div>

      <!-- 새 비율 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="new-rate">
          새 비율 <span class="text-red-500">*</span>
        </label>
        <div class="flex items-center gap-2">
          <input
            id="new-rate"
            type="number"
            min="100"
            max="100000"
            step="100"
            bind:value={newRate}
            class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <span class="shrink-0 text-sm text-gray-500">tokens/credit</span>
        </div>
        <p class="mt-1 text-xs text-gray-400">100 ~ 100,000 사이 값 입력. 변경 후 신규 호출부터 적용됩니다.</p>
      </div>

      <!-- 사유 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="rate-reason">변경 사유</label>
        <input
          id="rate-reason"
          type="text"
          placeholder="예: 모델 변경에 따른 비율 조정"
          bind:value={reason}
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex items-center justify-center h-11 rounded-lg border border-gray-200 px-6 hover:border-gray-300 transition-colors"
    >
      <Typography variant="title-01-semibold" color="text-gray-600">취소</Typography>
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!isValid}
      class="flex items-center justify-center h-11 rounded-lg px-6 transition-colors
        {isValid ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
    >
      <Typography variant="title-01-semibold" color={isValid ? 'text-white' : 'text-gray-400'}>적용</Typography>
    </button>
  {/snippet}
</BaseModal>
