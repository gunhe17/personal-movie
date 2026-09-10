<script lang="ts">
  import MemberMultiSelect from '../assessment/receive/MemberMultiSelect.svelte'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import { postAddSessionsToCase } from '../../hooks/actions/counseling.action'
  import type { CounselingCaseBaseDetail } from '../../types/counseling'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import type { MemberListItem } from '../../hooks/actions/member.action'

  interface Props {
    counselingDetail: CounselingCaseBaseDetail
    memberList: MemberListItem[]
    roomList: RoomItemType[]
    operatingTimes: any[]
    centerId: string | null
    onClose: () => void
    canSubmit?: boolean
    isSubmitting?: boolean
    submitFn?: (() => Promise<void>) | null
    selectedCount?: number
  }

  let {
    counselingDetail,
    memberList,
    roomList,
    operatingTimes,
    centerId,
    onClose,
    canSubmit = $bindable(false),
    isSubmitting = $bindable(false),
    submitFn = $bindable(null),
    selectedCount = $bindable(0)
  }: Props = $props()

  let selectedDates = $state<Date[]>([])
  let startTime = $state('10:00')
  let endTime = $state('11:00')
  let selectedRoomId = $state<string>('')
  let selectedCounselors = $state<MemberListItem[]>([])

  /* ---------- 초기값 세팅 ---------- */

  $effect(() => {
    if (
      memberList.length &&
      counselingDetail.counselor_id &&
      selectedCounselors.length === 0
    ) {
      const defaultCounselor = memberList.find(
        (m) => m.id === counselingDetail.counselor_id
      )
      if (defaultCounselor) {
        selectedCounselors = [defaultCounselor]
      }
    }
  })

  $effect(() => {
    if (roomList.length && counselingDetail.room_name && !selectedRoomId) {
      const found = roomList.find((r) => r.name === counselingDetail.room_name)
      if (found) selectedRoomId = found.id
    }
  })

  const roomOptions = $derived(
    roomList.map((r: RoomItemType) => ({ value: r.id, label: r.name }))
  )

  /* ---------- 부모 연동 (bindable) ---------- */

  $effect(() => {
    canSubmit =
      selectedDates.length > 0 && !!startTime && !!endTime && !isSubmitting
  })

  $effect(() => {
    selectedCount = selectedDates.length
  })

  async function handleSubmit() {
    if (!canSubmit || !centerId) return
    isSubmitting = true
    try {
      const dates = selectedDates.map((d) => {
        const [sh, sm] = startTime.split(':')
        const dt = new Date(d)
        dt.setHours(+sh, +sm, 0, 0)
        return dt.toISOString()
      })
      const result = await postAddSessionsToCase().request({
        centerId,
        caseId: counselingDetail.case_id,
        dates,
        start_time: startTime,
        end_time: endTime,
        room_id: selectedRoomId || undefined,
        counselor_ids: selectedCounselors.map((m) => m.id)
      })
      const warningCount = result.warnings?.length ?? 0
      if (warningCount > 0) {
        snackbarStore.success(
          `${result.created_count}개 회기가 생성되었습니다 (충돌 ${warningCount}건)`
        )
      } else {
        snackbarStore.success(`${result.created_count}개 회기가 생성되었습니다`)
      }
      onClose()
    } catch {
      snackbarStore.error('회기 생성에 실패했습니다')
      isSubmitting = false
    }
  }

  $effect(() => {
    submitFn = handleSubmit
  })
</script>

<!-- 담당자 -->
<MemberMultiSelect
  options={memberList}
  bind:selected={selectedCounselors}
  label="담당자"
/>

<!-- 장소 -->
{#if roomOptions.length > 0}
  <SelectableButtonGroup
    label="장소"
    options={roomOptions}
    selected={selectedRoomId}
    onSelect={(value) => (selectedRoomId = value)}
  />
{/if}

<!-- 일정 -->
<MultiDateSchedulePicker
  bind:selectedDates
  bind:startTime
  bind:endTime
  {operatingTimes}
  {centerId}
  roomId={selectedRoomId || null}
  memberId={selectedCounselors[0]?.id ?? null}
  calendarSize="modal-large"
/>
