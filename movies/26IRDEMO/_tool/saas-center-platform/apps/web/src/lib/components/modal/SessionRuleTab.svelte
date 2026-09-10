<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import {
    postValidateBatchSchedules,
    type BatchScheduleValidationResponse
  } from '../../hooks/actions/schedule.action'
  import { postAddSessionsToCase } from '../../hooks/actions/counseling.action'
  import type { CounselingCaseBaseDetail } from '../../types/counseling'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import { formatUtcToKst } from '../../utils/date'

  interface Props {
    counselingDetail: CounselingCaseBaseDetail
    roomList: RoomItemType[]
    centerId: string | null
    onClose: () => void
    canSubmit?: boolean
    isSubmitting?: boolean
    submitFn?: (() => Promise<void>) | null
  }

  let {
    counselingDetail,
    roomList,
    centerId,
    onClose,
    canSubmit = $bindable(false),
    isSubmitting = $bindable(false),
    submitFn = $bindable(null)
  }: Props = $props()

  let addCount = $state(1)
  let previewDates = $state<string[]>([])
  let previewLoading = $state(false)
  let previewConflicts = $state<BatchScheduleValidationResponse['conflicts']>(
    []
  )
  // 충돌 목록이 상한으로 잘렸는지 (일부만 보고 '모두 괜찮다' 오판 방지)
  let previewTruncatedCount = $state(0)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const existingSessionCount = counselingDetail.sessions?.length ?? 0
  const totalAfterAdd = $derived(existingSessionCount + addCount)
  const counselorName = counselingDetail.counselor_name ?? ''

  const ruleRoomName = $derived(() => {
    if (!counselingDetail.session_rule) return counselingDetail.room_name ?? ''
    const ruleRoomId = counselingDetail.session_rule.room_id
    const found = roomList.find((r) => r.id === ruleRoomId)
    return found?.name ?? counselingDetail.room_name ?? ''
  })

  /* ---------- 규칙 요약 ---------- */

  const DAY_LABELS: Record<string, string> = {
    monday: '월',
    tuesday: '화',
    wednesday: '수',
    thursday: '목',
    friday: '금',
    saturday: '토',
    sunday: '일',
    // 숫자 인덱스 (JS Date.getDay() 기준: 0=일)
    '0': '일',
    '1': '월',
    '2': '화',
    '3': '수',
    '4': '목',
    '5': '금',
    '6': '토'
  }

  function formatEndTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(':').map(Number)
    const totalMinutes = h * 60 + m + durationMinutes
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  const ruleSummary = $derived.by(() => {
    const rule = counselingDetail.session_rule
    if (!rule) return null

    const { pattern, interval, days_of_week } = rule.recurrence

    let recurrenceLabel = ''
    if (pattern === 'daily') {
      recurrenceLabel = interval === 1 ? '매일' : `${interval}일마다`
    } else if (pattern === 'weekly') {
      const days = (days_of_week ?? [])
        .map((d) => DAY_LABELS[d] ?? d)
        .join(', ')
      recurrenceLabel =
        interval === 1 ? `매주 ${days}` : `${interval}주마다 ${days}`
    } else if (pattern === 'monthly') {
      recurrenceLabel = interval === 1 ? '매월' : `${interval}개월마다`
    }

    const timeLabel = `${rule.start_time} ~ ${formatEndTime(rule.start_time, rule.duration_minutes)}`

    return { recurrenceLabel, timeLabel }
  })

  function getLastSessionDate(): string {
    const sessions = counselingDetail.sessions
    if (!sessions || sessions.length === 0) return ''
    const starts = sessions.map((s) => new Date(s.start).getTime())
    const maxTime = Math.max(...starts)
    const lastDate = new Date(maxTime)
    lastDate.setDate(lastDate.getDate() + 1)
    return lastDate.toISOString().slice(0, 10)
  }

  $effect(() => {
    if (!counselingDetail.session_rule || !centerId) return
    const count = addCount
    const center = centerId
    const rule = counselingDetail.session_rule!
    const nextDate = getLastSessionDate()
    if (!nextDate || count < 1) {
      previewDates = []
      previewTruncatedCount = 0
      return
    }

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      previewLoading = true
      try {
        const recurrence: Record<string, any> = {}
        for (const [k, v] of Object.entries(rule.recurrence)) {
          if (v !== null && v !== undefined) recurrence[k] = v
        }
        recurrence.count = count

        const result = await postValidateBatchSchedules().request({
          center_id: center,
          start_date: nextDate,
          start_time: rule.start_time,
          duration_minutes: rule.duration_minutes,
          room_id: rule.room_id,
          recurrence: recurrence as any
        })
        previewDates = result.schedule_dates
        previewConflicts = result.conflicts
        previewTruncatedCount = result.truncated
          ? (result.truncated_count ?? 0)
          : 0
      } catch {
        previewDates = []
        previewConflicts = []
        previewTruncatedCount = 0
      } finally {
        previewLoading = false
      }
    }, 300)
  })

  $effect(() => {
    canSubmit = previewDates.length > 0 && !previewLoading && !isSubmitting
  })

  async function handleSubmit() {
    if (!canSubmit || !centerId) return
    isSubmitting = true
    try {
      const result = await postAddSessionsToCase().request({
        centerId,
        caseId: counselingDetail.case_id,
        count: addCount
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

<!-- 반복 규칙 요약 -->
{#if ruleSummary}
  <div class="rounded-lg bg-gray-50 px-4 py-3 space-y-2">
    <Typography variant="body-02-normal-medium" color="text-title-subtitle">
      반복 규칙
    </Typography>
    <div class="flex items-center gap-1">
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        {ruleSummary.recurrenceLabel}
      </Typography>
      <div class="w-[1px] h-[10px] bg-gray-300 mx-1"></div>
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        {ruleSummary.timeLabel}
      </Typography>
      <div class="w-[1px] h-[10px] bg-gray-300 mx-1"></div>
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        {ruleRoomName()}
      </Typography>
      <div class="w-[1px] h-[10px] bg-gray-300 mx-1"></div>
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        {counselorName}
      </Typography>
    </div>
  </div>
{/if}

<!-- 추가 횟수 -->
<div class="space-y-2">
  <Typography variant="body-02-normal-medium" color="text-title-subtitle"
    >추가 횟수</Typography
  >
  <div class="flex items-center gap-2">
    <input
      type="number"
      min="1"
      max="50"
      bind:value={addCount}
      class="w-25 h-12 px-2.5 border border-gray-200 rounded-[12px] text-left
        text-body-01-normal-regular focus:border-border-active focus:outline-none"
    />
    <Typography variant="body-01-medium" color="text-gray-700">
      회 추가
    </Typography>
    <Typography variant="body-01-normal-medium" color="text-gray-500">
      &rarr;
    </Typography>
    <Typography variant="body-01-normal-medium" color="text-gray-700">
      총 <span
        class="text-primary-500 text-body-01-normal-regular font-semibold"
        >{totalAfterAdd}</span
      >회
    </Typography>
  </div>
</div>

<!-- 추가될 회기 목록 -->
<div>
  <Typography
    variant="body-02-normal-medium"
    color="text-title-subtitle"
    className="mb-2">추가될 회기</Typography
  >
  <Typography variant="body-02-regular" className="mb-3" color="text-gray-500">
    기존과 동일한 반복 규칙으로 추가돼요
  </Typography>

  {#if previewLoading}
    <div class="py-4 text-center">
      <Typography variant="body-01-normal-medium" color="text-gray-400">
        날짜 계산 중...
      </Typography>
    </div>
  {:else if previewDates.length > 0}
    {#if previewTruncatedCount > 0}
      <div class="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
        <span class="mt-0.5 shrink-0 text-amber-700" aria-hidden="true">!</span>
        <Typography variant="body-03-normal-regular" color="text-amber-700">
          충돌 정보가 많아 일부만 표시했어요 (외 {previewTruncatedCount}건 더).
          전체는 저장 후 일정에서 확인해 주세요.
        </Typography>
      </div>
    {/if}
    <div class="space-y-2 max-h-64 overflow-y-auto">
      {#each previewDates as dateStr, idx}
        {@const hasConflictItem = previewConflicts.some(
          (c) => c.session_number === idx + 1
        )}
        <div
          class="px-4 py-3 rounded-lg {hasConflictItem
            ? 'bg-status-danger-bg border border-red-200'
            : 'bg-gray-50'}"
        >
          <div class="flex items-center gap-1">
            <Typography
              variant="body-02-normal-regular"
              color={hasConflictItem ? 'text-red-600' : 'text-gray-700'}
            >
              {formatUtcToKst(dateStr, 'YYYY-MM-DD (d) HH:mm')}
            </Typography>
            <div class="w-[1px] h-[10px] bg-gray-300 mx-1"></div>
            <Typography variant="body-02-regular" color="text-gray-700">
              {counselorName}
            </Typography>
            <div class="w-[1px] h-[10px] bg-gray-300 mx-1"></div>
            <Typography variant="body-02-normal-regular" color="text-gray-700">
              {ruleRoomName()}
            </Typography>
          </div>
          {#if hasConflictItem}
            <Typography variant="body-02-regular" color="text-red-400">
              겹치는 일정이 있어요
            </Typography>
          {/if}
        </div>
      {/each}
    </div>
  {:else if addCount > 0}
    <div class="py-4 text-center">
      <Typography variant="body-01-normal-medium" color="text-gray-400">
        추가 횟수를 입력해주세요
      </Typography>
    </div>
  {/if}
</div>
