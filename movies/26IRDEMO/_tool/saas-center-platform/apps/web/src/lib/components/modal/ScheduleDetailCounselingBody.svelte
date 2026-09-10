<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import EditIcon from '../../assets/EditIcon.svelte'
  import CrownActiveYellowIcon20 from '$lib/assets/CrownActiveYellowIcon20.svelte'
  import { formatUtcToKst, diffMinutes } from '../../utils/date'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import type {
    ScheduleDetailResponse,
    MappedSchedule
  } from '../../hooks/actions/schedule.action'

  interface Props {
    scheduleData: ScheduleDetailResponse
    schedule: MappedSchedule
    existingBillables?: any[]
    isSessionFinished: boolean
    onEditClick?: (e: MouseEvent) => void
  }

  let { scheduleData, schedule, isSessionFinished, onEditClick }: Props =
    $props()

  // 담당자 표시: 세션의 counselors 리스트 (그룹 상담 다중 지원).
  // 대표는 schedule.member_id (= scheduleData.member_id) 기준으로 판단하며
  // 목록 맨 앞에 배치하고 "대표" 뱃지를 함께 표시한다.
  // 비어있으면 하위 호환으로 schedule.manager (대표 1명) 표시.
  interface CounselorItem {
    id: string
    name: string
    isPrimary: boolean
  }
  const counselorItems = $derived.by<CounselorItem[]>(() => {
    const sessionCounselors = scheduleData?.sessions?.[0]?.counselors ?? []
    if (sessionCounselors.length > 0) {
      const primaryId = scheduleData.member_id
      const items: CounselorItem[] = sessionCounselors.map((c) => ({
        id: c.counselor_id,
        name: c.counselor_name,
        isPrimary: c.counselor_id === primaryId
      }))
      // 대표 먼저, 나머지는 원래 순서 유지
      return items.sort((a, b) => {
        if (a.isPrimary === b.isPrimary) return 0
        return a.isPrimary ? -1 : 1
      })
    }
    return schedule.manager
      ? [{ id: '', name: schedule.manager, isPrimary: true }]
      : []
  })

  // 레이블·순서는 칩 호버 팝오버와 통일 — 프로그램은 운영 일정이면 '운영'으로 대체
  const programName = $derived(
    schedule.program_name ||
      (scheduleData.schedule_type === 'counseling' ? '상담' : '운영')
  )

  // 회기 차수 — 서버 title("C00006 - 1회기")이 정본. session_number와 어긋나는
  // 데이터가 있어 title에서 먼저 뽑고, 없을 때만 session_number로 만든다.
  const roundLabel = $derived.by(() => {
    const matched = (scheduleData.title ?? '').match(/(\d+)\s*회기/)
    if (matched) return `${matched[1]}회기`
    const round = scheduleData.sessions?.[0]?.session_number
    return round ? `${round}회기` : ''
  })

  // 프로그램 = 프로그램명 + 회기 차수 (별도 '회기' 행 없이 한 줄로)
  const programLabel = $derived(
    roundLabel ? `${programName} - ${roundLabel}` : programName
  )
</script>

<!-- bg-gray-50 영역: 일정, 프로그램, 담당자, 장소, 회기 (레이블·순서는 칩 호버 팝오버와 통일) -->
<div class="bg-gray-50 rounded-lg p-4 relative">
  <div class="space-y-3">
    <div class="grid grid-cols-[80px_1fr] gap-4">
      <Typography variant="body-01-normal-regular" color="text-gray-600"
        >일정</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="pr-20"
      >
        {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD(d) HH:mm')} ~ {formatUtcToKst(
          scheduleData.end,
          'HH:mm'
        )} ({Math.abs(
          diffMinutes(
            new Date(scheduleData.end),
            new Date(scheduleData.start)
          ) || 0
        )}분)
      </Typography>
    </div>
    <div class="grid grid-cols-[80px_1fr] gap-4">
      <Typography variant="body-01-normal-regular" color="text-gray-600"
        >프로그램</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="pr-10"
      >
        {programLabel}
      </Typography>
    </div>
    {#if scheduleData.schedule_type !== 'meeting'}
      <div class="grid grid-cols-[80px_1fr] gap-4 items-start">
        <Typography variant="body-01-normal-regular" color="text-gray-600"
          >담당자</Typography
        >
        {#if counselorItems.length === 0}
          <Typography variant="body-01-normal-regular" color="text-gray-800">
            -
          </Typography>
        {:else}
          <!-- 2명 이상일 때만 주담당을 왕관으로 구분 (1명이면 구분할 대상이 없다) -->
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 pr-10">
            {#each counselorItems as item, idx}
              <div class="flex items-center gap-1">
                {#if item.isPrimary && counselorItems.length > 1}
                  <CrownActiveYellowIcon20 />
                {/if}
                <Typography
                  variant="body-01-normal-regular"
                  color="text-gray-800"
                >
                  {$isSecretMode ? maskName(item.name) : item.name}
                </Typography>
                {#if idx < counselorItems.length - 1}
                  <span class="ml-1 text-gray-300">·</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <div class="grid grid-cols-[80px_1fr] gap-4">
      <Typography variant="body-01-normal-regular" color="text-gray-600"
        >장소</Typography
      >
      <Typography variant="body-01-normal-regular" color="text-gray-800">
        {scheduleData.room_name || '-'}
      </Typography>
    </div>
  </div>
  {#if !isSessionFinished && onEditClick}
    <button
      onclick={onEditClick}
      aria-label="수정"
      class="absolute top-3 right-3 flex-center items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
    >
      <EditIcon />
      <span class="text-body-02-normal-medium">수정</span>
    </button>
  {/if}
</div>

<!-- bg-gray-50 아래: 메모 (프로그램은 위 영역으로 이동 — 팝오버와 순서 통일) -->
<div class="mt-5 grid grid-cols-[80px_1fr] gap-4">
  <Typography variant="body-01-normal-regular" color="text-gray-600"
    >메모</Typography
  >
  <Typography variant="body-01-normal-regular" color="text-gray-600">
    {scheduleData.memo || '-'}
  </Typography>
</div>
{#if scheduleData.sessions?.[0]?.cancel_reason}
  <div class="mt-5 grid grid-cols-[80px_1fr] gap-4">
    <Typography variant="body-01-normal-regular" color="text-gray-600"
      >취소 사유</Typography
    >
    <Typography variant="body-01-normal-regular" color="text-status-danger">
      {scheduleData.sessions[0].cancel_reason}
    </Typography>
  </div>
{/if}
