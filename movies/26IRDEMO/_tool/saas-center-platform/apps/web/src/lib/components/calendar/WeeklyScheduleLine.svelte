<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import Typography from '@common/components/Typography.svelte'
  import { formatUtcToKst, parseUtcToKstTime } from '../../utils/date'
  import { getColorFromString, hexToRgba } from '../../utils/colorConverter'
  import { portal } from '../../utils/positionPortal'
  import Center24Icon from '../../assets/Center24Icon.svelte'
  import Counsel24Icon from '../../assets/Counsel24Icon.svelte'
  import AssessmentStack from '../../assets/AssessmentStack.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { openScheduleDetailModal } from '../modal/openScheduleDetailModal'
  import type {
    MappedSchedule,
    ScheduleType
  } from '../../hooks/actions/schedule.action'
  import type { CalendarSchedule } from '$lib/features/schedule/calendar/change-requests'
  import { createReservationsService } from '$lib/features/schedule/reservations/reservations-service'
  import ScheduleChangeRequestModal from '$lib/components/schedule/reservations/ScheduleChangeRequestModal.svelte'
  import { modalStore } from '../../stores/modal'

  type Props = {
    schedule: CalendarSchedule
    hour: number
    index: number
    total: number
    gap?: number
    slotMinutes?: number
  }

  const {
    schedule,
    hour,
    index,
    total,
    gap = 4,
    slotMinutes = 60
  }: Props = $props()

  const queryClient = useQueryClient()

  const startTime = $derived(parseUtcToKstTime(schedule.start.toString()))
  const endTime = $derived(parseUtcToKstTime(schedule.end.toString()))
  const durationHours = $derived(
    endTime.hour - startTime.hour + (endTime.minute - startTime.minute) / 60
  )
  const slotRatio = $derived(60 / slotMinutes)
  const totalGaps = $derived((total - 1) * gap)
  const baseWidth = $derived(`calc((100% - 12px - ${totalGaps}px) / ${total})`)
  const baseLeft = $derived(
    `calc(((${index} * (100% - 12px - ${totalGaps}px)) / ${total}) + (${index} * ${gap}px) + 6px)`
  )
  const isOperational = $derived(schedule.schedule_type === 'meeting')
  const isCancelled = $derived(schedule.session_status === 'cancelled')
  // 블록 구성·텍스트 규격은 일간(ScheduleTimelineView)과 동일:
  // 2줄(내담자 | 프로그램 / 시간) · 15px regular. 블록이 짧으면 넘치는 부분은 잘린다.
  const baseColor = $derived(
    schedule.counselor_color ||
      getColorFromString(schedule.counselor_name || '')
  )
  // ── 내담자 앱 변경 요청 오버레이 ──
  // origin = 지금 자리(아직 유효한 일정) · ghost = 요청된 자리(점선)
  const changeRequest = $derived(schedule.changeRequest)
  const isGhost = $derived(schedule.changeRequestRole === 'ghost')
  const hasChangeConflict = $derived(!!schedule.changeRequestConflict)

  const bgColor = $derived(
    hexToRgba(isOperational ? '#8A949E' : baseColor, isCancelled ? 0.4 : 0.9)
  )
  // 고스트(요청된 자리)는 "아직 확정되지 않은 자리"라 면을 채우지 않는다 —
  // 옅은 틴트 + 점선 테두리 + 어두운 글자. 실선 블록과 한눈에 갈린다.
  // 요청 시각이 다른 일정과 겹치면 테두리를 danger로 바꿔 그 자리에서 알린다.
  // 선 자체는 확정 블록보다 약해야 한다(미확정 신호) — 원색 100%는 확정 블록보다
  // 더 튀어 시선을 먼저 가져갔다. 평상시 선은 **면(12%)보다 한 단만 진한 25%** —
  // 블록 윤곽만 잡아주고 그 이상 주장하지 않는다.
  // 충돌만 예외로 red-300 — 이건 '경고'라서 면과 같은 계열로 묻히면 안 된다.
  const ghostLineColor = $derived(
    hasChangeConflict ? 'var(--color-red-300)' : hexToRgba(baseColor, 0.25)
  )

  let scheduleLineRef = $state<HTMLElement>()
  let openScheduleSimpleInfo = $state<boolean>(false)

  // 팝오버 안에서 승인·반려를 누르려면 블록 → 팝오버로 **마우스가 건너갈 수 있어야** 한다.
  // 블록을 벗어나는 즉시 닫으면 4px 틈을 지나는 동안 카드가 사라져 버튼에 닿지 못한다.
  const POPOVER_CLOSE_DELAY = 120
  let popoverCloseTimer: ReturnType<typeof setTimeout> | null = null
  function cancelPopoverClose() {
    if (popoverCloseTimer) clearTimeout(popoverCloseTimer)
    popoverCloseTimer = null
  }
  function openPopover() {
    cancelPopoverClose()
    openScheduleSimpleInfo = true
  }
  function schedulePopoverClose() {
    cancelPopoverClose()
    popoverCloseTimer = setTimeout(() => {
      openScheduleSimpleInfo = false
      popoverCloseTimer = null
    }, POPOVER_CLOSE_DELAY)
  }

  // 한 줄 구성이라 이름을 다 넣지 않는다 — 그룹이면 대표 1명 + "외 N명"
  const clientLabel = $derived.by(() => {
    const names = schedule.client_names ?? []
    if (!names.length) return '-'
    const first = $isSecretMode ? maskName(names[0]) : names[0]
    return names.length > 1 ? `${first} 외 ${names.length - 1}명` : first
  })

  // 팝오버 타이틀 = 상담사가 일정을 구분하는 최소단위(내담자 이름). 운영 일정은 내담자가 없어 제목을 쓴다
  const popoverTitle = $derived.by(() => {
    if (isOperational) return schedule.title || '-'
    const names = schedule.client_names ?? []
    if (!names.length) return schedule.title || '-'
    return names.map((n) => ($isSecretMode ? maskName(n) : n)).join(', ')
  })

  const programLabel = $derived(
    schedule.program_name ||
      (schedule.schedule_type === 'assessment'
        ? '검사'
        : schedule.schedule_type === 'counseling'
          ? '상담'
          : '운영')
  )

  const mapSchedule = (cur: ScheduleType): MappedSchedule => ({
    id: cur.id,
    client: cur.client_names?.join(', ') ?? '',
    counselor_color: cur.counselor_color ?? null,
    manager: cur.counselor_name ?? null,
    date: cur.start,
    start_at: formatUtcToKst(cur.start, 'HH:mm'),
    start_at_origin: cur.start,
    end_at: formatUtcToKst(cur.end, 'HH:mm'),
    end_at_origin: cur.end,
    title: cur.title,
    program_name: cur.program_name ?? null,
    schedule_type: cur.schedule_type,
    room: cur.room_name,
    status: cur.has_conflict ?? false,
    session_status: cur.session_status ?? null
  })

  const reservationsService = createReservationsService({ queryClient })

  /**
   * 팝오버에서 바로 처리 — 대시보드 배너와 **같은 서비스**를 탄다(확인 다이얼로그·스낵바 포함).
   * 팝오버는 hover로만 떠 있으므로 먼저 닫는다.
   */
  async function runChangeRequestAction(action: 'approve' | 'reject') {
    if (!changeRequest) return
    cancelPopoverClose()
    openScheduleSimpleInfo = false
    if (action === 'approve')
      await reservationsService.approve(changeRequest.id)
    else await reservationsService.reject(changeRequest.id)
  }

  /** 변경 요청이 걸린 블록은 일정 상세가 아니라 요청 상세를 연다 —
      대시보드 배너와 **같은 모달·같은 서비스**로 수렴시켜 처리 표면을 늘리지 않는다 */
  const handleOpenScheduleDetail = (e: MouseEvent) => {
    e.stopPropagation()
    if (changeRequest) {
      modalStore.open({
        component: ScheduleChangeRequestModal,
        props: {
          request: changeRequest,
          onApprove: reservationsService.approve,
          onReject: reservationsService.reject
        }
      })
      return
    }
    openScheduleDetailModal(mapSchedule(schedule), queryClient)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={scheduleLineRef}
  onclick={(e) => handleOpenScheduleDetail(e)}
  onmouseenter={openPopover}
  onmouseleave={schedulePopoverClose}
  class="absolute rounded-lg z-10 flex items-start gap-2 px-2 py-1 cursor-pointer overflow-hidden {isGhost
    ? 'border border-dashed'
    : ''} {changeRequest && !isGhost
    ? 'outline outline-1 outline-white/70'
    : ''}"
  style:background-color={isGhost ? hexToRgba(baseColor, 0.12) : bgColor}
  style:border-color={isGhost ? ghostLineColor : undefined}
  style:outline-style={changeRequest && !isGhost ? 'dashed' : undefined}
  style:outline-offset={changeRequest && !isGhost ? '-3px' : undefined}
  style={twMerge(
    `top: calc(${((startTime.minute % slotMinutes) / slotMinutes) * 100}%);`,
    `height: calc(${durationHours > 0 ? durationHours * slotRatio * 100 : 100}%);`,
    `width: ${baseWidth};`,
    index === 0 ? 'left: 6px;' : '',
    index === total - 1 ? 'right: 6px;' : `left: ${baseLeft};`
  )}
