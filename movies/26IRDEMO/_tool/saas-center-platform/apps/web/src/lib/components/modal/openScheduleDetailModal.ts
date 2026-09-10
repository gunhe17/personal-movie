import type { QueryClient } from '@tanstack/svelte-query'
import type {
  MappedSchedule,
  ScheduleDetailResponse
} from '../../hooks/actions/schedule.action'
import { getScheduleDetail } from '../../hooks/actions/schedule.action'
import { modalStore } from '../../stores/modal'
import { requireCenterId } from '../../stores/center.store'
import { formatUtcToKst } from '../../utils/date'
import ScheduleDetailModal from './ScheduleDetailModal.svelte'

const OPEN_DELAY_MS = 300

function buildQueryArgs(scheduleId: string) {
  const centerId = requireCenterId()
  const action = getScheduleDetail()
  const params = { center_id: centerId, schedule_id: scheduleId }
  return {
    queryKey: [action.key![0], params] as const,
    queryFn: () => action.request(params)
  }
}

/**
 * 일정 상세 모달을 연다.
 *
 * 1) 캐시 히트 → 즉시 열기 (스켈레톤 없음)
 * 2) fetch가 150ms 안에 완료 → 데이터와 함께 열기 (스켈레톤 없음)
 * 3) 150ms 초과 → 스켈레톤으로 먼저 열기, 이후 데이터 도착 시 전환
 */
export function openScheduleDetailModal(
  schedule: MappedSchedule,
  queryClient: QueryClient,
  options?: { customWidth?: number; mode?: 'detail' | 'edit' }
) {
  const { queryKey, queryFn } = buildQueryArgs(schedule.id)
  // 수정 모드로 바로 여는 경우는 2단 폼이라 740단 (상세는 기존 600)
  const modalOptions = {
    customWidth:
      options?.customWidth ?? (options?.mode === 'edit' ? 740 : 600),
    desktopOnly: true
  }

  const doOpen = () => {
    modalStore.open({
      component: ScheduleDetailModal,
      props: { schedule, initialMode: options?.mode ?? 'detail' },
      options: modalOptions
    })
  }

  // 1) 캐시에 이미 있으면 즉시 열기
  const cached = queryClient.getQueryData(queryKey)
  if (cached) {
    doOpen()
    return
  }

  // 2) fetch 시작 + 타이머 경쟁
  let opened = false

  queryClient
    .fetchQuery({ queryKey, queryFn })
    .then(() => {
      if (!opened) {
        opened = true
        doOpen()
      }
    })
    .catch(() => {
      // fetch 실패해도 모달은 열기 (내부 queryBuilder가 재시도)
      if (!opened) {
        opened = true
        doOpen()
      }
    })

  setTimeout(() => {
    if (!opened) {
      opened = true
      doOpen()
    }
  }, OPEN_DELAY_MS)
}

/**
 * 일정 ID만으로 상세 모달을 연다 — 목록 행(MappedSchedule)이 손에 없는 경로용.
 *
 * 쓰임: 일정 수정 중 "새 내담자 추가"로 상담 정보 화면에 다녀온 뒤 원래 모달로 복귀.
 * 상세 응답을 받아 MappedSchedule 형태로 되돌린다(모달 내부는 대부분 상세 응답을
 * 다시 조회해 쓰고, MappedSchedule 은 id·상태·표시 fallback 용도로만 쓰인다).
 */
export async function openScheduleDetailModalById(
  scheduleId: string,
  queryClient: QueryClient,
  options?: { customWidth?: number; mode?: 'detail' | 'edit' }
) {
  const { queryKey, queryFn } = buildQueryArgs(scheduleId)
  const detail = (await queryClient.fetchQuery({
    queryKey,
    queryFn
  })) as ScheduleDetailResponse
  if (!detail) return

  const session = detail.sessions?.[0]
  const schedule: MappedSchedule = {
    id: detail.id,
    title: detail.title,
    client: (session?.clients ?? []).map((c) => c.client_name).join(', '),
    counselor_color: null,
    date: new Date(detail.start),
    start_at: formatUtcToKst(detail.start, 'HH:mm'),
    end_at: formatUtcToKst(detail.end, 'HH:mm'),
    start_at_origin: new Date(detail.start),
    end_at_origin: new Date(detail.end),
    manager: '',
    program_name: null,
    room: detail.room_name,
    schedule_type: detail.schedule_type,
    status: true,
    // 상세 응답에는 회기 상태가 없다. 복귀는 수정 모드로 열리므로 표시에 영향 없음
    // (상세로 뒤로 가면 배지가 '예정'으로 보인다 — 모달을 닫았다 다시 열면 정확해진다).
    session_status: null
  }

  openScheduleDetailModal(schedule, queryClient, options)
}
