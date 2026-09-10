<script lang="ts">
  /**
   * 대시보드 — 피그마 "SaaS V.2 통합" node 10643:182470 시안 구현.
   * 구성: 히어로(날짜·인사·오늘 일정 수) → 타임라인 스크러버 + 오늘 일정 캐러셀 → 처리할 일.
   */
  import { useQueryClient } from '@tanstack/svelte-query'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getNoticeList } from '$lib/hooks/actions/notice.action'
  import { getTodayMissingBillables } from '$lib/hooks/actions/billable.action'
  import {
    getCounselingsByCenterId,
    getUnprocessedSessions,
    getMyCounselingNotes,
    type MyCounselingNoteItem
  } from '$lib/hooks/actions/counseling.action'
  import { computeNextSession } from '$lib/features/counseling/status/view-model'
  import {
    getScheduleList,
    getScheduleChangeRequests,
    type MappedSchedule,
    type ScheduleType,
    type ScheduleChangeRequestItem
  } from '$lib/hooks/actions/schedule.action'
  import { createReservationsService } from '$lib/features/schedule/reservations/reservations-service'
  import ScheduleChangeRequestModal from '$lib/components/schedule/reservations/ScheduleChangeRequestModal.svelte'
  import { createBillableService } from '$lib/features/billing/billable-service'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import { openScheduleDetailModal } from '$lib/components/modal/openScheduleDetailModal'
  import { centerId } from '$lib/stores/center.store'
  import { auth } from '$lib/stores/auth'
  import { permissionStore } from '$lib/stores/permission.store'
  import { formatUtcToKst, parseAsUtc } from '$lib/utils/date'

  import Typography from '@common/components/Typography.svelte'
  import EmptyScheduleIllust240 from '$lib/assets/EmptyScheduleIllust240.svelte'
  import TodayScheduleCarousel, {
    type CarouselItem
  } from '$lib/components/dashboard/TodayScheduleCarousel.svelte'
  import TodayScheduleCarouselSkeleton from '$lib/components/dashboard/TodayScheduleCarouselSkeleton.svelte'
  import LoadingSwap from '$lib/components/common/LoadingSwap.svelte'
  import TaskSummarySection, {
    type TaskSummaryItem
  } from '$lib/components/dashboard/TaskSummarySection.svelte'
  import PendingActionBanner, {
    type PendingActionItem
  } from '$lib/components/dashboard/PendingActionBanner.svelte'
  import TaskDrilldownModal, {
    type TaskCategory
  } from '$lib/components/dashboard/TaskDrilldownModal.svelte'
  import { createDashboardSessionActions } from '$lib/features/dashboard/session-actions-service'
  import { modalStore } from '$lib/stores/modal'
  import ambientGlow from '$lib/assets/dashboard/ambient-glow.svg'

  const queryClient = useQueryClient()

  // ── 사용자 / 역할 ──
  const isManager = $derived($permissionStore.context?.accessLevel === 'all')
  const userName = $derived($auth.user?.name ?? '')

  // ── 인사 / 시각 ──
  const now = new Date()
  const greeting = (() => {
    const h = now.getHours()
    if (h >= 5 && h < 12) return '좋은 아침이에요'
    if (h < 18) return '좋은 오후예요'
    return '오늘도 수고 많으셨어요'
  })()
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${DAYS[now.getDay()]})`
  const nowHour = now.getHours() + now.getMinutes() / 60

  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const todayStr = ymd(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = ymd(tomorrow)
  // 스케줄 API의 end 는 배타적 경계(그 날 00:00 미포함)라 "오늘+내일"은 end=모레 로 조회.
  // 내일치를 함께 받는 이유: 하루 전 리마인드를 알림 목록에 쌓지 않고(지나면 무의미해지는
  // 고지라 로그 가치가 없다) 여기서 "내일 N건"으로 보여주기 때문 —
  // 쿼리를 하나 더 늘리지 않고 조회 범위만 하루 넓힌다.
  const dayAfter = new Date(now)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterStr = ymd(dayAfter)

  // ── 쿼리 ──
  const scheduleQuery = queryBuilder(
    getScheduleList,
    () => ({
      center_id: $centerId ?? '',
      start_date: todayStr,
      end_date: dayAfterStr,
      counselor_ids: [],
      client_ids: [],
      schedule_types: ['counseling', 'assessment']
    }),
    () => ({ enabled: !!$centerId })
  )
  const noticesQuery = queryBuilder(
    getNoticeList,
    () => ({ center_id: $centerId ?? undefined, size: 10 }),
    () => ({ enabled: !!$centerId })
  )
  // 내담자 앱에서 올라온 일정 변경 요청 — 대기 중인 것만 (센터 단위, 예약 현황과 같은 소스)
  const changeRequestsQuery = queryBuilder(
    getScheduleChangeRequests,
    () => ({ center_id: $centerId ?? '', status: 'pending' as const }),
    () => ({ enabled: !!$centerId })
  )
  // 미작성 일지 — 완료된 회기 중 상담일지가 없는 것 (상담일지 화면의 '미작성' 탭과 같은 소스)
  const missingNotesQuery = queryBuilder(
    getMyCounselingNotes,
    () => ({
      centerId: $centerId ?? '',
      status: 'missing' as const,
      skip: 0,
      limit: 50
    }),
    () => ({ enabled: !!$centerId })
  )
  // 미청구: 오늘까지 진행됐지만 청구 안 된 회기/검사 (manager 전용 운영 신호)
  const missingBillablesQuery = queryBuilder(
    getTodayMissingBillables,
    () => ({ centerId: $centerId }),
    () => ({ enabled: !!$centerId && isManager })
  )
  // 미처리 회기 — 예약 시각이 지났는데 정리 안 된 회기 (대시보드 시그널 전용 엔드포인트)
  const unprocessedQuery = queryBuilder(
    getUnprocessedSessions,
    () => ({ centerId: $centerId, size: 50 }),
    () => ({ enabled: !!$centerId })
  )
  // 진행 중 사례 — 연장·종결 판정용
  const activeCasesQuery = queryBuilder(
    getCounselingsByCenterId,
    () => ({
      centerId: $centerId ?? '',
      // size는 백엔드 상한 100. 브리핑은 상위 100개 진행 사례 기준
      queryParams: {
        status: 'active',
        size: 100,
        page: 1,
        sort: 'desc' as const
      }
    }),
    () => ({ enabled: !!$centerId })
  )

  // ── 로딩 게이트 ──
  // 쿼리가 일곱이라 도착하는 대로 그리면 화면이 조각조각 튀어 오른다(건수가 0에서 뛰고,
  // 일정 없는 날 문구가 잠깐 떴다 사라진다) → 전부 도착한 뒤 스켈레톤을 한 번에 걷는다.
  // 걷는 순간의 높이 차(캐러셀은 일정 수·카드 상태에 따라 높이가 달라지고 0건이면 통째로
  // 빠진다)는 LoadingSwap이 높이 전환으로 흡수한다 — 미리 맞출 수 없는 치수라서다.
  // enabled=false인 쿼리는 isLoading이 false다 — 권한이 없어 아예 안 부르는 미청구 쿼리에
  // 걸려 스켈레톤이 안 걷히는 일은 없다.
  // 한 번 걷힌 뒤에는 되돌리지 않는다(백그라운드 갱신·권한 늦게 도착 때 다시 깜빡이지 않게).
  let revealed = $state(false)
  const isLoading = $derived(
    !$centerId ||
      scheduleQuery.isLoading ||
      noticesQuery.isLoading ||
      changeRequestsQuery.isLoading ||
      missingNotesQuery.isLoading ||
      missingBillablesQuery.isLoading ||
      unprocessedQuery.isLoading ||
      activeCasesQuery.isLoading
  )
  $effect(() => {
    if (!isLoading) revealed = true
  })
  const showSkeleton = $derived(!revealed)

  // ── 오늘 / 내일 일정 ──
  // 쿼리가 이틀치를 받으므로 시작일(KST) 기준으로 가른다
  const scheduleDays = $derived.by(() => {
    const rows = ((scheduleQuery.data ?? []) as ScheduleType[])
      .filter(
        (s) =>
          s.schedule_type === 'counseling' || s.schedule_type === 'assessment'
      )
      .sort(
        (a, b) => parseAsUtc(a.start).getTime() - parseAsUtc(b.start).getTime()
      )
    return {
      today: rows.filter((s) => ymd(parseAsUtc(s.start)) === todayStr),
      tomorrow: rows.filter((s) => ymd(parseAsUtc(s.start)) === tomorrowStr)
    }
  })
  const todaySchedules = $derived(scheduleDays.today)
  const tomorrowCount = $derived(scheduleDays.tomorrow.length)

  const clientLabel = (s: ScheduleType) =>
    s.client_names.length === 0
      ? '내담자 미지정'
      : s.client_names.length === 1
        ? s.client_names[0]
        : `${s.client_names[0]} 외 ${s.client_names.length - 1}명`

  // 서버가 내려주는 session_status가 없거나 '예정'이어도, 지금 시각이 회기 구간이면 진행 중으로 본다
  const ENDED = ['completed', 'cancelled', 'no_show']
  function cardStatus(s: ScheduleType): CarouselItem['status'] {
    const st = s.session_status ?? ''
    if (ENDED.includes(st)) return st as CarouselItem['status']
    const t = now.getTime()
    const start = parseAsUtc(s.start).getTime()
    const end = parseAsUtc(s.end).getTime()
    return t >= start && t < end ? 'in_progress' : 'scheduled'
  }

  // 지난 시각인데 완료·취소 정리가 안 된 상담 회기 → 카드에서 바로 정리한다
  // (검사 일정은 완료/취소 API 계약이 달라 대상에서 제외)
  function isPendingConfirm(s: ScheduleType) {
    if (s.schedule_type !== 'counseling') return false
    if (ENDED.includes(s.session_status ?? '')) return false
    return parseAsUtc(s.end).getTime() < now.getTime()
  }

  const carouselItems = $derived.by((): CarouselItem[] =>
    todaySchedules.map((s) => {
      const start = parseAsUtc(s.start)
      const client = s.clients[0] ?? null
      return {
        id: s.id,
        hour: start.getHours() + start.getMinutes() / 60,
        time: formatUtcToKst(s.start, 'HH:mm'),
        name: clientLabel(s),
        birthDate: client?.birth_date ?? null,
        gender: client?.gender ?? null,
        roomName: s.room_name || null,
        programName: s.program_name || null,
        scheduleType: s.schedule_type ?? null,
        status: cardStatus(s),
        pendingConfirm: isPendingConfirm(s)
      }
    })
  )

  // 진행 중 회기 > 아직 시작 전인 첫 회기 > (모두 지났으면) 마지막 회기
  const initialIndex = $derived.by(() => {
    const t = now.getTime()
    const running = todaySchedules.findIndex((s) => {
      const st = parseAsUtc(s.start).getTime()
      const en = parseAsUtc(s.end).getTime()
      return t >= st && t < en
    })
    if (running >= 0) return running
    const next = todaySchedules.findIndex(
      (s) => parseAsUtc(s.start).getTime() >= t
    )
    return next >= 0 ? next : Math.max(0, todaySchedules.length - 1)
  })

  function toMappedSchedule(s: ScheduleType): MappedSchedule {
    return {
      client: s.client_names?.join(', ') ?? '',
      counselor_color: s.counselor_color ?? null,
      manager: s.counselor_name ?? '',
      date: s.start,
      start_at: formatUtcToKst(s.start, 'HH:mm'),
      start_at_origin: s.start,
      end_at: formatUtcToKst(s.end, 'HH:mm'),
      end_at_origin: s.end,
      id: s.id,
      title: s.title,
      program_name: s.program_name ?? null,
      room: s.room_name,
      schedule_type: s.schedule_type,
      status: s.has_conflict ?? false,
      session_status: s.session_status ?? null
    }
  }

  function openDetail(item: CarouselItem) {
    const target = todaySchedules.find((s) => s.id === item.id)
    if (!target) return
    openScheduleDetailModal(toMappedSchedule(target), queryClient)
  }

  // ── 지난 회기 인라인 정리 (완료 → 일지 작성) ──
  const sessionActions = createDashboardSessionActions({ queryClient })
  /** 이 화면에서 방금 완료 처리해 일지 작성만 남은 일정 */
  let noteRequiredIds = $state(new Set<string>())
  let busyId = $state<string | null>(null)

  async function completeSession(item: CarouselItem) {
    busyId = item.id
    try {
      // 되돌리기를 누르면 회기가 예정으로 돌아가므로 '일지 작성' 대기 상태도 함께 푼다
      const ok = await sessionActions.complete(item.id, () => {
        noteRequiredIds = new Set(
          [...noteRequiredIds].filter((id) => id !== item.id)
        )
      })
      if (ok) noteRequiredIds = new Set([...noteRequiredIds, item.id])
    } finally {
      busyId = null
    }
  }

  async function cancelSession(item: CarouselItem) {
    busyId = item.id
    try {
      await sessionActions.cancel(item.id)
    } finally {
      busyId = null
    }
  }

  async function writeNote(item: CarouselItem) {
    await sessionActions.writeNote(item.id)
    noteRequiredIds = new Set(
      [...noteRequiredIds].filter((id) => id !== item.id)
    )
  }

  // ── 확인 요청 배너 (응답 대기함) ──
  // 헤더 알림 벨과 역할이 다르다 — 벨은 '일어난 일'(읽으면 끝), 배너는 '내 응답을 기다리는 것'
  // (처리해야 사라진다). 그래서 여기 오는 건 처리 액션이 있는 항목뿐이다.
  const NOTICE_CATEGORY_LABEL: Record<string, string> = {
    maintenance: '점검',
    update: '업데이트',
    announcement: '공지'
  }

  const noticeItems = $derived.by((): PendingActionItem[] =>
    (noticesQuery.data?.items ?? [])
      .filter((n) => !n.is_read)
      .slice(0, 5)
      .map((n) => ({
        id: `notice-${n.id}`,
        tone: 'notice' as const,
        category: NOTICE_CATEGORY_LABEL[n.category] ?? '공지',
        title: n.title,
        // 공지는 '자세히 보기' 하나. 상세를 열면 서버가 읽음을 기록하므로
        // (notice_reads upsert) 그 자체가 처리 액션이다 — 별도 '확인'을 두지 않는다.
        actions: [
          {
            label: '자세히 보기',
            variant: 'outline' as const,
            href: `/notice/${n.id}`
          }
        ]
      }))
  )

  // 일정 변경 요청 — 배너에서 바로 승인·반려한다(예약 현황과 같은 서비스·같은 확인 절차).
  // 승인 실패(그 사이 시간이 참)는 서비스가 false를 돌려주므로 항목이 배너에 남는다.
  const reservationsService = createReservationsService({ queryClient })

  /** 배너 항목을 누르면 담당·프로그램·사유까지 보여주는 상세 모달을 연다 */
  function openChangeRequest(request: ScheduleChangeRequestItem) {
    modalStore.open({
      component: ScheduleChangeRequestModal,
      props: {
        request,
        onApprove: reservationsService.approve,
        onReject: reservationsService.reject
      }
    })
  }

  const changeRequestItems = $derived.by((): PendingActionItem[] =>
    ((changeRequestsQuery.data as ScheduleChangeRequestItem[]) ?? []).map(
      (r) => ({
        id: `change-${r.id}`,
        tone: 'request' as const,
        onOpen: () => openChangeRequest(r),
        title: `${r.client_name ?? '내담자'} 님이 일정 변경을 요청했어요`,
        // 승인 판단에 필요한 최소 정보 — 현재 시각 → 요청 시각
        change: {
          from: formatUtcToKst(r.current_start, 'MM.DD HH:mm'),
          to: formatUtcToKst(r.requested_start, 'MM.DD HH:mm')
        },
        actions: [
          {
            label: '반려',
            variant: 'danger' as const,
            run: () => reservationsService.reject(r.id)
          },
          {
            label: '승인',
            variant: 'primary' as const,
            run: () => reservationsService.approve(r.id)
          }
        ]
      })
    )
  )

  // 상대가 답을 기다리는 요청이 먼저, 읽고 확인하는 공지가 뒤
  const pendingActionItems = $derived([...changeRequestItems, ...noticeItems])

  // ── 처리할 일 큐 ──
  // 카드 건수와 모달 목록이 갈리지 않도록, 큐(rows)를 먼저 만들고 카드는 rows.length만 읽는다.
  const activeCases = $derived(activeCasesQuery.data?.items ?? [])

  // 미처리 회기 응답은 내담자 '이름'만 준다 — 사진·성별은 이미 불러온 진행 사례
  // (activeCasesQuery)의 clients에서 case_id로 이어 붙인다. 서버 변경 없이 아바타를 채우는 경로.
  // 진행 사례는 상위 100건 상한이라 그 밖의 케이스는 이름 이니셜로 떨어진다(빈 슬롯 유지).
  const caseClientsMap = $derived.by(() => {
    const map = new Map<
      string,
      {
        name: string
        gender?: string | null
        profileImageUrl?: string | null
      }[]
    >()
    for (const c of activeCases) {
      map.set(
        c.case_id,
        (c.clients ?? []).map((cl) => ({
          name: cl.name,
          gender: cl.gender,
          profileImageUrl: cl.profile_image_url
        }))
      )
    }
    return map
  })

  const unprocessedRows = $derived.by(() =>
    (unprocessedQuery.data?.items ?? []).map((s) => ({
      id: s.session_id,
      // 그룹은 대표 1명 + '외 n명' — 아바타도 대표 1명 + n 배지라 표기를 맞춘다
      // (전원 나열은 +n 배지와 중복되고 행 폭을 먹는다). 일정 카드와 같은 규칙.
      name:
        s.client_names.length === 0
          ? '내담자 미지정'
          : s.client_names.length === 1
            ? s.client_names[0]
            : `${s.client_names[0]} 외 ${s.client_names.length - 1}명`,
      badge: s.session_number ? `${s.session_number}회기` : null,
      // 행(버튼 제외)을 누르면 그 회기가 열린 사례 상세로
      href: `/counseling/status/${s.case_id}?session=${s.session_id}`,
      // 프로그램 | MM.DD HH:mm — 회기를 가리키는 최소 정보만.
      // 종료시각·장소는 뺀다(행에서 판단에 쓰이지 않고 폭만 먹는다).
      subtitleParts: [
        s.program_name,
        formatUtcToKst(s.start, 'MM.DD HH:mm')
      ].filter((v): v is string => !!v),
      // 사례에서 이은 내담자(사진 포함)를 우선, 못 이으면 이름만
      avatars:
        caseClientsMap.get(s.case_id) ??
        s.client_names.map((name) => ({ name })),
      actions: [
        {
          label: '완료',
          variant: 'primary' as const,
          run: ({ restore }: { restore: () => void }) =>
            sessionActions.completeSessionById(s.session_id, restore)
        },
        {
          label: '취소',
          variant: 'danger' as const,
          run: ({ restore }: { restore: () => void }) =>
            sessionActions.cancelSessionById(s.session_id, restore)
        }
      ]
    }))
  )

  // 연장·종결 확인 = 예약 0 + 완료 있음 + 미종결
  const needsReviewRows = $derived.by(() =>
    activeCases
      .filter((c) => computeNextSession(c).kind === 'needs_review')
      .map((c) => ({
        id: c.case_id,
        name: c.clients?.[0]?.name ?? c.title,
        badge: null,
        // '예정 회기 없음'은 이 큐(needs_review)의 정의라 행마다 쓰지 않는다
        subtitleParts: [c.program_name, c.counselor_name].filter(
          (v): v is string => !!v
        ),
        avatars: (c.clients ?? []).map((cl) => ({
          name: cl.name,
          gender: cl.gender,
          profileImageUrl: cl.profile_image_url
        })),
        actions: [
          {
            label: '종결',
            variant: 'primary' as const,
            run: ({ restore }: { restore: () => void }) =>
              sessionActions.closeCase(c.case_id, restore)
          },
          {
            // 연장(회기 추가)은 일정·금액 입력이 필요해 한 번에 처리할 수 없다 → 상담 상세로
            label: '연장',
            variant: 'outline' as const,
            href: `/counseling/status/${c.case_id}`
          }
        ]
      }))
  )

  // 청구는 단가표 매칭·항목 prefill이 붙은 세션 청구 모달이 정본 —
  // 미청구 탭·일정 상세와 같은 서비스를 써서 처리 경로가 갈라지지 않게 한다.
  const billableService = createBillableService({ queryClient })

  const unchargedRows = $derived.by(() =>
    !isManager
      ? []
      : (missingBillablesQuery.data ?? []).map((t, i) => ({
          // session_id는 null일 수 있어(일정 없이 접수된 검사 등) case_id만으론 겹친다 → 인덱스로 유일화
          id: `${t.case_id}-${t.session_id ?? 'none'}-${i}`,
          name: t.client_name ?? '내담자 미지정',
          badge: t.title,
          subtitleParts: [t.subtitle, t.case_code].filter(
            (v): v is string => !!v
          ),
          avatars: t.client_name
            ? [
                {
                  name: t.client_name,
                  gender: t.client_gender,
                  profileImageUrl: t.client_profile_image_url
                }
              ]
            : [],
          actions: [
            {
              label: '청구하기',
              variant: 'primary' as const,
              // 드릴다운을 닫고 그 자리에 청구 모달을 띄운다(모달이 모달로 바뀌는 흐름).
              // 실제 처리는 청구 모달이 하므로 여기서 행을 지우지 않는다(false) —
              // 청구가 끝나면 getTodayMissingBillables 무효화로 목록에서 빠진다.
              run: ({ close }: { close: () => void }) => {
                close()
                billableService.openTargetBilling(SessionBillingModal, t)
                return false
              }
            }
          ]
        }))
  )

  // 미작성 일지 — 완료했는데 일지가 없는 회기. '일지 작성'은 상담일지 화면과 같은 모달을 연다.
  const missingNoteRows = $derived.by(() =>
    ((missingNotesQuery.data?.items ?? []) as MyCounselingNoteItem[]).map(
      (n, i) => ({
        // 그룹 회기는 한 회기에 내담자 수만큼 행이 온다(일지는 내담자별) —
        // session_id만 쓰면 키가 겹쳐 목록 each가 죽는다. client_id로 갈라 유일화.
        id: `${n.counseling_session_id}-${n.client_id ?? i}`,
        name: n.client_name ?? '내담자 미지정',
        badge: n.program_type === 'GROUP' ? '그룹' : null,
        // 프로그램 | MM.DD HH:mm — 미처리 회기 행과 같은 표기
        subtitleParts: [
          n.program_name,
          n.session_start
            ? formatUtcToKst(n.session_start, 'MM.DD HH:mm')
            : null
        ].filter((v): v is string => !!v),
        avatars: n.client_name
          ? [
              {
                name: n.client_name,
                gender: n.client_gender,
                profileImageUrl: n.client_profile_image_url
              }
            ]
          : [],
        href: n.counseling_case_id
          ? `/counseling/status/${n.counseling_case_id}?session=${n.counseling_session_id}`
          : null,
        actions: [
          {
            label: '일지 작성',
            variant: 'primary' as const,
            // 드릴다운을 닫고 일지 모달을 띄운다(청구와 같은 흐름).
            // 작성은 그 모달이 끝내므로 여기서 행을 지우지 않는다(false).
            run: ({ close }: { close: () => void }) => {
              if (!n.schedule_id) return false
              close()
              sessionActions.writeNote(n.schedule_id)
              return false
            }
          }
        ]
      })
    )
  )

  const taskCategories = $derived.by((): TaskCategory[] => {
    const list: TaskCategory[] = [
      {
        key: 'unprocessed',
        label: '미처리 회기',
        href: '/counseling/status',
        rows: unprocessedRows
      },
      {
        key: 'missing-note',
        label: '미작성 일지',
        href: '/counseling/notes',
        rows: missingNoteRows
      },
      {
        key: 'needs-review',
        label: '연장·종결 필요',
        href: '/counseling/status',
        rows: needsReviewRows
      }
    ]
    if (isManager)
      list.push({
        key: 'uncharged',
        label: '미청구',
        href: '/billing',
        rows: unchargedRows
      })
    return list
  })

  const taskItems = $derived.by((): TaskSummaryItem[] =>
    taskCategories.map((c) => ({
      id: c.key,
      label: c.label,
      count: c.rows.length
    }))
  )

  function openTaskDrilldown(key: string) {
    modalStore.open({
      component: TaskDrilldownModal,
      props: { categories: taskCategories, initialKey: key },
      options: { customWidth: 560, desktopOnly: true }
    })
  }
</script>

<!--
  앱 셸의 좌우 80 · 상 20 · 하 32 패딩을 상쇄해 콘텐츠 영역 전체를 쓰는 풀블리드 화면
  (§Layout 풀블리드 페이지). min-h 로 뷰포트를 채우되 고정하지는 않는다 —
  들어가면 스크롤 없음, 넘치면 셸의 overflow-y-auto 가 스크롤을 만든다(잘리지 않음).

  음수 마진은 셸 패딩과 값이 정확히 같아야 한다. -mb-5(20)는 셸 하단이 20이던 시절 값이라
  32로 올라간 뒤 12px이 남아 늘 스크롤이 생겼다 → -mb-8.
  높이 계산: min-h(100vh-64) - 20 - 32 = 셸 안쪽 높이(100vh-116)와 일치.

  하단은 48. 옛 pb-48(192)은 콘텐츠 합계를 927로 만들어 뷰포트가 991 미만이면 늘 스크롤이
  생겼다 — 이 화면은 스크롤 없음이 전제다. 남는 세로 공간은 고정 패딩이 아니라
  min-h가 만드는 여백이 가져간다.
-->
<div
  class="relative -mx-20 -mb-8 -mt-5 flex min-h-[calc(100vh-64px)] flex-col px-20 pb-12 pt-5"
>
  <!-- ═══ 앰비언트 글로우 (시안 Ellipse 53 — 원본 아트워크 그대로) ═══ -->
  <!-- 클리핑은 이 래퍼가 소유한다 — 컨테이너에 overflow-hidden 을 걸면 넘친 콘텐츠까지 잘린다 -->
  <div
    class="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    aria-hidden="true"
  >
    <div class="absolute left-1/2 top-[359px] size-[1860px] -translate-x-1/2">
      <img
        src={ambientGlow}
        alt=""
        class="absolute -inset-[10.34%] block max-w-none"
        style="width:120.68%;height:120.68%"
      />
    </div>
  </div>

  <div class="relative z-10 flex flex-1 flex-col pt-10">
    <!-- ═══ 확인 요청 배너 (응답 대기함) ═══ -->
    <PendingActionBanner items={pendingActionItems} />

    <!-- ═══ 히어로 ═══ -->
    <!-- 인사말은 시간대(아침/오후/저녁)에 따라 길어져 한 줄 폭이 필요하다 -->
    <div class="mx-auto flex w-full max-w-[880px] flex-col items-center gap-6">
      <div class="flex w-full flex-col items-center gap-4">
        <Typography
          variant="body-01-normal-regular"
          color="text-gray-700"
          className="block w-full text-center"
        >
          {dateLabel}
        </Typography>
        <Typography
          variant="display-02-normal-semibold"
          color="text-gray-900"
          tag="h1"
          className="block w-full text-center"
        >
          {userName ? `${userName}님, ` : ''}{greeting}
        </Typography>
      </div>

      <!-- 스켈레톤은 한 줄(27)인데 실제 문장은 "내일 N건"이 붙으면 두 줄이 된다.
           내일 일정 유무는 미리 알 수 없는 치수라 LoadingSwap이 높이 전환으로 흡수한다 -->
      <LoadingSwap loading={showSkeleton}>
        {#snippet skeleton()}
          <div class="flex justify-center">
            <span class="skeleton h-[27px] w-58"></span>
          </div>
        {/snippet}
        {#snippet content()}
          <!-- 0건인 날의 문구는 일러스트 아래가 자리다 — 여기선 통째로 비운다
               (빈 <p>를 남기면 line-height 만큼 죽은 높이가 생긴다) -->
          {#if carouselItems.length > 0 || tomorrowCount > 0}
            <div class="flex w-full flex-col items-center">
              {#if carouselItems.length > 0}
                <Typography
                  variant="title-01-reading-semibold"
                  color="text-gray-900"
                  className="block w-full text-center"
                >
                  오늘 총 <span class="text-primary-500"
                    >{carouselItems.length}건</span
                  >의 일정이 있어요
                </Typography>
              {/if}
              <!--
                내일 일정 미리 알림 — 하루 전 리마인드를 알림 목록에 쌓는 대신 두는 자리.
                오늘 문장과 한 묶음이라 gap 8(§Spacing 연관 텍스트 최소값).
                보조 정보라 Body_02/Regular — 오늘 문장(18 SemiBold)보다 한 단 낮춘다.
              -->
              {#if tomorrowCount > 0}
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-600"
                  className="mt-2 block w-full text-center"
                >
                  내일은 {tomorrowCount}건이 예정되어 있어요
                </Typography>
              {/if}
            </div>
          {/if}
        {/snippet}
      </LoadingSwap>
    </div>

    <!-- ═══ 오늘 일정 (타임라인 + 캐러셀) ═══ -->
    <!-- 스켈레톤은 277 고정인데 실제 무대는 카드 실측 높이 + 아치 32이고, 0건인 날은
         통째로 빠진다. 미리 맞출 수 없는 차이라 높이 전환으로 흡수한다 -->
    <LoadingSwap loading={showSkeleton}>
      {#snippet skeleton()}
        <div class="mt-4">
          <TodayScheduleCarouselSkeleton />
        </div>
      {/snippet}
      {#snippet content()}
        {#if carouselItems.length > 0}
          <div class="mt-4">
            <TodayScheduleCarousel
              items={carouselItems}
              {nowHour}
              {initialIndex}
              {noteRequiredIds}
              {busyId}
              onDetail={openDetail}
              onComplete={completeSession}
              onCancel={cancelSession}
              onWriteNote={writeNote}
            />
          </div>
        {:else}
          <!-- 일정 0건 — 일러스트 240 + 문구.
               히어로 gap-6(24)에 mt-10(40)을 더해 조합을 화면 아래쪽으로 내린다
               (남는 아래 공간은 flex-1 인 '처리할 일'이 나눠 갖는다).
               일러스트 ↔ 문구는 한 그룹이라 12. -->
          <div class="mt-10 flex flex-col items-center gap-3">
            <EmptyScheduleIllust240 />
            <Typography
              variant="body-01-reading-regular"
              color="text-gray-500"
              className="block text-center"
            >
              오늘은 예정된 일정이 없어요
            </Typography>
          </div>
        {/if}
      {/snippet}
    </LoadingSwap>

    <!-- ═══ 처리할 일 ═══ -->
    <!-- 남는 세로 공간을 이 블록이 받되(flex-1) 안에서는 **위로 붙인다**.
         옛 justify-center는 남는 공간을 위아래로 반씩 나눠 이 블록을 화면 중앙까지
         끌어내렸다 — 콘텐츠가 아래로 처지고 하단 여백이 사라진 원인.
         justify-start면 캐러셀 바로 아래 24 간격에 붙고, 남는 공간은 전부 하단 여백이 된다.
         (캐러셀 무대는 아치 낙차만큼 아래에 빈 높이를 갖고 있어, 눈에 보이는 간격은 24보다 크다) -->
    <div class="mt-6 flex flex-1 flex-col justify-start">
      <TaskSummarySection
        items={taskItems}
        loading={showSkeleton}
        onOpen={openTaskDrilldown}
      />
    </div>
  </div>
</div>
