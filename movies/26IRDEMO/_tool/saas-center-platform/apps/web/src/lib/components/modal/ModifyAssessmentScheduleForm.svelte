<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { browser } from '$app/environment'

  import Typography from '@common/components/Typography.svelte'
  import { formatUtcToKst } from '../../utils/date'
  import { queryBuilder } from '../../hooks/queries/builder'
  import { centerId, requireCenterId } from '../../stores/center.store'
  import type {
    MappedSchedule,
    ScheduleDetailResponse
  } from '../../hooks/actions/schedule.action'
  import {
    getCaseById,
    updateCase,
    type UpdateCasePayload
  } from '../../hooks/actions/case.action'
  import {
    getAssessmentSetList,
    type AssessmentSetItem
  } from '../../hooks/actions/assessmentSet.action'
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '../../hooks/actions/assessment.action'
  import {
    getMemberList,
    type MemberListItem
  } from '../../hooks/actions/member.action'
  import { getRoomList } from '../../hooks/actions/room.action'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import { modalUtils } from '../../stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import { useQueryClient } from '@tanstack/svelte-query'

  interface Props {
    schedule?: MappedSchedule
    scheduleData?: ScheduleDetailResponse
    canSubmit?: boolean
    isSubmitting?: boolean
    doSubmit?: () => void
    onSuccess?: () => void
  }

  let {
    schedule,
    scheduleData,
    canSubmit = $bindable(false),
    isSubmitting = $bindable(false),
    doSubmit = $bindable<() => void>(() => {}),
    onSuccess
  }: Props = $props()

  const queryClient = useQueryClient()

  /* ─────── 케이스 정보 ─────── */
  const caseId = $derived(scheduleData?.sessions?.[0]?.case_id ?? '')

  const caseQuery = $derived(
    caseId && $centerId
      ? queryBuilder(getCaseById, () => ({ centerId: $centerId!, caseId }))
      : null
  )
  const caseDetail = $derived(caseQuery?.data?.data ?? null)

  /* ─────── 검사 세트 ─────── */
  const setsQuery = $derived(
    $centerId
      ? queryBuilder(getAssessmentSetList, () => ({
          centerId: $centerId!,
          size: 100
        }))
      : null
  )
  const assessmentSets = $derived(
    (setsQuery?.data?.items ?? []) as AssessmentSetItem[]
  )

  /* ─────── 개별 검사 (활성만) ─────── */
  const assessmentsQuery = $derived(
    $centerId
      ? queryBuilder(getCenterAssessments, () => ({
          centerId: $centerId!,
          is_active: true
        }))
      : null
  )
  const centerAssessments = $derived(
    (assessmentsQuery?.data ?? []) as CenterAssessment[]
  )

  /* ─────── 담당자 ─────── */
  const membersQuery = $derived(
    $centerId
      ? queryBuilder(getMemberList, () => ({ centerId: $centerId!, size: 100 }))
      : null
  )
  const memberList = $derived(
    (membersQuery?.data?.items ?? []) as MemberListItem[]
  )

  /* ─────── 장소 ─────── */
  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomList = $derived(roomsQuery.data ?? [])
  const roomOptions = $derived(
    roomList.map((r: RoomItemType) => ({ value: r.id, label: r.name }))
  )
  const handleRoomSelect = (roomId: string) => {
    selectedRoom = roomList.find((r: RoomItemType) => r.id === roomId) ?? null
  }

  /* ─────── 칩 옵션 ─────── */
  const memberOptions = $derived(
    memberList.map((m) => ({ value: m.id, label: m.person.name }))
  )
  const assessmentOptions = $derived(
    centerAssessments.map((a) => ({
      value: a.assessment_id,
      label: a.kor_name
    }))
  )

  /* ─────── state ─────── */
  let selectedSetId = $state<string | null>(null)
  let selectedAssessmentIds = $state<string[]>([])
  let selectedCounselorId = $state<string>('')
  let selectedRoom = $state<RoomItemType | null>(null)
  let selectedDates = $state<Date[]>([])
  let startTime = $state('')
  let endTime = $state('')
  let memo = $state('')
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  /* ─────── 초기값 세팅 ─────── */
  let initialized = $state(false)

  $effect(() => {
    if (initialized || !caseDetail || !scheduleData || !roomList.length) return
    initialized = true

    // 검사 목록
    selectedAssessmentIds = caseDetail.tasks.map((t) => t.assessment_id)
    selectedSetId = caseDetail.set_id ?? null

    // 담당자
    selectedCounselorId = caseDetail.counselor.member_id

    // 장소
    if (scheduleData.room_id) {
      selectedRoom = roomList.find((r) => r.id === scheduleData.room_id) ?? null
    } else {
      selectedRoom = roomList.find((r) => r.name === schedule?.room) ?? null
    }

    // 일정
    const kstStart = formatUtcToKst(scheduleData.start, 'YYYY-MM-DDTHH:mm')
    selectedDates = [new Date(kstStart)]
    startTime = formatUtcToKst(scheduleData.start, 'HH:mm')
    endTime = formatUtcToKst(scheduleData.end, 'HH:mm')

    // 메모
    memo = scheduleData.memo ?? ''
  })

  /* ─────── 검사 세트 토글 ─────── */
  const handleToggleSet = (set: AssessmentSetItem) => {
    if (selectedSetId === set.id) {
      selectedSetId = null
      const setAssessmentIds = set.assessments.map((a) => a.id)
      selectedAssessmentIds = selectedAssessmentIds.filter(
        (id) => !setAssessmentIds.includes(id)
      )
    } else {
      selectedSetId = set.id
      const setAssessmentIds = set.assessments.map((a) => a.id)
      const merged = new Set([...selectedAssessmentIds, ...setAssessmentIds])
      selectedAssessmentIds = [...merged]
    }
  }

  /* ─────── 개별 검사 토글 ─────── */
  const handleToggleAssessment = (assessmentId: string) => {
    if (selectedAssessmentIds.includes(assessmentId)) {
      selectedAssessmentIds = selectedAssessmentIds.filter(
        (id) => id !== assessmentId
      )
    } else {
      selectedAssessmentIds = [...selectedAssessmentIds, assessmentId]
    }
  }

  /* ─────── 선택된 검사 요약 텍스트 ─────── */
  const selectedSummaryText = $derived.by(() => {
    const names = selectedAssessmentIds
      .map(
        (id) => centerAssessments.find((a) => a.assessment_id === id)?.kor_name
      )
      .filter(Boolean)
    if (names.length === 0) return ''
    return `${names.join(', ')} 검사가 선택되었어요`
  })

  /* ─────── 파생값 ─────── */
  const selectedDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : null
  )

  /* ─────── 변경 감지 ─────── */
  const isChanged = $derived.by(() => {
    if (!caseDetail || !scheduleData) return false

    const originalIds = caseDetail.tasks.map((t) => t.assessment_id).sort()
    const currentIds = [...selectedAssessmentIds].sort()
    const assessmentChanged =
      JSON.stringify(originalIds) !== JSON.stringify(currentIds)

    const setChanged = (caseDetail.set_id ?? null) !== selectedSetId
    const counselorChanged =
      caseDetail.counselor.member_id !== selectedCounselorId

    const originalStart = formatUtcToKst(scheduleData.start, 'YYYY-MM-DD HH:mm')
    const originalEnd = formatUtcToKst(scheduleData.end, 'HH:mm')
    const currentStart = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')} ${startTime}`
      : ''
    const dateChanged =
      originalStart !== currentStart || originalEnd !== endTime

    const originalRoomId = scheduleData.room_id ?? null
    const currentRoomId = selectedRoom?.id ?? null
    const roomChanged = originalRoomId !== currentRoomId

    const memoChanged = (scheduleData.memo ?? '') !== memo

    return (
      assessmentChanged ||
      setChanged ||
      counselorChanged ||
      dateChanged ||
      roomChanged ||
      memoChanged
    )
  })

  const computedCanSubmit = $derived(
    selectedAssessmentIds.length > 0 &&
      !!selectedCounselorId &&
      !!selectedDate &&
      !!startTime &&
      !!endTime &&
      isChanged
  )

  // Sync bindable
  $effect(() => {
    canSubmit = computedCanSubmit
  })

  /* ─────── submit ─────── */
  async function handleSubmit() {
    if (!computedCanSubmit || !caseDetail || !selectedDate || isSubmitting)
      return

    // 충돌 시 컨펌 모달 (reason별 문구 분기)
    if (conflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            '수정'
          ),
          confirmText: '수정'
        }
      )
      if (!confirmed) return
    }

    isSubmitting = true

    const newStart = new Date(selectedDate)
    const [sh, sm] = startTime.split(':')
    newStart.setHours(+sh, +sm, 0, 0)

    const newEnd = new Date(selectedDate)
    const [eh, em] = endTime.split(':')
    newEnd.setHours(+eh, +em, 0, 0)

    const payload: UpdateCasePayload = {
      assessment_ids: selectedAssessmentIds,
      set_id: selectedSetId,
      counselor_id: selectedCounselorId,
      schedule: {
        has_schedule: true,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
        room_id: selectedRoom?.id ?? null,
        memo
      }
    }

    try {
      await updateCase().request({
        centerId: requireCenterId(),
        caseId: caseDetail.case_id,
        payload,
        force: true
      })
      snackbarStore.success('검사 일정을 수정했어요')
      queryClient.invalidateQueries({
        queryKey: ['getScheduleDetail'],
        exact: false
      })
      queryClient.invalidateQueries({
        queryKey: ['getScheduleList'],
        exact: false
      })
      queryClient.invalidateQueries({ queryKey: ['getCaseById'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['getCases'], exact: false })
      onSuccess?.()
    } catch {
      snackbarStore.error('검사 일정 수정에 실패했어요')
    } finally {
      isSubmitting = false
    }
  }

  // Expose submit handler
  doSubmit = handleSubmit
