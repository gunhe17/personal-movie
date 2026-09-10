<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { getCounselingDetailById } from '$lib/hooks/actions/counseling.action'
  import type { CounselingSession, SessionStatus } from '$lib/types/counseling'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import ProgramInfoPanel from '$lib/components/counseling/ProgramInfoPanel.svelte'
  import SessionDetailPanel from '$lib/components/counseling/SessionDetailPanel.svelte'
  import SessionListSection from '$lib/components/counseling/SessionListSection.svelte'
  import { getFieldNoteStatuses } from '$lib/hooks/actions/field-note.action'
  import { buildFieldNoteStatuses } from '$lib/features/field-note/query-builders'
  import CounselingCaseEditModal from '$lib/components/modal/CounselingCaseEditModal.svelte'
  import CaseAnalysisModal from '$lib/components/modal/CaseAnalysisModal.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { openScheduleDetailModalById } from '$lib/components/modal/openScheduleDetailModal'
  import { centerId } from '$root/src/lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { panelStore } from '$lib/stores/sidePanel'
  import ProgramInfoSidePanel from '$lib/components/counseling/ProgramInfoSidePanel.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import {
    buildCounselingDetailInput,
    createCounselingDetailService
  } from '$lib/features/counseling/detail'
  import { createFieldNoteService } from '$lib/features/field-note/field-note-service'
  import { createCounselingBillingService } from '$lib/features/counseling/detail/counseling-billing-service'
  import { createCounselingService } from '$lib/features/counseling/status/counseling-service'
  import { getBillableByRelated } from '$lib/hooks/actions/billable.action'
  import { hasPermission } from '$lib/stores/permission.view'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import CaseBillingModal from '$lib/features/billing/components/create/CaseBillingModal.svelte'
  import BillableDetailModal from '$root/src/routes/(protected)/billing/components/BillableDetailModal.svelte'
  import type { SessionParticipant } from '$lib/types/counseling'

  const id = $derived(page.params.id ?? '')

  const queryClient = useQueryClient()
  const detailService = createCounselingDetailService({
    queryClient,
    getCenterId: () => $centerId
  })
  const fieldNoteService = createFieldNoteService({
    queryClient,
    getCenterId: () => $centerId
  })
  const billingService = createCounselingBillingService({ queryClient })
  // 삭제 확인 모달·스낵바·invalidate는 목록 서비스가 소유 — 상세도 같은 경로를 쓴다
  const counselingService = createCounselingService({ queryClient, centerId })

  const canWriteBilling = $derived($hasPermission('write:billing'))
  const canReadBilling = $derived($hasPermission('read:billing'))

  const counselingQuery = queryBuilder(
    getCounselingDetailById,
    () => ($centerId ? buildCounselingDetailInput($centerId, id) : null),
    {
      // svelte-ignore state_referenced_locally
      enabled: !!id && !!$centerId
    }
  )

  let counselingData = $derived(counselingQuery.data)

  // 부담당(공동 상담사)은 열람만 — 서버도 주담당에게만 수정을 허용한다
  const canEditCase = $derived(counselingData?.my_role !== 'assistant')
  let counselingSessions = $derived(counselingData?.sessions || [])
  const completedSessionCount = $derived(
    counselingSessions.filter(
      (s: CounselingSession) => s.status === 'completed'
    ).length
  )

  // 회기 카드에 '필드노트 있음'을 달기 위한 배치 조회.
  // 필드노트는 회기가 아니라 schedule에 붙는다(전문가앱이 일정을 골라 녹음).
  const sessionScheduleIds = $derived(
    counselingSessions
      .map((s: CounselingSession) => s.schedule_id)
      .filter((id: string | null): id is string => !!id)
  )
  const fieldNoteStatusesQuery = queryBuilder(
    getFieldNoteStatuses,
    () => buildFieldNoteStatuses($centerId, sessionScheduleIds),
    () => ({
      enabled: !!$centerId && sessionScheduleIds.length > 0,
      // 보조 표시 — 실패해도 회기 목록 렌더를 깨지 않는다
      throwOnError: false,
      retry: false
    })
  )
  // 웹은 쓸 수 있는 것만 보여준다 — 녹음 중·일시정지는 전문가앱이 알린다
  const fieldNoteScheduleIds = $derived.by(() => {
    const ids = new Set<string>()
    const data = fieldNoteStatusesQuery.data as
      | Array<{ schedule_id: string | null; status: string }>
      | undefined
    for (const item of data ?? []) {
      if (item.schedule_id && item.status === 'completed')
        ids.add(item.schedule_id)
    }
    return ids
  })
  let counselingClients = $derived(counselingData?.clients || [])
  let isLoading = $derived(counselingQuery.isLoading)
  let selectedSessionId = $state<string | null>(null)
  const selectedSession = $derived.by(() => {
    if (!counselingSessions.length || !selectedSessionId) return null
    return (
      counselingSessions.find(
        (s: CounselingSession) => s.session_id === selectedSessionId
      ) ?? null
    )
  })

  // 브레드크럼 표시용 프로그램명
  const breadcrumbTitle = $derived(() => {
    if (!counselingData) return ''
    const caseTypeLabel =
      counselingData.case_type === 'individual' ? '' : '그룹'
    const programName = counselingData.program_name
    return caseTypeLabel ? `${programName} - ${caseTypeLabel}` : programName
  })

  // 선택된 세션의 청구 목록 조회 (세션 단위)
  const sessionBillablesQuery = queryBuilder(
    getBillableByRelated,
    () => ({
      centerId: $centerId ?? '',
      relatedType: 'counseling_session',
      relatedSessionId: selectedSessionId ?? ''
    }),
    () => ({
      enabled: !!$centerId && !!selectedSessionId && canReadBilling
    })
  )
  const sessionBillables = $derived(
    (sessionBillablesQuery.data as any[] | undefined) ?? []
  )

  // 케이스 레벨 청구 조회 (패키지 선결제 감지 + 세션 개별 청구 존재 여부)
  // counseling_case + counseling_session 둘 다 가져와서 case_id 기준으로 필터됨
  const caseBillablesQuery = queryBuilder(
    getBillableByRelated,
    () => ({
      centerId: $centerId ?? '',
      relatedType: ['counseling_case', 'counseling_session'],
      relatedCaseId: counselingData?.case_id ?? ''
    }),
    () => ({
      enabled: !!$centerId && !!counselingData?.case_id && canReadBilling
    })
  )
  const allCaseBillables = $derived(
    (caseBillablesQuery.data as any[] | undefined) ?? []
  )
  // 패키지 청구만 (BillableSummary.is_package 활용)
  const caseBillables = $derived(
    allCaseBillables.filter((b: any) => b.is_package === true)
  )

  // 이미 청구된 회기 — 회기 카드에 '청구 완료'로 표시 (패키지·개별 청구 모두 포함)
  const billedSessionIds = $derived.by(() => {
    const set = new Set<string>()
    for (const b of allCaseBillables) {
      for (const sid of ((b as any).related_session_ids ?? []) as string[]) {
        set.add(sid)
      }
    }
    return set
  })

  // 클라이언트별 세션 개별 청구 존재 여부 (청구 상태 표시용)
  const sessionBilledClientIds = $derived.by(() => {
    const set = new Set<string>()
    for (const b of allCaseBillables) {
      if (b.is_package === true) continue
      const cid = (b as any).client_id as string | undefined
      if (cid) set.add(cid)
    }
    return set
  })

  /**
   * 내담자별 청구 상태 — 판정 기준은 **발행 방식(패키지/개별)이 아니라
   * '아직 청구 안 된 회기가 남았는가'** 다.
   *
   * 나눠서 청구하면(3건 → 나머지 7건) 두 번째 청구는 구조상 패키지가 될 수 없어,
   * 옛 판정(is_package 유무)에선 10/10을 다 청구해도 계속 '청구 전'으로 남았다.
   *
   * state: 'none' = 청구할 회기가 남음(버튼 = 청구)
   *        'pending'/'completed' = 전량 청구됨(버튼 = 청구서 확인) + 납부 여부
   */
  const packageBillingMap = $derived.by(() => {
    const map: Record<
      string,
      {
        state: 'none' | 'pending' | 'completed'
        billableId?: string
        disabled: boolean
      }
    > = {}

    for (const c of counselingClients) {
      const cid = (c as any).client_id as string | undefined
      if (!cid) continue

      const mine = allCaseBillables.filter(
        (b: any) => (b.client_id as string | undefined) === cid
      )
      const billedSessions = new Set<string>()
      for (const b of mine) {
        for (const sid of ((b as any).related_session_ids ?? []) as string[]) {
          billedSessions.add(sid)
        }
      }

      // 청구 대상 = 이 내담자가 참여하고 취소되지 않은 회기
      const targets = counselingSessions.filter(
        (s: any) =>
          s.status !== 'cancelled' &&
          (s.clients ?? []).some((p: any) => p.participant_id === cid)
      )
      const allBilled =
        targets.length > 0 &&
        targets.every((s: any) => billedSessions.has(s.session_id))

      if (!allBilled || mine.length === 0) {
        map[cid] = { state: 'none', disabled: false }
        continue
      }

      // 열 청구서 = 케이스 전체를 덮는 패키지 우선, 없으면 가장 최근 건
      const opening =
        mine.find((b: any) => b.is_package === true) ?? mine[mine.length - 1]
      // 미납이 하나라도 있으면 아직 납부 전
      const allPaid = mine.every((b: any) => b.status === 'paid')

      map[cid] = {
        state: allPaid ? 'completed' : 'pending',
        billableId: (opening as any)?.id,
        disabled: false
      }
    }

    return map
  })

  // 선택된 세션을 커버하는 패키지 청구 (client_id별)
  // 각 패키지 Billable의 related_session_ids에 현재 선택 세션이 포함되어야 커버로 인정
  const caseCoverageForSelectedSession = $derived.by(() => {
    const map: Record<string, { billableId: string; isPaid: boolean }> = {}
    if (!selectedSessionId) return map
    for (const b of caseBillables) {
      const covered =
        ((b as any).related_session_ids as string[] | undefined) ?? []
      if (!covered.includes(selectedSessionId)) continue
      const cid = (b as any).client_id as string | undefined
      if (!cid) continue
      const isPaid = (b as any).status === 'paid'
      const existing = map[cid]
      if (!existing || (isPaid && !existing.isPaid)) {
        map[cid] = { billableId: (b as any).id, isPaid }
      }
    }
    return map
  })

  // client_id → { state, billableId?, source? } 매핑
  // source: 'case' = 패키지 선결제로 이 세션 커버됨, 'session' = 세션 단위 개별 청구
  const clientBillingMap = $derived.by(() => {
    const map: Record<
      string,
      {
        state: 'none' | 'pending' | 'completed'
        billableId?: string
        source?: 'case' | 'session'
      }
    > = {}

    // 1. 선택된 세션을 커버하는 패키지 청구 반영
    for (const cid in caseCoverageForSelectedSession) {
      const entry = caseCoverageForSelectedSession[cid]
      map[cid] = {
        state: entry.isPaid ? 'completed' : 'pending',
        billableId: entry.billableId,
        source: 'case'
      }
    }

    // 2. 세션 단위 개별 청구 덮어쓰기 (pending이 있으면 그게 우선)
    for (const b of sessionBillables) {
      const cid = (b as any).client_id as string | undefined
      if (!cid) continue
      const existing = map[cid]
      const isPaid = (b as any).status === 'paid'

      if (!existing) {
        map[cid] = {
          state: isPaid ? 'completed' : 'pending',
          billableId: (b as any).id,
          source: 'session'
        }
      } else if (existing.state === 'completed' && !isPaid) {
        map[cid] = {
          state: 'pending',
          billableId: (b as any).id,
          source: 'session'
        }
      }
    }
    return map
  })

  function handleCreateBillingForClient(client: SessionParticipant) {
    if (!counselingData || !selectedSession) return
    billingService.openCreateBilling({
      caseData: counselingData,
      session: selectedSession,
      client,
      SessionBillingModal
    })
  }
  function handleViewBillingForClient(client: SessionParticipant) {
    const entry = clientBillingMap[client.participant_id]
    if (!entry?.billableId) return
    billingService.openViewBilling({
      billableId: entry.billableId,
      canWriteBilling,
      BillableDetailModal
    })
  }

  /**
   * 클라이언트별 케이스 청구 액션
   * - 미청구(none): 회기 선택 청구 모달 열기 (전량 선택=패키지 / 부분 선택=회기별)
   * - 진행중/완료(pending/completed): 해당 청구서 상세 보기
   */
  function handlePackageBillingForClient(clientId: string) {
    if (!counselingData) return
    const entry = packageBillingMap[clientId]
    if (entry?.billableId) {
      billingService.openViewBilling({
        billableId: entry.billableId,
        canWriteBilling,
        BillableDetailModal
      })
      return
    }
    const target = counselingClients?.find((c) => c.client_id === clientId)
    if (!target) return
    billingService.openCaseBilling({
      caseData: counselingData,
      sessions: counselingSessions,
      client: {
        participant_id: target.client_id,
        participant_name: target.name
      } as SessionParticipant,
      CaseBillingModal
    })
  }

  // 리포트의 근거 회기 번호 → 그 회기 상세로. 번호는 표시용이라 실제 이동은 id로 한다.
  // 도크는 열어 둔다 — 리포트와 원본 일지를 나란히 놓고 대조하는 게 이 동선의 목적이다.
  function handleSelectSessionFromAnalysis(sessionNumber: number) {
    const target = counselingSessions.find(
      (s: CounselingSession) => s.session_number === sessionNumber
    )
    if (!target) return
    handleSessionSelect(target.session_id)
  }

  // AI 경과 분석 — 좌측 패널 하단 진입점에서 겹면으로 연다(옛 우측 탭 대체).
  // 폭 740(size 'xl') — 케어보드 차트 모달(w-[min(94vw,740px)])과 같은 값이다.
  // 둘 다 "한 내담자를 한 장으로 훑는" 조회 겹면이라 폭이 갈리면 안 된다
  // (옛 1000은 리포트가 화면을 가득 채워 뒤 맥락이 사라졌다, 2026-09-02).
  // 높이는 컨테이너의 max-h-[90vh]가 잡는다 — customHeight를 주면 ModalContainer가
  // size 클래스를 버려 전폭이 된다(폭·높이가 한 분기).
  // 오버레이 모드에서는 상담 정보 패널을 닫고 열어 겹면이 두 겹으로 쌓이지 않게 한다.
  function openAnalysisModal() {
    if (!counselingData) return
    if (isOverlayMode) panelStore.close()
    modalStore.open({
      component: CaseAnalysisModal,
      props: {
        caseDetail: counselingData,
        completedSessionCount,
        canWrite: canEditCase,
        onSelectSession: handleSelectSessionFromAnalysis
      },
      // 높이 고정 — 리포트 유무로 판 크기가 달라지지 않게 한다(§modal 상한 940).
      // customHeight를 주면 size 클래스가 무시되므로 폭도 함께 명시한다(xl = 740).
      options: { size: 'xl', customWidth: 740, customHeight: 940 }
    })
  }

  function handleSessionSelect(sessionId: string) {
    selectedSessionId = sessionId
    const url = new URL(page.url)
    url.searchParams.set('session', sessionId)
    goto(url.toString(), { replaceState: true, noScroll: true })
  }

  function handleStatusChange(sessionId: string, status: SessionStatus) {
    detailService.changeSessionStatus(
      sessionId,
      status,
      selectedSession ?? undefined,
      counselingData
    )
  }

  function handleEditSession(session: CounselingSession) {
    if (!counselingData) return
    detailService.openEditSessionModal(session, counselingData)
  }

  function handleDeleteSession(session: CounselingSession) {
    detailService.deleteSession(session, counselingSessions.length)
  }

  function handleAttendanceChange(
    sessionParticipantId: string,
    status: string
  ) {
    if (!selectedSession) return
    detailService.changeAttendanceStatus(
      sessionParticipantId,
      status,
      selectedSession
    )
  }

  function handleEditNoShow(client: SessionParticipant) {
    detailService.editNoShow(client)
  }

  // ── 반응형 ──
  // 좁은 화면에서는 좌측 상담 정보 패널을 접고, 헤더의 `상담 정보` 버튼으로 연다.
  const isOverlayMode = $derived(!responsive.isDesktop)

  function openProgramInfoPanel() {
    panelStore.open({
      component: ProgramInfoSidePanel as any,
      props: {
        counselingDetail: counselingData,
        counselingClients,
        isSecretMode: $isSecretMode,
        counselingSessions,
        selectedSessionId,
        onSessionSelect: (sessionId: string) => {
          handleSessionSelect(sessionId)
          panelStore.close()
        },
        packageBillingMap,
        canWriteBilling,
        canReadBilling,
        onPackageBilling: handlePackageBillingForClient,
        onOpenAnalysis: openAnalysisModal
      },
      options: { width: 'w-[min(90vw,400px)]' }
    })
  }

  // ── 회기 연장 배너 ──
  const scheduledSessions = $derived(
    counselingSessions.filter(
      (s: CounselingSession) => s.status === 'scheduled'
    )
  )
  const lastScheduledSession = $derived(
    scheduledSessions.length > 0
      ? scheduledSessions.reduce(
          (latest: CounselingSession, s: CounselingSession) =>
            new Date(s.start) > new Date(latest.start) ? s : latest
        )
      : null
  )
  const daysUntilLast = $derived.by(() => {
    if (!lastScheduledSession) return 0
    const diff = new Date(lastScheduledSession.start).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  const dismissKey = $derived(
    counselingData ? `session-ext-dismiss-${counselingData.case_id}` : ''
  )
  let isDismissed = $state(false)

  $effect(() => {
    if (!browser || !dismissKey) return
    const stored = localStorage.getItem(dismissKey)
    if (stored) {
      const elapsed = Date.now() - Number(stored)
      isDismissed = elapsed < 7 * 24 * 60 * 60 * 1000
    } else {
      isDismissed = false
    }
  })

  function handleDismiss() {
    localStorage.setItem(dismissKey, String(Date.now()))
    isDismissed = true
  }

  const hasCompletedSessions = $derived(
    counselingSessions.some((s: CounselingSession) => s.status === 'completed')
  )
  const isCaseOpen = $derived(
    counselingData?.status !== 'completed' &&
      counselingData?.status !== 'cancelled'
  )

  // 1단계(예고) — 예정 1~2건. 연장만 안내하고 '나중에'로 7일 미룰 수 있다.
  const showUpcomingBanner = $derived(
    scheduledSessions.length > 0 &&
      scheduledSessions.length <= 2 &&
      !isDismissed &&
      isCaseOpen
  )
  // 2단계(결정) — 예정 0 + 완료 있음 = 목록의 needs_review와 같은 판정.
  // 연장/종결 중 하나를 정해야 하는 상태라 닫기 없이 상주한다(목록·대시보드도 계속 걸려 있다).
  // 완료 0(미착수)이면 시작도 안 한 상담에 종결을 권하게 되므로 제외한다.
  const showCloseReviewBanner = $derived(
    scheduledSessions.length === 0 && hasCompletedSessions && isCaseOpen
  )

  const showExtensionBanner = $derived(
    showUpcomingBanner || showCloseReviewBanner
  )
  const bannerStage: 'upcoming' | 'review' = $derived(
    showCloseReviewBanner ? 'review' : 'upcoming'
  )

  // 기본은 회기 목록. URL ?session= 딥링크가 있을 때만 해당 회기 상세로 진입.
  let hasInitialized = $state(false)
  $effect(() => {
    if (!counselingSessions.length) return
    if (hasInitialized) return
    hasInitialized = true
    const sessionParam = page.url.searchParams.get('session')
    const matchFromUrl = sessionParam
      ? counselingSessions.find((s) => s.session_id === sessionParam)
      : null
    selectedSessionId = matchFromUrl ? matchFromUrl.session_id : null
  })

  // ?edit=case 딥링크 — 일정 수정 모달의 "새 내담자 추가"처럼, 다른 화면에서
  // "상담 정보에서 내담자를 등록하라"고 안내한 경로가 곧장 수정 모달로 착지한다.
  // returnTo·returnSchedule 이 함께 오면 왕복 경로 — 상담 정보 수정을 닫는 순간
  // 원래 화면으로 돌아가 그 일정의 수정 모달을 다시 연다(내담자 추가 → 바로 선택).
  let hasOpenedEditFromUrl = $state(false)
  $effect(() => {
    if (hasOpenedEditFromUrl) return
    if (!counselingData) return
    if (page.url.searchParams.get('edit') !== 'case') return
    hasOpenedEditFromUrl = true

    const returnTo = page.url.searchParams.get('returnTo')
    const returnSchedule = page.url.searchParams.get('returnSchedule')

    const url = new URL(page.url)
    url.searchParams.delete('edit')
    url.searchParams.delete('returnTo')
    url.searchParams.delete('returnSchedule')
    goto(url.toString(), { replaceState: true, noScroll: true })

    handleEditCase(
      returnTo && returnSchedule
        ? async () => {
            await goto(returnTo)
            // 케이스 수정 성공 시 invalidate 된 상세를 다시 읽어 새 내담자가 칩에 뜬다
            await openScheduleDetailModalById(returnSchedule, queryClient, {
              mode: 'edit'
            })
          }
        : undefined
    )
  })

  function handleBackToList() {
    selectedSessionId = null
    const url = new URL(page.url)
    url.searchParams.delete('session')
    goto(url.toString(), { replaceState: true, noScroll: true })
  }

  function handleEditCase(onClose?: () => void) {
    if (!counselingData) return
    modalStore.open({
      component: CounselingCaseEditModal as any,
      props: {
        counselingData,
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: ['getCounselingDetailById'],
            exact: false
          })
      },
      // onClose 는 저장·취소·닫기 모두에서 실행된다 — 왕복 복귀는 어느 쪽이든 동일
      options: { customWidth: 740, desktopOnly: true, onClose }
    })
  }

  function handleTerminateCase() {
    if (!counselingData) return
    detailService.terminateCase(
      counselingData.case_id,
      scheduledSessions.length
    )
  }

  function handleReopenCase() {
    if (!counselingData) return
    detailService.reopenCase(counselingData.case_id)
  }

  // 케이스 삭제 — 목록 케밥과 같은 확인 모달을 쓰고, 지운 뒤에는 목록으로 돌아간다
  // (지워진 상세에 머무르면 빈 화면이 된다).
  function handleDeleteCase() {
    if (!counselingData) return
    counselingService.deleteCounselingCase(
      {
        id: counselingData.case_id,
        totalSessions: counselingSessions.length
      },
      () => goto('/counseling/status')
    )
  }
