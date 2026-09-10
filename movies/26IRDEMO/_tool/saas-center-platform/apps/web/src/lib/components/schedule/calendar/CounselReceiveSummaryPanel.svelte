<style>
  @keyframes summary-error-flash {
    0% {
      background-color: transparent;
    }
    30% {
      background-color: rgb(254 242 242 / 0.6);
    }
    100% {
      background-color: transparent;
    }
  }
  :global(.counsel-summary-row-flash) {
    animation: summary-error-flash 0.8s ease-out;
  }

  @keyframes error-text-in {
    0% {
      opacity: 0;
      transform: translateY(-4px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  :global(.counsel-error-text-in) {
    animation: error-text-in 0.3s ease-out;
  }

  @keyframes btn-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    15% {
      transform: translateX(-3px);
    }
    30% {
      transform: translateX(3px);
    }
    45% {
      transform: translateX(-2px);
    }
    60% {
      transform: translateX(2px);
    }
    75% {
      transform: translateX(-1px);
    }
  }
  :global(.counsel-btn-shake) {
    animation: btn-shake 0.4s ease-out;
  }
</style>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import DoubleRightArrow24Icon from '$lib/assets/DoubleRightArrow24Icon.svelte'
  import type { ExtendedClient, GroupMember } from '$lib/stores/receiveForm'
  import type { Organization } from '$lib/types/organization'
  import type { ClientType } from '$lib/features/assessment/status/constants'
  import MemoBlueIcon24 from '$root/src/lib/assets/MemoBlueIcon24.svelte'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isTimeOutsideOperatingHours
  } from '$lib/features/schedule/operating-hours'
  import type { RoomItemType } from '$root/src/lib/hooks/actions/room.action'
  import type {
    ProgramListItem,
    ProgramType
  } from '$root/src/lib/hooks/actions/program.action'
  import type { MemberListItem } from '$root/src/lib/hooks/actions/member.action'

  interface Props {
    isOpen: boolean
    onToggle: () => void
    clientMemo: string
    onMemoChange: (value: string) => void
    clientType: ClientType
    selectedClients: ExtendedClient[]
    selectedOrganization: Organization | null
    groupMembers: GroupMember[]
    selectedDates?: Date[]
    selectedDate?: Date | null
    selectedProgram: ProgramListItem | null
    selectedProgramType: ProgramType | null
    selectedTime: string | null
    selectedEndTime?: string | null
    selectedRoom: RoomItemType | null
    selectedMember: MemberListItem[]
    isRecurrenceEnabled?: boolean
    recurrenceEndCount?: number
    operatingTimes?: OperatingTimeSummary[]
    // Footer props
    sendNotification: boolean
    canSubmit: boolean
    onToggleNotification: () => void
    onSubmit: () => void
    onCancel: () => void
    validationErrors?: Record<string, string>
  }

  let {
    isOpen,
    onToggle,
    clientMemo,
    onMemoChange,
    clientType,
    selectedClients,
    groupMembers,
    selectedDates = [],
    selectedDate,
    selectedTime,
    selectedEndTime,
    selectedProgram,
    selectedProgramType,
    selectedRoom,
    selectedMember,
    isRecurrenceEnabled = false,
    recurrenceEndCount = 1,
    operatingTimes = [],
    sendNotification,
    canSubmit,
    onToggleNotification,
    onSubmit,
    onCancel,
    validationErrors = {}
  }: Props = $props()

  // selectedDates가 있으면 첫 날짜 사용, 없으면 selectedDate 사용
  const effectiveDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : (selectedDate ?? null)
  )

  const sessionCount = $derived(
    selectedDates.length > 0
      ? selectedDates.length
      : isRecurrenceEnabled
        ? recurrenceEndCount
        : 1
  )

  const formattedDateTime = $derived(() => {
    if (!effectiveDate || !selectedTime) return '-'

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const [h, m] = selectedTime.split(':').map(Number)
    const period = h < 12 ? '오전' : '오후'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h

    const startStr = `${effectiveDate.getFullYear()}년 ${effectiveDate.getMonth() + 1}월 ${effectiveDate.getDate()}일 (${dayNames[effectiveDate.getDay()]}) ${period} ${hour12}시${m > 0 ? ` ${m}분` : ''}`
    if (!selectedEndTime) return startStr
    const [eh, em] = selectedEndTime.split(':').map(Number)
    const endPeriod = eh < 12 ? '오전' : '오후'
    const endHour12 = eh === 0 ? 12 : eh > 12 ? eh - 12 : eh
    const endStr = `${endPeriod} ${endHour12}시${em > 0 ? ` ${em}분` : ''}`
    return `${startStr} ~ ${endStr}`
  })

  const isOutsideOperatingHours = $derived(() => {
    if (!selectedTime || !effectiveDate) return false
    const dayHours = getOperatingHoursForDate(operatingTimes, effectiveDate)
    return isTimeOutsideOperatingHours(selectedTime, dayHours)
  })

  const clientDisplayName = $derived(() => {
    if (clientType === 'individual') {
      if (selectedClients.length === 0) return '-'
      return selectedClients.length > 1
        ? `${selectedClients[0].name} 외 ${selectedClients.length - 1}명`
        : selectedClients[0].name
    }
    if (groupMembers.length > 0) {
      return groupMembers.length > 1
        ? `${groupMembers[0].name} 외 ${groupMembers.length - 1}명`
        : groupMembers[0].name
    }
    return '-'
  })

  // 에러 flash 애니메이션
  let flashErrors = $state(false)
  let prevErrorKeys = $state('')

  $effect(() => {
    const keys = Object.keys(validationErrors).sort().join(',')
    if (keys && keys !== prevErrorKeys) {
      flashErrors = true
      prevErrorKeys = keys
      setTimeout(() => {
        flashErrors = false
      }, 600)
    } else if (!keys) {
      prevErrorKeys = ''
    }
  })
