<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BaseModal from './BaseModal.svelte'

  /**
   * 회기를 '취소'로 바꿀 때 내담자별 사유를 가른다.
   *
   * 회기 취소 ↔ 내담자 취소/노쇼가 짝이다 — 회기만 취소하고 내담자 상태를
   * 뭉뚱그리면 "미리 취소한 사람"과 "말없이 안 온 사람"이 같은 기록이 된다.
   * 기본값은 '취소'(사전 취소) — 노쇼는 귀책이 따르므로 고르는 쪽이 안전하다.
   */
  export type CancelAttendance = 'absent' | 'no_show'

  interface CancelTarget {
    session_participant_id: string
    participant_name: string
    /** 현재 출결 — 이미 노쇼면 그 값을 초기 선택으로 */
    attendance_status?: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    clients?: CancelTarget[]
    onConfirm?: (result: Record<string, CancelAttendance>) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    clients = [],
    onConfirm
  }: Props = $props()

  const OPTIONS: { value: CancelAttendance; label: string; desc: string }[] = [
    { value: 'absent', label: '취소', desc: '미리 알리고 오지 않음' },
    { value: 'no_show', label: '노쇼', desc: '연락 없이 오지 않음' }
  ]

  let selection = $state<Record<string, CancelAttendance>>(
    Object.fromEntries(
      clients.map((c) => [
        c.session_participant_id,
        c.attendance_status === 'no_show' ? 'no_show' : 'absent'
      ])
    )
  )

  function handleConfirm() {
    onConfirm?.({ ...selection })
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  size="fit"
  bodyClass="p-5 pb-7"
  headerClass="items-start px-5 py-4"
  showHeaderBorder={true}
  showFooterBorder={true}
>
  {#snippet header()}
    <!-- 2줄 헤더 — 타이틀↔부제 8 · 부제 Body_02/Regular gray-500 -->
    <div class="min-w-0 flex-1">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
        className="block"
      >
        내담자 상태를 확인해주세요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-500"
        className="mt-2 block"
      >
        취소된 회기의 내담자는 취소 또는 노쇼로 기록돼요.
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <!-- 내담자 행 = 이름 + 선택. 블록 사이 12(그룹 내부 간격) -->
    <div class="flex flex-col gap-3">
      {#each clients as client (client.session_participant_id)}
        <div class="rounded-xl bg-gray-50 p-4">
          <Typography
            variant="body-01-normal-semibold"
            color="text-gray-900"
            className="block truncate-safe"
          >
            {client.participant_name}
          </Typography>
          <div class="mt-3 flex gap-2">
            {#each OPTIONS as opt (opt.value)}
              {@const active =
                selection[client.session_participant_id] === opt.value}
              <button
                type="button"
                onclick={() =>
                  (selection = {
                    ...selection,
                    [client.session_participant_id]: opt.value
                  })}
                class="flex flex-1 flex-col items-start gap-1 rounded-lg border bg-white px-4 py-3 text-left transition-colors {active
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'}"
              >
                <span
                  class="text-body-02-normal-medium {active
                    ? 'text-primary-600'
                    : 'text-gray-700'}"
                >
                  {opt.label}
                </span>
                <span class="text-body-03-normal-regular text-gray-500">
                  {opt.desc}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- 버튼 44 · gap 12 · 우측 정렬 (정렬·간격·패딩은 BaseModal footer가 소유) -->
    <button
      type="button"
      onclick={closeModal}
      class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
    >
      닫기
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
    >
      회기 취소
    </button>
  {/snippet}
</BaseModal>
