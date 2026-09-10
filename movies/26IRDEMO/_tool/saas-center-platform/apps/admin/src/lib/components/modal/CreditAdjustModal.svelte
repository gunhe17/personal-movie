<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    currentUsed: number
    currentLimit: number
    onConfirm?: (type: 'add' | 'reset', amount: number, reason: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    currentUsed = 0,
    currentLimit = 0,
    onConfirm = () => {}
  }: Props = $props()

  let adjustType = $state<'add' | 'reset'>('add')
  let amount = $state(0)
  let reason = $state('')

  const isValid = $derived(adjustType === 'reset' || (adjustType === 'add' && amount > 0))
  const currentPct = $derived(currentLimit > 0 ? Math.min(100, Math.round((currentUsed / currentLimit) * 100)) : 0)

  function handleConfirm() {
    if (!isValid) return
    onConfirm(adjustType, adjustType === 'add' ? amount : 0, reason || (adjustType === 'add' ? '크레딧 한도 추가' : '사용량 초기화'))
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
    <Typography variant="headline-02-semibold" color="text-gray-800">크레딧 조정</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-4">
      <!-- 현재 상태 -->
      <div class="rounded-lg bg-gray-50 p-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">현재 사용량</span>
          <span class="font-medium text-gray-800">{currentUsed} / {currentLimit}</span>
        </div>
        <div class="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            class="h-2 rounded-full {currentPct >= 90 ? 'bg-red-500' : currentPct >= 70 ? 'bg-amber-400' : 'bg-blue-500'}"
            style="width: {currentPct}%"
          ></div>
        </div>
      </div>

      <!-- 조정 타입 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">조정 방식</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-lg border-2 p-3 text-left transition-colors
              {adjustType === 'add' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
            onclick={() => (adjustType = 'add')}
          >
            <span class="text-sm font-semibold text-gray-800">한도 추가</span>
            <p class="mt-0.5 text-xs text-gray-500">크레딧 한도를 늘립니다</p>
          </button>
          <button
            type="button"
            class="rounded-lg border-2 p-3 text-left transition-colors
              {adjustType === 'reset' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
            onclick={() => (adjustType = 'reset')}
          >
            <span class="text-sm font-semibold text-gray-800">사용량 초기화</span>
            <p class="mt-0.5 text-xs text-gray-500">사용된 크레딧을 0으로 리셋합니다</p>
          </button>
        </div>
      </div>

      <!-- 추가량 (add 모드) -->
      {#if adjustType === 'add'}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5" for="amount">추가 크레딧</label>
          <input
            id="amount"
            type="number"
            min="1"
            bind:value={amount}
            class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <p class="mt-1 text-xs text-gray-400">변경 후 한도: {currentLimit + amount}</p>
        </div>
      {/if}

      <!-- 사유 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="adjust-reason">사유</label>
        <input
          id="adjust-reason"
          type="text"
          placeholder="조정 사유 (선택)"
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
