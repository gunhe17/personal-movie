<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import EditIcon from '../../assets/EditIcon.svelte'
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
    existingBillables: any[]
    isSessionFinished: boolean
    onEditClick?: (e: MouseEvent) => void
  }

  let {
    scheduleData,
    schedule,
    existingBillables,
    isSessionFinished,
    onEditClick
  }: Props = $props()

  // 레이블·순서는 칩 호버 팝오버와 통일 — 검사는 세트명(없으면 검사명 나열)이 프로그램 값
  const programName = $derived.by(() => {
    const session = scheduleData.sessions?.[0]
    if (session?.set_name) return session.set_name
    const names = (session?.assessments ?? []).map((a) => a.kor_name)
    return names.length ? names.join(', ') : schedule.program_name || '검사'
  })

  // 회기 차수 — 서버 title("AC0001 - 3회기")이 정본. session_number와 어긋나는
  // 데이터가 있어 title에서 먼저 뽑고, 없을 때만 session_number로 만든다.
  const roundLabel = $derived.by(() => {
    const matched = (scheduleData.title ?? '').match(/(\d+)\s*회기/)
    if (matched) return `${matched[1]}회기`
    const round = scheduleData.sessions?.[0]?.session_number
    return round ? `${round}회기` : ''
  })

  // 프로그램 = 검사명 + 회기 차수 (별도 '회기' 행 없이 한 줄로)
  const programLabel = $derived(
    roundLabel ? `${programName} - ${roundLabel}` : programName
  )
</script>

<div class="bg-gray-50 rounded-[12px] p-4 relative">
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
    <div class="grid grid-cols-[80px_1fr] gap-4">
      <Typography variant="body-01-normal-regular" color="text-gray-600"
        >담당자</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="pr-10"
      >
        {$isSecretMode
          ? maskName(schedule.manager || '-')
          : schedule.manager || '-'}
      </Typography>
    </div>
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
<div class="mt-5 grid grid-cols-[80px_1fr] gap-4 mb-4">
  <Typography variant="body-01-normal-regular" color="text-gray-600"
    >금액</Typography
  >
  <Typography variant="body-01-normal-regular" color="text-gray-600">
    {existingBillables?.length
      ? `총 ${existingBillables.reduce((sum: number, b: any) => sum + (b.total_amount ?? 0), 0).toLocaleString()}원`
      : '-'}
  </Typography>
</div>
<div class="grid grid-cols-[80px_1fr] gap-4">
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