</script>

<div class="space-y-6">
  {#if caseDetail}
    <!-- 검사 * -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        검사 <span class="field-required">*</span>
      </Typography>

      <div class="rounded-lg bg-gray-50 p-4">
        <!-- 검사 세트 -->
        {#if assessmentSets.length > 0}
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            검사 세트
          </Typography>
          <div class="flex flex-wrap gap-3">
            {#each assessmentSets as set}
              {@const isSelected = selectedSetId === set.id}
              <button
                type="button"
                onclick={() => handleToggleSet(set)}
                class={twMerge(
                  'w-[211px] max-w-full rounded-lg border px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                <Typography
                  variant="body-01-normal-medium"
                  color={isSelected ? 'text-primary-500' : 'text-gray-500'}
                >
                  {set.name}
                </Typography>
                <Typography
                  variant="body-01-reading-regular"
                  color={isSelected ? 'text-primary-500' : 'text-gray-500'}
                  className="mt-2 break-keep"
                >
                  {set.assessments.map((a) => a.kor_name).join(', ')}
                </Typography>
              </button>
            {/each}
          </div>
        {/if}

        <!-- 개별 검사 -->
        {#if centerAssessments.length > 0}
          {#if assessmentSets.length > 0}
            <hr class="border-gray-200 my-4" />
          {/if}
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            개별 검사
          </Typography>
          <SelectableButtonGroup
            label="개별 검사"
            options={assessmentOptions}
            selected={selectedAssessmentIds}
            multiple={true}
            onSelect={handleToggleAssessment}
            showLabel={false}
          />
        {/if}
      </div>

      <!-- 선택 요약 -->
      {#if selectedSummaryText}
        <p class="mt-3 text-body-03-normal-regular text-primary-500">
          {selectedSummaryText}
        </p>
      {/if}
    </div>

    <!-- 담당자 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        담당자
      </Typography>
      <SelectableButtonGroup
        label="담당자"
        options={memberOptions}
        selected={selectedCounselorId}
        onSelect={(value) => (selectedCounselorId = value)}
        showLabel={false}
      />
    </div>

    <!-- 장소 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        장소
      </Typography>
      <SelectableButtonGroup
        label="장소"
        options={roomOptions}
        selected={selectedRoom?.id ?? ''}
        onSelect={handleRoomSelect}
        showLabel={false}
      />
    </div>

    <!-- 일정 -->
    <MultiDateSchedulePicker
      bind:selectedDates
      bind:startTime
      bind:endTime
      bind:conflictRoomName
      bind:conflictReason
      centerId={$centerId}
      roomId={selectedRoom?.id}
      memberId={selectedCounselorId || null}
      excludeScheduleId={schedule?.id}
      showTitle={true}
      title="일정"
      singleDate={true}
      calendarSize="modal-large"
    />

    <!-- 메모 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        메모
      </Typography>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={memo}
        placeholder="메모 내용을 입력해주세요"
        class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
      />
    </div>
  {/if}
</div>
