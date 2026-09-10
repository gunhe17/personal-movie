<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import { VALID_TRANSITIONS, STATUS_LABELS, STATUS_MAP, ALL_STATUSES } from '$lib/features/subscription/constants'

  interface Props {
    modalId?: string
    closeModal?: () => void
    currentStatus: string
    onConfirm?: (status: string, reason: string, force: boolean) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    currentStatus,
    onConfirm = () => {}
  }: Props = $props()

  let selectedStatus = $state('')
  let reason = $state('')
  let force = $state(false)

  const normalStatuses = $derived(VALID_TRANSITIONS[currentStatus] ?? [])
  const forceStatuses = $derived(ALL_STATUSES.filter(s => s !== currentStatus))
  const allowedStatuses = $derived(force ? forceStatuses : normalStatuses)

  // force 토글 시 선택 초기화 (일반→강제 전환 시 기존 선택이 유효하지 않을 수 있음)
  $effect(() => {
    force  // track
    selectedStatus = ''
  })
  const isValid = $derived(selectedStatus && reason.trim().length > 0)
  const currentLabel = $derived(STATUS_LABELS[currentStatus] ?? currentStatus)
  const currentStyle = $derived(STATUS_MAP[currentStatus])

  function handleConfirm() {
    if (!isValid) return
    onConfirm(selectedStatus, reason.trim(), force)
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
    <Typography variant="headline-02-semibold" color="text-gray-800">상태 변경</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-4">
      <!-- 현재 상태 -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">현재 상태:</span>
        {#if currentStyle}
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {currentStyle.bg} {currentStyle.text}">
            <span class="h-1.5 w-1.5 rounded-full {currentStyle.dot}"></span>
            {currentLabel}
          </span>
        {:else}
          <span class="text-sm font-medium text-gray-800">{currentLabel}</span>
        {/if}
      </div>

      <!-- pending 상태 안내 -->
      {#if currentStatus === 'pending'}
        <div class="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
          <p class="text-sm text-indigo-700">
            현재 플랜 변경 승인 대기 상태입니다. 구독 관리 페이지의 <span class="font-semibold">승인/거절</span> 버튼을 사용해 주세요.
          </p>
        </div>
      {/if}

      <!-- 전이할 상태 선택 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">변경할 상태</label>
        {#if allowedStatuses.length > 0}
          <div class="grid grid-cols-2 gap-2">
            {#each allowedStatuses as status}
              {@const style = STATUS_MAP[status]}
              <button
                type="button"
                class="rounded-lg border-2 p-3 text-left transition-colors
                  {selectedStatus === status ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  cursor-pointer"
                onclick={() => (selectedStatus = status)}
              >
                <div class="flex items-center gap-2">
                  {#if style}
                    <span class="h-2 w-2 rounded-full {style.dot}"></span>
                  {/if}
                  <span class="text-sm font-semibold text-gray-800">{STATUS_LABELS[status] ?? status}</span>
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-gray-400">현재 상태에서 전이 가능한 상태가 없습니다.</p>
        {/if}
      </div>

      <!-- 변경 사유 (필수) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="status-reason">
          변경 사유 <span class="text-red-500">*</span>
        </label>
        <input
          id="status-reason"
          type="text"
          placeholder="상태 변경 사유를 입력하세요"
          bind:value={reason}
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <!-- 강제 전이 -->
      <div class="rounded-lg border border-gray-200 p-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={force}
            class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          <div>
            <span class="text-sm font-medium text-gray-700">강제 전이</span>
            <p class="mt-0.5 text-xs text-gray-400">
              유효하지 않은 전이도 강제로 실행합니다. 관리자 권한이 필요하며 이력에 기록됩니다.
            </p>
          </div>
        </label>
      </div>

      {#if force}
        <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p class="text-sm text-red-700">
            강제 전이를 사용하면 정상 플로우를 우회합니다. 데이터 무결성에 영향을 줄 수 있으니 신중히 사용하세요.
          </p>
        </div>
      {/if}
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
      <Typography variant="title-01-semibold" color={isValid ? 'text-white' : 'text-gray-400'}>변경</Typography>
    </button>
  {/snippet}
</BaseModal>
