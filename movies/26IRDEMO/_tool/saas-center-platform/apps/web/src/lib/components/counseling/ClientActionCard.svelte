<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import BadgeDropdown from '$lib/components/common/BadgeDropdown.svelte'
  import type { SessionParticipant } from '../../types/counseling'
  import { goto } from '$app/navigation'
  import { maskName } from '../../utils/maskingHandler'
  import WriteReportWithPencil from '$lib/assets/WriteReportWithPencil.svelte'
  import BillingActionButton from '$lib/features/billing/components/BillingActionButton.svelte'

  /** 참여자 출석 상태 (정책: scheduled=미확인, absent=불참, no_show=노쇼, 지각 제외) */
  const ATTENDANCE_OPTIONS: { value: string; label: string }[] = [
    { value: 'scheduled', label: '미확인' },
    { value: 'attended', label: '참석' },
    { value: 'absent', label: '불참' },
    { value: 'no_show', label: '노쇼' }
  ]

  const ATTENDANCE_BADGE_CLASS: Record<string, string> = {
    scheduled: 'bg-white border border-gray-200 text-gray-600',
    attended: 'bg-white border border-etc-green-yellow text-etc-green-yellow',
    absent: 'bg-white border border-etc-red text-etc-red',
    late: 'bg-white border border-yellow-400 text-yellow-700',
    excused: 'bg-white border border-blue-400 text-blue-700',
    no_show: 'bg-white border border-orange-300 text-orange-600'
  }

  interface Props {
    isSecretMode: boolean
    client: SessionParticipant
    journalDisabled?: boolean
    attendanceEditable?: boolean
    onWriteJournal?: (clientId: string) => void
    onAttendanceChange?: (sessionParticipantId: string, status: string) => void
    onEditNoShow?: (client: SessionParticipant) => void
    billingState?: 'none' | 'pending' | 'completed'
    billingSource?: 'case' | 'session'
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onCreateBilling?: () => void
    onViewBilling?: () => void
  }

  let {
    isSecretMode,
    client,
    journalDisabled = false,
    attendanceEditable = true,
    onWriteJournal,
    onAttendanceChange,
    onEditNoShow,
    billingState = 'none',
    billingSource,
    canWriteBilling = false,
    canReadBilling = false,
    onCreateBilling,
    onViewBilling
  }: Props = $props()

  let badgeClass = $derived(
    ATTENDANCE_BADGE_CLASS[client.attendance_status] ??
      'bg-gray-100 text-gray-600'
  )

  // 백엔드 규칙: 한번 참석/불참으로 기록한 후에는 '미확인'으로 되돌릴 수 없음
  // (attended_at 등 로그성 필드 정합성 유지 목적).
  // 따라서 현재 상태가 'scheduled'가 아니면 '미확인' 옵션을 드롭다운에서 제외한다.
  const dropdownOptions = $derived(
    client.attendance_status === 'scheduled'
      ? ATTENDANCE_OPTIONS
      : ATTENDANCE_OPTIONS.filter((opt) => opt.value !== 'scheduled')
  )

  function handleAttendanceChange(value: string) {
    if (value === client.attendance_status) return
    onAttendanceChange?.(client.session_participant_id, value)
  }

  // 일지 영역: 참석 계열(불참/노쇼 제외)
  const showJournal = $derived(
    client.attendance_status !== 'absent' &&
      client.attendance_status !== 'no_show'
  )

  // 청구 영역: 항상 노출. 발행 여부는 운영 정책(센터별 노쇼/불참 청구 정책)에 따라 직원이 결정.
</script>

<div
  class="flex min-w-0 flex-col justify-between rounded-lg border border-gray-200 p-4 xl:p-6"
>
  <!-- 상단 정보 영역 -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2 min-w-0">
      <button
        class="min-w-0 flex-1 text-left"
        title={isSecretMode
          ? maskName(client.participant_name)
          : client.participant_name}
        onclick={() => goto(`/clients/${client.participant_id}`)}
      >
        <Typography
          variant="headline-02-normal-semibold"
          color="text-gray-800"
          className="block truncate-safe underline underline-offset-4 decoration-1 decoration-gray-300 transition-colors hover:text-primary-500 hover:decoration-primary-500"
        >
          {isSecretMode
            ? maskName(client.participant_name)
            : client.participant_name}
        </Typography>
      </button>
      <div class="shrink-0">
        <BadgeDropdown
          options={dropdownOptions}
          value={client.attendance_status}
          onChange={handleAttendanceChange}
          editable={attendanceEditable}
          {badgeClass}
        />
      </div>
    </div>
    <!-- 콘텐츠 영역 -->
    {#if client.attendance_status === 'absent' || client.attendance_status === 'no_show'}
      <!-- 불참/노쇼: 사유 (노쇼는 차감 배지 + 편집 아이콘 함께) -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <Typography variant="body-02-normal-regular" color="text-gray-400">
            {client.attendance_status === 'no_show' ? '노쇼 사유' : '불참 사유'}
          </Typography>
          {#if client.attendance_status === 'no_show' && client.is_consumed}
            <span
              class="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-label-02-normal-medium text-orange-600"
            >
              회기 차감
            </span>
          {/if}
          {#if client.attendance_status === 'no_show' && attendanceEditable}
            <button
              type="button"
              class="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="노쇼 정보 수정"
              onclick={() => onEditNoShow?.(client)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                <path
                  d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"
                />
              </svg>
            </button>
          {/if}
        </div>
        <Typography variant="body-01-normal-regular" color="text-gray-600">
          {client.memo || '-'}
        </Typography>
      </div>
    {:else}
      <!-- 참석/미확인: 일지 미리보기 -->
      {#if client.has_note}
        <p class="text-sm text-gray-500">상담일지를 작성했어요</p>
      {:else}
        <p class="text-sm text-gray-400">상담일지를 작성해주세요</p>
      {/if}
    {/if}
  </div>
  <!-- 하단 버튼 영역: 일지(참석 계열만) + 청구(항상 노출) -->
  <div class="mt-4 flex items-stretch gap-2">
    {#if showJournal}
      {#if client.has_note || journalDisabled}
        <Button
          color="stroke-secondary"
          size="lg"
          class="flex-1 rounded-lg leading-tight text-center"
          onclick={() => onWriteJournal?.(client.participant_id)}
        >
          <Typography variant="body-01-normal-medium" color="text-gray-600">
            일지 보기
          </Typography>
        </Button>
      {:else}
        <Button
          color="stroke-primary"
          size="lg"
          class="flex-1 gap-2 rounded-lg leading-tight text-center"
          onclick={() => onWriteJournal?.(client.participant_id)}
        >
          <WriteReportWithPencil />
          <Typography variant="body-01-normal-medium" color="text-primary-500">
            일지 쓰기
          </Typography>
        </Button>
      {/if}
    {/if}
    <BillingActionButton
      state={billingState}
      source={billingSource}
      canWrite={canWriteBilling}
      canRead={canReadBilling}
      onCreate={() => onCreateBilling?.()}
      onView={() => onViewBilling?.()}
      size="md"
      className="flex-1"
    />
  </div>
</div>
