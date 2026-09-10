<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import UserIcon from '../../assets/UserIcon.svelte'

  interface Participant {
    client_id: string
    client_name: string
    attendance_status: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    participants: Participant[]
    billedClientIds?: string[]
    onConfirm: (selected: Participant[]) => void
    onViewBilling?: (clientId: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    participants,
    billedClientIds = [],
    onConfirm,
    onViewBilling
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  const billedSet = new Set(billedClientIds)
  // svelte-ignore state_referenced_locally
  const selectableParticipants = participants.filter(
    (p) => !billedSet.has(p.client_id)
  )

  // 출석 상태에 따라 기본 선택 (미청구 + 결석 아닌 참여자)
  let selectedIds = $state<Set<string>>(
    new Set(
      selectableParticipants
        .filter((p) => p.attendance_status !== 'absent')
        .map((p) => p.client_id)
    )
  )

  const ATTENDANCE_LABELS: Record<string, string> = {
    attended: '참석',
    absent: '결석',
    late: '지각',
    scheduled: '예정',
    no_show: '노쇼'
  }

  const ATTENDANCE_STYLES: Record<string, string> = {
    attended: 'bg-trans-bg-green-yellow text-etc-green-yellow',
    absent: 'bg-trans-bg-red text-etc-red',
    late: 'bg-trans-bg-orange text-etc-orange',
    scheduled: 'bg-trans-bg-gray text-etc-gray',
    no_show: 'bg-trans-bg-red text-etc-red'
  }

  const toggleParticipant = (clientId: string) => {
    if (billedSet.has(clientId)) return
    const next = new Set(selectedIds)
    if (next.has(clientId)) {
      next.delete(clientId)
    } else {
      next.add(clientId)
    }
    selectedIds = next
  }

  const toggleAll = () => {
    if (selectableParticipants.length === 0) return
    if (selectedIds.size === selectableParticipants.length) {
      selectedIds = new Set()
    } else {
      selectedIds = new Set(selectableParticipants.map((p) => p.client_id))
    }
  }

  const isAllSelected = $derived(
    selectableParticipants.length > 0 &&
      selectedIds.size === selectableParticipants.length
  )
  const selectedCount = $derived(selectedIds.size)

  const handleConfirm = () => {
    const selected = selectableParticipants.filter((p) =>
      selectedIds.has(p.client_id)
    )
    if (selected.length === 0) return
    onConfirm(selected)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="sm"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div>
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        참여자 청구 현황
      </Typography>
      <Typography
        variant="body-02-regular"
        color="text-gray-500"
        className="mt-1"
      >
        {selectableParticipants.length > 0
          ? '청구할 참여자를 선택하거나, 청구된 항목을 확인하세요'
          : '모든 참여자의 청구가 완료되었습니다'}
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7">
      <!-- 전체 선택 -->
      {#if selectableParticipants.length > 0}
        <button
          onclick={toggleAll}
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
        >
          <div
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition
              {isAllSelected
              ? 'border-primary-500 bg-primary-500'
              : 'border-gray-300'}"
          >
            {#if isAllSelected}
              <svg class="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {/if}
          </div>
          <Typography variant="body-01-normal-medium" color="text-gray-700">
            전체 선택 ({selectedCount}/{selectableParticipants.length})
          </Typography>
        </button>
      {/if}

      <div class="border-b border-gray-100 my-2"></div>

      <!-- 참여자 목록 -->
      <div class="space-y-1">
        {#each participants as participant (participant.client_id)}
          {@const isBilled = billedSet.has(participant.client_id)}
          {@const isSelected = selectedIds.has(participant.client_id)}
          {@const statusLabel =
            ATTENDANCE_LABELS[participant.attendance_status] ??
            participant.attendance_status}
          {@const statusStyle =
            ATTENDANCE_STYLES[participant.attendance_status] ??
            'bg-trans-bg-gray text-etc-gray'}
          {#if isBilled}
            <!-- 청구됨: 클릭 시 상세 보기 -->
            <button
              onclick={() => {
                if (onViewBilling) {
                  onViewBilling(participant.client_id)
                  closeModal()
                }
              }}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-gray-50"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"
              >
                <UserIcon class="h-4 w-4 text-gray-400" />
              </span>
              <Typography
                variant="title-01-normal-regular"
                color="text-gray-800"
                className="flex-1 text-left"
              >
                {participant.client_name}
              </Typography>
              <span
                class="inline-flex rounded-md border border-mint-200 bg-white px-2 py-1.25 text-xs font-medium text-mint-500"
              >
                청구됨
              </span>
              <svg
                class="h-4 w-4 text-gray-400 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          {:else}
            <!-- 미청구: 체크박스 선택 -->
            <button
              onclick={() => toggleParticipant(participant.client_id)}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-gray-50"
            >
              <div
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition
                  {isSelected
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-gray-300'}"
              >
                {#if isSelected}
                  <svg
                    class="h-3 w-3 text-white"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"
              >
                <UserIcon class="h-4 w-4 text-gray-400" />
              </span>
              <Typography
                variant="title-01-normal-regular"
                color="text-gray-800"
                className="flex-1 text-left"
              >
                {participant.client_name}
              </Typography>
              <span
                class="inline-flex rounded-md px-2 py-1.25 text-xs font-medium {statusStyle}"
              >
                {statusLabel}
              </span>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-end gap-2">
      <button
        onclick={closeModal}
        class="h-11 px-5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          {selectableParticipants.length > 0 ? '취소' : '닫기'}
        </Typography>
      </button>
      {#if selectableParticipants.length > 0}
        <button
          onclick={handleConfirm}
          disabled={selectedCount === 0}
          class="h-11 px-5 rounded-lg bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Typography variant="body-01-normal-medium" color="text-current">
            {selectedCount}명 청구
          </Typography>
        </button>
      {/if}
    </div>
  {/snippet}
</BaseModal>