>
  <!-- 아이콘은 별도 열 — 내담자 이름과 시간이 같은 좌측 기준선에 정렬된다 -->
  <span
    class="inline-flex shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 {isCancelled
      ? 'opacity-70'
      : ''}"
  >
    {#if schedule.schedule_type === 'assessment'}
      <AssessmentStack />
    {:else if schedule.schedule_type === 'counseling'}
      <Counsel24Icon />
    {:else}
      <Center24Icon />
    {/if}
  </span>
  <!-- 한 줄: 내담자 | 장소 (시간은 타임라인 위치가 말해준다) -->
  <span
    class="font-pretendard text-[14px] font-normal tracking-[-0.41px] min-w-0 truncate-safe {isGhost
      ? 'text-gray-800'
      : 'text-white'} {isCancelled ? 'line-through opacity-70' : ''}"
    style:line-height="1.25"
  >
    {#if isOperational}
      {schedule.title}
    {:else}
      {clientLabel}
    {/if}{#if schedule.room_name}<span
        class="mx-2 inline-block h-3 w-px align-middle {isGhost
          ? 'bg-gray-400'
          : 'bg-white/40'}"
      ></span>{schedule.room_name}{/if}
  </span>
</div>
{#if openScheduleSimpleInfo}
  <div
    use:portal={{
      anchor: scheduleLineRef,
      offset: 4,
      isFitWidth: false,
      zIndex: 50
    }}
    onmouseenter={cancelPopoverClose}
    onmouseleave={schedulePopoverClose}
    role="group"
    aria-label="일정 요약"
    class="popover-fade-in p-3 w-60 bg-white rounded-lg shadow-lg"
  >
    <!-- 타이틀 = 일정 구분 최소단위: 타입 아이콘 + 내담자 이름, 그 밑에 시간.
         단 변경 요청이 걸린 일정은 시간을 여기 두지 않는다 — 아래 요청 카드가
         '기존 → 요청'으로 이미 말해서 같은 값이 두 번 나온다. -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <span class="shrink-0">
          {#if schedule.schedule_type === 'meeting'}
            <Center24Icon />
          {:else if schedule.schedule_type === 'counseling'}
            <Counsel24Icon />
          {:else}
            <AssessmentStack />
          {/if}
        </span>
        <Typography variant="body-01-reading-semibold" className="min-w-0">
          {popoverTitle}
        </Typography>
      </div>
      {#if !changeRequest}
        <Typography variant="body-02-normal-medium" color="text-gray-800">
          {formatUtcToKst(schedule.start, 'HH:mm')} - {formatUtcToKst(
            schedule.end,
            'HH:mm'
          )}
        </Typography>
      {/if}
    </div>
    {#if changeRequest}
      <!-- 변경 요청 — 승인 판단에 필요한 최소 정보(기존 → 요청 · 사유 · 충돌).
           처리는 이 카드 하단의 반려·승인이 소유한다(대시보드 배너와 같은 서비스).
           면은 브랜드 틴트 배경 토큰(bg/brand-subtle) — 일정 변경 요청 모달과 같은 규격 -->
      <div class="mt-3 flex flex-col gap-2 rounded-lg bg-brand-subtle p-3">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          {isGhost ? '요청된 시간' : '변경 요청 중'}
        </Typography>
        <!-- 기존 → 요청. 좁은 팝오버라 한 줄로 눕히고, 화살표도 대시보드 배너와
             같은 가로 화살표(→)를 쓴다(세로 스택·듀오톤 아이콘은 모달 전용). -->
        <div class="flex items-center gap-2">
          <Typography variant="body-02-normal-regular" color="text-gray-500">
            {formatUtcToKst(changeRequest.current_start, 'MM.DD HH:mm')}
          </Typography>
          <Typography variant="body-02-normal-regular" color="text-body-subtle">
            →
          </Typography>
          <Typography variant="body-02-normal-medium" color="text-primary-500">
            {formatUtcToKst(changeRequest.requested_start, 'MM.DD HH:mm')}
          </Typography>
        </div>
        {#if changeRequest.reason}
          <Typography
            variant="body-02-reading-regular"
            color="text-gray-800"
            className="min-w-0"
          >
            {changeRequest.reason}
          </Typography>
        {/if}
        {#if hasChangeConflict}
          <Typography
            variant="body-03-normal-regular"
            color="text-status-danger"
          >
            요청한 시간에 다른 일정이 있어요
          </Typography>
        {/if}
      </div>
    {/if}
    <hr class="my-3 border-gray-100" />
    <!-- 레이블 + 데이터 (레이블 폭은 가장 넓은 값 기준 고정, 간격 12) -->
    <div class="space-y-3">
      <div class="flex gap-3">
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          className="w-16 shrink-0"
        >
          프로그램
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-800"
          className="min-w-0"
        >
          {programLabel}
        </Typography>
      </div>
      {#if !isOperational}
        <div class="flex gap-3">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="w-16 shrink-0"
          >
            담당자
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-800"
            className="min-w-0"
          >
            {#if schedule.counselor_names && schedule.counselor_names.length > 0}
              {schedule.counselor_names.join(', ')}
            {:else}
              {schedule.counselor_name}
            {/if}
          </Typography>
        </div>
      {/if}
      {#if schedule.room_name}
        <div class="flex gap-3">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="w-16 shrink-0"
          >
            장소
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-800"
            className="min-w-0"
          >
            {schedule.room_name}
          </Typography>
        </div>
      {/if}
    </div>
    {#if changeRequest}
      <!-- 처리 액션 — 카드를 벗어나지 않고 그 자리에서 끝낸다.
           순서·색은 대시보드 배너와 동일(부정 좌 · 확정 우, §popup 취소/확인과 같은 축) -->
      <hr class="my-3 border-gray-100" />
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation()
            runChangeRequestAction('reject')
          }}
          class="flex h-10 flex-1 items-center justify-center rounded-lg border border-red-200 text-body-02-normal-medium text-status-danger transition-colors hover:border-transparent hover:bg-status-danger-bg"
        >
          반려
        </button>
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation()
            runChangeRequestAction('approve')
          }}
          class="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary-500 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
        >
          승인
        </button>
      </div>
    {/if}
  </div>
{/if}