</script>

<div in:fade class="flex min-h-full flex-col xl:h-full">
  {#if isLoading}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        로딩 중...
      </Typography>
    </div>
  {:else if !counselingData}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        데이터를 불러올 수 없어요
      </Typography>
    </div>
  {:else}
    <!-- 헤더 (케이스 상태 미표시 - 세션·참여자 중심) -->
    <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          onclick={() => history.back()}
          aria-label="뒤로가기"
          class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowBackIcon />
        </button>

        <button
          onclick={() => history.back()}
          class="transition-colors hover:text-body-default"
        >
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color="text-body-subtle"
          >
            상담
          </Typography>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
        >
          {breadcrumbTitle()}
        </Typography>
      </div>

      <div class="flex items-center gap-2">
        {#if isOverlayMode}
          <button
            onclick={openProgramInfoPanel}
            class="flex-center h-8 px-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Typography variant="body-02-medium" color="text-gray-700">
              상담 정보
            </Typography>
          </button>
        {/if}
      </div>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="flex xl:min-h-0 flex-1 xl:gap-4 -mx-4 xl:mx-0">
      {#if !isOverlayMode}
        <ProgramInfoPanel
          {counselingSessions}
          {counselingClients}
          {selectedSessionId}
          isSecretMode={$isSecretMode}
          counselingDetail={counselingData}
          onSessionSelect={handleSessionSelect}
          showSessions={false}
          {packageBillingMap}
          {canWriteBilling}
          {canReadBilling}
          onPackageBilling={handlePackageBillingForClient}
          onOpenAnalysis={openAnalysisModal}
          onTerminateCase={canEditCase ? handleTerminateCase : undefined}
          onReopenCase={canEditCase ? handleReopenCase : undefined}
          onDeleteCase={canEditCase ? handleDeleteCase : undefined}
        />
      {/if}

      <!-- 우측 컨테이너는 회기만 소유한다 — 경과 분석은 탭이 아니라
           좌측 패널 하단의 문에서 여는 모달이다(CaseAnalysisModal). -->
      {#if selectedSession}
        <SessionDetailPanel
          isSecretMode={$isSecretMode}
          session={selectedSession}
          caseStatus={counselingData.status}
          caseClients={counselingClients}
          {fieldNoteService}
          onBack={handleBackToList}
          canEdit={canEditCase}
          onStatusChange={canEditCase ? handleStatusChange : undefined}
          onEditSession={canEditCase ? handleEditSession : undefined}
          onDeleteSession={canEditCase ? handleDeleteSession : undefined}
          onAttendanceChange={canEditCase ? handleAttendanceChange : undefined}
          onEditNoShow={canEditCase ? handleEditNoShow : undefined}
          onAddClientToSession={canEditCase ? handleEditSession : undefined}
          {clientBillingMap}
          {canWriteBilling}
          {canReadBilling}
          onCreateBillingForClient={handleCreateBillingForClient}
          onViewBillingForClient={handleViewBillingForClient}
        />
      {:else}
        <SessionListSection
          sessions={counselingSessions}
          {fieldNoteScheduleIds}
          {billedSessionIds}
          onSelect={handleSessionSelect}
          onAddSession={canEditCase && isCaseOpen
            ? () => detailService.openAddSessionModal(counselingData)
            : undefined}
          caseStatus={counselingData.status}
          showBanner={showExtensionBanner}
          {bannerStage}
          bannerDays={daysUntilLast}
          onBannerDismiss={handleDismiss}
          onBannerTerminate={canEditCase ? handleTerminateCase : undefined}
        />
      {/if}
    </div>
  {/if}
</div>