</script>

<!-- 데스크톱: 인라인 사이드 패널 (항상 열림), 모바일: 하단 액션바에서 처리 -->
<div
  class="hidden 2xl:flex h-full w-[548px] min-w-[300px] shrink flex-col rounded-lg border border-gray-200 bg-white"
>
  <!-- 메모 영역 (나머지 공간 전부) -->
  <div class="flex min-h-0 flex-1 flex-col px-6 pt-6">
    <div class="mb-3 flex items-center gap-1">
      <MemoBlueIcon24 />
      <Typography variant="title-01-semibold" color="text-gray-800"
        >메모</Typography
      >
    </div>
    <div class="relative min-h-0 flex-1">
      <textarea
        value={clientMemo}
        oninput={(e) => {
          const val = (e.target as HTMLTextAreaElement).value
          if (val.length <= 2000) onMemoChange(val)
        }}
        maxlength={2000}
        placeholder="해당 내담자에 필요한 메모나 문의내역을 남겨주세요."
        class="h-full w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:outline-none px-3 py-3.5"
      ></textarea>
      <span
        class="pointer-events-none absolute right-3 bottom-2.5 text-xs text-gray-300"
      >
        {clientMemo.length}/2000
      </span>
    </div>
  </div>

  <!-- 요약 + 버튼 영역 (하단 고정, 크기 고정) -->
  <div class="shrink-0 flex-col px-6 pb-6">
    <div class="pt-5">
      <Typography
        variant="title-01-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        아래 내용으로 접수할게요
      </Typography>

      <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div class="space-y-3.5">
          <div
            class="flex items-start rounded-lg px-2 py-1 -mx-2 transition-colors {validationErrors.program &&
            flashErrors
              ? 'counsel-summary-row-flash'
              : ''}"
          >
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              프로그램<span class="field-required">*</span>
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={validationErrors.program
                ? 'text-red-400'
                : selectedProgram
                  ? 'text-gray-700'
                  : 'text-gray-400'}
            >
              {#if validationErrors.program}
                <span class="counsel-error-text-in"
                  >{validationErrors.program}</span
                >
              {:else}
                {selectedProgram
                  ? `${selectedProgram.name} - ${selectedProgramType === 'GROUP' ? '그룹' : selectedProgramType === 'INDIVIDUAL' ? '개별' : ''}`
                  : '프로그램을 선택해주세요'}
              {/if}
            </Typography>
          </div>

          <div
            class="flex items-start rounded-lg px-2 py-1 -mx-2 transition-colors {validationErrors.client &&
            flashErrors
              ? 'counsel-summary-row-flash'
              : ''}"
          >
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              내담자<span class="field-required">*</span>
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={validationErrors.client
                ? 'text-red-400'
                : clientDisplayName() !== '-'
                  ? 'text-gray-700'
                  : 'text-gray-400'}
            >
              {#if validationErrors.client}
                <span class="counsel-error-text-in"
                  >{validationErrors.client}</span
                >
              {:else}
                {clientDisplayName() !== '-'
                  ? clientDisplayName()
                  : '내담자를 선택해주세요'}
              {/if}
            </Typography>
          </div>

          <div
            class="flex items-start rounded-lg px-2 py-1 -mx-2 transition-colors {validationErrors.counselor &&
            flashErrors
              ? 'counsel-summary-row-flash'
              : ''}"
          >
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              담당자<span class="field-required">*</span>
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={validationErrors.counselor
                ? 'text-red-400'
                : selectedMember.length > 0
                  ? 'text-gray-700'
                  : 'text-gray-400'}
            >
              {#if validationErrors.counselor}
                <span class="counsel-error-text-in"
                  >{validationErrors.counselor}</span
                >
              {:else}
                {selectedMember.length > 0
                  ? selectedMember.map((m) => m.person.name).join(', ')
                  : '담당자를 선택해주세요'}
              {/if}
            </Typography>
          </div>

          <div
            class="flex items-start rounded-lg px-2 py-1 -mx-2 transition-colors {validationErrors.room &&
            flashErrors
              ? 'counsel-summary-row-flash'
              : ''}"
          >
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              장소<span class="field-required">*</span>
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={validationErrors.room
                ? 'text-red-400'
                : selectedRoom
                  ? 'text-gray-700'
                  : 'text-gray-400'}
            >
              {#if validationErrors.room}
                <span class="counsel-error-text-in"
                  >{validationErrors.room}</span
                >
              {:else}
                {selectedRoom ? selectedRoom.name : '장소를 선택해주세요'}
              {/if}
            </Typography>
          </div>

          <div
            class="flex items-start rounded-lg px-2 py-1 -mx-2 transition-colors {validationErrors.schedule &&
            flashErrors
              ? 'counsel-summary-row-flash'
              : ''}"
          >
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              시작 일정<span class="field-required">*</span>
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={validationErrors.schedule
                ? 'text-red-400'
                : effectiveDate && selectedTime
                  ? 'text-gray-700'
                  : 'text-gray-400'}
            >
              {#if validationErrors.schedule}
                <span class="counsel-error-text-in"
                  >{validationErrors.schedule}</span
                >
              {:else}
                {effectiveDate && selectedTime
                  ? formattedDateTime()
                  : '상담 일정을 선택해주세요'}
              {/if}
            </Typography>
          </div>

          <div class="flex items-start">
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-600"
              className="w-20 shrink-0"
            >
              회기 수
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color={effectiveDate && selectedTime
                ? 'text-gray-700'
                : 'text-gray-400'}
            >
              {effectiveDate && selectedTime
                ? `${sessionCount}회`
                : '상담 일정을 선택해주세요'}
            </Typography>
          </div>
        </div>
      </div>

      {#if isOutsideOperatingHours()}
        <div class="mt-3 flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-5 w-5 shrink-0 text-semantic-notice"
          >
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clip-rule="evenodd"
            />
          </svg>
          <Typography variant="body-02-medium" color="text-semantic-notice">
            센터 운영시간 외 시간이에요
          </Typography>
        </div>
      {/if}
    </div>

    <!-- 버튼 (하단 고정) -->
    <div class="flex items-center gap-3 pt-4">
      <button
        type="button"
        onclick={onCancel}
        class="flex h-12 flex-1 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
      >
        <Typography variant="title-01-semibold" color="text-gray-600"
          >취소</Typography
        >
      </button>
      <button
        type="button"
        onclick={onSubmit}
        class="flex h-12 flex-1 items-center justify-center rounded-lg transition-colors bg-primary-500 text-white hover:bg-primary-600 {flashErrors
          ? 'counsel-btn-shake'
          : ''}"
      >
        <Typography variant="title-01-semibold" color="text-white">
          등록
        </Typography>
      </button>
    </div>
  </div>
</div>
