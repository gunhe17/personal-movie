<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type {
    CaseClient,
    CounselingCaseBaseDetail,
    CounselingSession
  } from '$lib/types/counseling'
  import EditIcon24 from '../../assets/EditIcon24.svelte'
  import { twMerge } from 'tailwind-merge'
  import { formatUtcToKst } from '../../utils/date'
  import SessionListItem from './SessionListItem.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import ScrollFadeArea from '../common/ScrollFadeArea.svelte'
  import { maskName } from '../../utils/maskingHandler'
  import { modalStore } from '../../stores/modal'
  import { snackbarStore } from '../../stores/snackbar'
  import { isCounselor } from '../../stores/permission.view'
  import { goto } from '$app/navigation'
  import SessionCreateModal from '../modal/SessionCreateModal.svelte'
  import CounselingCaseEditModal from '../modal/CounselingCaseEditModal.svelte'
  import SessionEditModal from '../modal/SessionEditModal.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import TotalSessionsEditModal from '../modal/TotalSessionsEditModal.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import EditIcon from '../../assets/EditIcon.svelte'
  import { queryBuilder } from '../../hooks/queries/builder'
  import { getFieldNoteStatuses } from '../../hooks/actions/field-note.action'
  import { getCaseAnalysisLatest } from '../../hooks/actions/case-analysis.action'
  import { centerId, requireCenterId } from '../../stores/center.store'
  import { patchCounselingCase } from '../../hooks/actions/counseling.action'
  import { deriveSessionDisplayStatus } from '$lib/features/counseling/session-display'
  import { buildFieldNoteStatuses } from '$lib/features/field-note/query-builders'
  import PackageBillingPill from '$lib/features/billing/components/PackageBillingPill.svelte'
  import CrownActiveYellowIcon20 from '$lib/assets/CrownActiveYellowIcon20.svelte'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'

  type PackageBillingEntry = {
    state: 'none' | 'pending' | 'completed'
    billableId?: string
    disabled: boolean
  }

  interface Props {
    counselingDetail: CounselingCaseBaseDetail
    /** 케밥(수정 버튼 우측) — 종결/되돌리기·삭제. 미전달 시 케밥을 그리지 않는다 */
    onTerminateCase?: () => void
    onReopenCase?: () => void
    onDeleteCase?: () => void
    counselingClients: CaseClient[]
    isSecretMode: boolean
    counselingSessions: CounselingSession[]
    selectedSessionId: string | null
    onSessionSelect?: (sessionId: string) => void
    embedded?: boolean
    /** 회기 목록 노출 여부 (오른쪽 패널로 이관 시 false) */
    showSessions?: boolean
    packageBillingMap?: Record<string, PackageBillingEntry>
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onPackageBilling?: (clientId: string) => void
    /** 패널 하단 AI 경과 분석 진입 — 미전달 시 버튼을 그리지 않는다 */
    onOpenAnalysis?: () => void
  }

  let {
    counselingDetail,
    onTerminateCase,
    onReopenCase,
    onDeleteCase,
    counselingClients,
    counselingSessions,
    selectedSessionId,
    isSecretMode,
    onSessionSelect,
    embedded = false,
    showSessions = true,
    packageBillingMap = {},
    canWriteBilling = false,
    canReadBilling = false,
    onPackageBilling,
    onOpenAnalysis
  }: Props = $props()

  // AI 경과 분석 상태 — 진입 버튼이 '실행하는 문'인지 '결과를 여는 문'인지 가른다.
  // 모달(CaseAnalysisPanel)과 같은 쿼리 키라 캐시를 공유한다 — 거기서 실행·폴링하며
  // invalidate하면 이 버튼도 함께 바뀐다. 보조 표시라 실패해도 패널을 깨지 않는다.
  const analysisQuery = queryBuilder(
    getCaseAnalysisLatest,
    () => ({ centerId: $centerId, caseId: counselingDetail.case_id }),
    () => ({
      enabled: !!$centerId && !!counselingDetail.case_id && !!onOpenAnalysis,
      throwOnError: false,
      retry: false
    })
  )
  const analysisStatus = $derived(
    (analysisQuery.data as { status?: string } | null | undefined)?.status ??
      null
  )
  const isAnalysisDone = $derived(analysisStatus === 'completed')
  const isAnalysisRunning = $derived(analysisStatus === 'processing')
  const isAnalysisFailed = $derived(analysisStatus === 'failed')

  const queryClient = useQueryClient()

  // 상세 케밥 = 종결(또는 되돌리기) · 삭제 — '수정'은 옆에 버튼으로 노출돼 있어 넣지 않는다
  const caseMenuItems = $derived.by(() => {
    const items: {
      label: string
      onClick: () => void
      variant?: 'danger'
      divider?: boolean
    }[] = []
    const status = counselingDetail.status
    if (status === 'completed' && onReopenCase) {
      items.push({
        label: '진행중으로 되돌리기',
        onClick: () => onReopenCase?.()
      })
    } else if (status && status !== 'cancelled' && onTerminateCase) {
      items.push({ label: '상담 종결하기', onClick: () => onTerminateCase?.() })
    }
    if (onDeleteCase)
      items.push({
        label: '삭제',
        onClick: () => onDeleteCase?.(),
        variant: 'danger',
        divider: true
      })
    return items
  })

  // 종결·취소 고지 — 배지 대신 문구 한 줄로 정보 그리드 위에 둔다.
  // 색은 상태 배지와 같은 토큰(state-done / state-canceled)을 그대로 쓴다
  const caseStatusNotice = $derived.by<{ text: string; color: string } | null>(
    () => {
      if (counselingDetail.status === 'completed')
        return { text: '완료된 상담이에요', color: 'text-state-done-text' }
      if (counselingDetail.status === 'cancelled')
        return { text: '취소된 상담이에요', color: 'text-state-canceled-text' }
      return null
    }
  )

  // 세션의 schedule_id들을 모아 필드노트 상태를 배치 조회
  const scheduleIds = $derived(
    counselingSessions
      .map((s) => s.schedule_id)
      .filter((id): id is string => !!id)
  )

  const fieldNoteStatusesQuery = queryBuilder(
    getFieldNoteStatuses,
    () => buildFieldNoteStatuses($centerId, scheduleIds),
    () => ({
      enabled: !!$centerId && scheduleIds.length > 0,
      // 비필수 뱃지용 — 에러나도 세션 리스트 렌더를 깨지 않는다
      throwOnError: false,
      retry: false
    })
  )

  // schedule_id → FieldNoteStatusItem 맵
  const fieldNoteStatusMap = $derived.by(() => {
    const map = new Map<string, string>()
    const data = fieldNoteStatusesQuery.data as
      | Array<{ schedule_id: string | null; status: string }>
      | undefined
    if (!data) return map
    for (const item of data) {
      if (item.schedule_id) map.set(item.schedule_id, item.status)
    }
    return map
  })

  const selectedSession = $derived(
    selectedSessionId
      ? (counselingSessions.find((s) => s.session_id === selectedSessionId) ??
          null)
      : null
  )

  // 표시용 정렬 — 예정(scheduled) 을 맨 위로, 그 외(완료/취소)는 아래로.
  // 각 그룹 내부는 백엔드가 내려준 시간순(오름차순)을 그대로 유지한다.
  // session_number 는 백엔드가 시간순으로 매겨주므로 정렬을 바꿔도 번호는 보존됨.
  const sortedSessions = $derived.by(() => {
    const scheduled = counselingSessions.filter((s) => s.status === 'scheduled')
    const others = counselingSessions.filter((s) => s.status !== 'scheduled')
    return [...scheduled, ...others]
  })

  function openSessionCreateModal() {
    modalStore.open({
      component: SessionCreateModal as any,
      props: {
        counselingDetail,
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['getCounselingDetailById'],
            exact: false
          })
        }
      },
      // 폭 740 = 좌우 2단 레이아웃(달력 + 선택된 날짜) 전용 구간
      // 폭 740 = "달력 + 선택된 날짜" 좌우 2단 전용 규격 — 일정 변경 모달과 동일
      // (Web_Design.md §Components>modal). 달력은 calendarSize="modal-large".
      options: { customWidth: 740, desktopOnly: true }
    })
  }

  const goToMemberDetail = (memberId: string) => {
    goto(`/member/${memberId}`)
  }

  function openEditModal() {
    modalStore.open({
      component: CounselingCaseEditModal as any,
      props: {
        counselingData: counselingDetail,
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['getCounselingDetailById'],
            exact: false
          })
        }
      },
      // 폭 640 = 디자인 시스템 모달 3단 중 '중간'
      options: { customWidth: 740, desktopOnly: true }
    })
  }

  // 진행 회기 = 열린 회기(참석·불참·노쇼) — 계약 관점 "총 N회 중 n회" 표기용
  const openSessionCount = $derived(
    counselingSessions.filter((s) => {
      if (s.status === 'cancelled') return false
      const display = deriveSessionDisplayStatus(s)
      return display === 'completed' || display === 'no_show'
    }).length
  )

  // 부담당(공동 상담사)은 열람만 — 서버도 주담당만 수정을 허용한다
  const canEditCase = $derived(counselingDetail.my_role !== 'assistant')

  // 주담당이 항상 앞. 저장 순서상 대표가 뒤에 올 수 있어 표시 직전에 재정렬한다.
  const orderedCounselors = $derived.by(() => {
    const list = counselingDetail.counselors ?? []
    const primaryId = counselingDetail.counselor_id
    return [...list].sort(
      (a, b) =>
        (b.counselor_id === primaryId ? 1 : 0) -
        (a.counselor_id === primaryId ? 1 : 0)
    )
  })

  const canEditTotalSessions = $derived(
    counselingDetail.status !== 'completed' && canEditCase
  )

  function openTotalSessionsModal() {
    modalStore.open({
      component: TotalSessionsEditModal as any,
      props: {
        initialValue: counselingDetail.total_sessions,
        // 하한은 취소 제외 — 취소 회기는 소진되지 않아 계약 회기 수를 점유하지 않는다 (하루 대본 D1)
        registeredCount: counselingSessions.filter(
          (s) => s.status !== 'cancelled'
        ).length,
        onConfirm: async (value: number) => {
          try {
            await patchCounselingCase().request({
              centerId: requireCenterId(),
              counselingId: counselingDetail.case_id,
              total_sessions: value
            })
            snackbarStore.success('총회기를 수정했어요')
            queryClient.invalidateQueries({
              queryKey: ['getCounselingDetailById'],
              exact: false
            })
            queryClient.invalidateQueries({
              queryKey: ['getCounselingsByCenterId'],
              exact: false
            })
          } catch (err) {
            snackbarStore.error('총회기 수정에 실패했어요')
            throw err
          }
        }
      },
      options: { customWidth: 420 }
    })
  }

  const goToClientDetail = (clientId: string) => {
    goto(`/clients/${clientId}`)
  }

  interface ClientStats {
    clientId: string
    profileImageUrl: string | null
    name: string
    birthDate: string | null
    age: number | null
    gender: string | null
    total: number
    attended: number
    absent: number
    scheduled: number
    completed: number
  }

  const clientStats = $derived.by((): ClientStats[] => {
    const statsMap = new Map<string, ClientStats>()

    for (const client of counselingClients) {
      statsMap.set(client.client_id, {
        clientId: client.client_id,
        profileImageUrl:
          (client as { profile_image_url?: string | null }).profile_image_url ??
          null,
        name: client.name,
        birthDate: client.birth_date,
        age: client.age,
        gender: client.gender,
        total: 0,
        attended: 0,
        absent: 0,
        scheduled: 0,
        completed: 0
      })
    }

    for (const session of counselingSessions) {
      if (session.status === 'cancelled') continue
      for (const participant of session.clients) {
        const stat = statsMap.get(participant.participant_id)
        if (!stat) continue
        stat.total++

        switch (participant.attendance_status) {
          case 'attended':
          case 'late':
            stat.attended++
            stat.completed++
            break
          case 'absent':
          case 'excused':
          case 'no_show':
            stat.absent++
            stat.completed++
            break
          case 'scheduled':
            stat.scheduled++
            break
        }
      }
    }

    return [...statsMap.values()]
  })

  function handleSessionClick(session: CounselingSession) {
    onSessionSelect?.(session.session_id)
  }
</script>

{#snippet clientCard(stat: ClientStats)}
  {@const billing = packageBillingMap[stat.clientId] ?? {
    state: 'none' as const,
    disabled: false
  }}
  {@const showPill =
    canWriteBilling || (canReadBilling && billing.state !== 'none')}
  <div class="flex w-full items-center gap-2">
    <button
      class="flex h-[71px] flex-1 items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
      onclick={() => goToClientDetail(stat.clientId)}
    >
      <ClientAvatar
        profileImageUrl={stat.profileImageUrl}
        name={isSecretMode ? maskName(stat.name) : stat.name}
        gender={stat.gender}
        sizeClass="h-10 w-10 shrink-0"
        textClass="text-[15px]"
      />
      <div class="min-w-0 flex-1">
        <Typography
          variant="body-01-normal-semibold"
          color="text-gray-800"
          className="truncate-safe"
        >
          {isSecretMode ? maskName(stat.name) : stat.name}
        </Typography>
        <!-- 나이는 생년월일로 알 수 있어 중복 — 생년월일·성별만 노출 -->
        <ClientBirthGender
          birthDate={stat.birthDate}
          gender={stat.gender}
          class="mt-2"
        />
      </div>
      <!-- 우측 열 = 회차 + 납부 상태. 납부(축2)는 청구서가 발행된 뒤에만 존재하므로
           청구 전에는 아예 표기하지 않는다 — 버튼은 축1(청구 여부)만 말한다 -->
      <div class="flex shrink-0 flex-col items-end">
        <Typography variant="body-03-normal-regular" color="text-body-default">
          {stat.completed}/{counselingSessions.length}회
        </Typography>
        {#if billing.state === 'completed'}
          <!-- '납부 전'은 싣지 않는다 — 청구서가 발행됐는데 이 표기가 없으면 곧 미납이라,
               두 줄을 다 쓰면서 얻는 정보가 없다(표기 유무가 곧 상태) -->
          <Typography
            variant="body-03-normal-regular"
            color="text-billing-fg"
            className="mt-2 whitespace-nowrap"
          >
            납부 완료
          </Typography>
        {/if}
      </div>
    </button>
    {#if showPill}
      <PackageBillingPill
        state={billing.state}
        disabled={billing.disabled}
        onClick={() => onPackageBilling?.(stat.clientId)}
      />
    {/if}
  </div>
{/snippet}

<div
  class={embedded
    ? 'flex min-h-0 w-full shrink-0 flex-col bg-white'
    : 'flex min-h-0 w-[var(--spacing-detail-side)] shrink-0 flex-col rounded-2xl border border-gray-200 bg-white'}
>
  <div class="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-6">
    {#if !embedded}
      <!-- 헤더가 아니라 [타이틀 + 아래 정보] 묶음의 첫 행이다 — 하단 구분선이 없다.
           헤더는 하단 라인으로 화면을 가르는 것만 헤더다(우측 회기 목록·회기 상세 = 58).
           상단 여백은 이 행이 아니라 컨테이너가 소유한다 — 옛 h-[62px]는 고정 높이로
           패딩 역할까지 겸해, 구조상 여백의 주인이 두 곳으로 갈려 있었다(2026-08-19 교정).
           액션(수정·케밥)이 붙는 헤더라 32 · 아래 gap 12 (Web_Design.md §Spacing) -->
      <div
        class="mb-3 flex min-h-8 shrink-0 items-center justify-between gap-3"
      >
        <div class="flex min-w-0 items-center gap-2">
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
          >
            상담 정보
          </Typography>
          <!-- 케이스 코드는 여기(패널 머리 배지)가 아니라 아래 정보 그리드 첫 행에 둔다
               (2026-08-26 개정). 배지 형태는 **목록에서 카드를 식별할 때만** 쓴다 —
               상세는 이미 그 케이스 안이라 식별이 아니라 조회 대상 속성이고,
               속성은 다른 값들과 같은 레이블+데이터 규격으로 읽히는 편이 맞다. -->
        </div>
        {#if canEditCase}
          <!-- hover 영역이 패널 패딩 안에 머물도록 음수 마진 없음 -->
          <div class="flex items-center">
            <button
              type="button"
              aria-label="수정"
              onclick={openEditModal}
              class="inline-flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <!-- 아이콘 + 레이블 (embedded 변형과 동일 구성) -->
              <EditIcon />
              <span class="text-body-02-normal-medium">수정</span>
            </button>

            {#if caseMenuItems.length > 0}
              <div class="shrink-0">
                <KebabMenu items={caseMenuItems} size={20} />
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if canEditCase}
      <div class="mb-3 flex min-h-8 shrink-0 items-center justify-end">
        <button
          type="button"
          aria-label="수정"
          onclick={openEditModal}
          class="inline-flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <EditIcon />
          <span class="text-body-02-normal-medium">수정</span>
        </button>

        {#if caseMenuItems.length > 0}
          <div class="shrink-0">
            <KebabMenu items={caseMenuItems} size={20} />
          </div>
        {/if}
      </div>
    {/if}

    <!-- 헤더 아래 전체 콘텐츠를 하나의 스크롤 영역으로 (회기만 따로 스크롤하지 않음) -->
    <ScrollFadeArea bounceArrow deps={[counselingSessions, clientStats]}>
      <!-- 상태 고지 → 정보 그리드 12(그룹 내부 간격) -->
      {#if caseStatusNotice}
        <div class="mb-3 flex min-h-5 items-center">
          <Typography
            variant="body-01-normal-medium"
            color={caseStatusNotice.color}
          >
            {caseStatusNotice.text}
          </Typography>
        </div>
      {/if}
      <!-- 레이블↔값 24(gap-x-6) / 행 간 12(gap-y-3) — 우측 회기 카드와 동일 -->
      <div
        class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
      >
        <!-- 상담 코드 — 식별자라 정보 그리드 맨 위 -->
        {#if counselingDetail.case_code}
          <div class="flex min-h-5 items-center">
            <Typography variant="body-01-normal-regular" color="text-gray-600">
              상담 코드
            </Typography>
          </div>
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              color="text-body-strong"
            >
              {counselingDetail.case_code}
            </Typography>
          </div>
        {/if}
        <!-- 프로그램 -->
        <div class="flex min-h-5 items-center">
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            프로그램
          </Typography>
        </div>
        <div class="flex min-h-5 items-center">
          <!-- 개인(individual)은 프로그램명만 — 헤더/일지의 표기(breadcrumbTitle)와 통일.
               그룹일 때만 유형을 덧붙인다 -->
          <Typography variant="body-01-normal-regular" color="text-body-strong">
            {counselingDetail.program_name}{counselingDetail.case_type ===
            'individual'
              ? ''
              : ' - 그룹'}
          </Typography>
        </div>
        <!-- 담당자 -->
        <div class="flex min-h-5 items-center">
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            담당자
          </Typography>
        </div>
        <div class="flex min-h-5 items-center">
          <!-- 2명 이상일 때만 주담당을 왕관으로 구분 (1명이면 구분할 대상이 없다) -->
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            {#each orderedCounselors as counselor, idx}
              {@const isPrimary =
                counselor.counselor_id === counselingDetail.counselor_id}
              <div class="flex items-center gap-1">
                {#if isPrimary && orderedCounselors.length > 1}
                  <CrownActiveYellowIcon20 />
                {/if}
                <button
                  class={twMerge(
                    'flex items-center',
                    $isCounselor ? 'cursor-default!' : ''
                  )}
                  onclick={() =>
                    !$isCounselor && goToMemberDetail(counselor.counselor_id)}
                >
                  <Typography
                    variant="body-01-normal-regular"
                    color="text-body-strong"
                    className={!$isCounselor
                      ? 'underline underline-offset-2 decoration-gray-300 transition-colors hover:text-primary-500 hover:decoration-primary-500'
                      : ''}
                  >
                    {isSecretMode
                      ? maskName(counselor.counselor_name)
                      : counselor.counselor_name}
                  </Typography>
                </button>
                {#if idx < orderedCounselors.length - 1}
                  <span class="ml-1 text-gray-300">·</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
        <!-- 진행률 — 상담 카드와 같은 라벨·순서(프로그램·담당자·진행률·시작일·완료일).
             계약 관점: 총 N회 중 n회 진행 -->
        <div class="flex min-h-5 items-center">
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            진행률
          </Typography>
        </div>
        <div class="flex min-h-5 items-center gap-1.5">
          <Typography variant="body-01-normal-regular" color="text-body-strong">
            {openSessionCount}/{counselingDetail.total_sessions}회
          </Typography>
        </div>
        <!-- 시작일 -->
        <div class="flex min-h-5 items-center">
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            시작일
          </Typography>
        </div>
        <div class="flex min-h-5 items-center">
          <Typography variant="body-01-normal-regular" color="text-body-strong">
            {formatUtcToKst(
              counselingDetail.first_session_start,
              'YYYY-MM-DD (d) HH:mm'
            )}
          </Typography>
        </div>
        <!-- 종결일 — 종결된 케이스에만 노출한다.
             진행중에 '-'로 상시 세워두면 빈 값이 정보처럼 자리만 차지하고,
             정작 종결됐을 때의 신호도 다른 속성 행에 묻힌다 -->
        {#if counselingDetail.completed_at}
          <div class="flex min-h-5 items-center">
            <Typography variant="body-01-normal-regular" color="text-gray-600">
              종결일
            </Typography>
          </div>
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              color="text-body-strong"
            >
              {formatUtcToKst(
                counselingDetail.completed_at,
                'YYYY-MM-DD (d) HH:mm'
              )}
            </Typography>
          </div>
        {/if}
      </div>
      <!-- 완료일 ↔ 내담자 구분선 (위아래 28px) -->
      <!-- 상담 정보 ↔ 내담자 구분선 (위아래 24 — 좌측 패널 구분선 공통) -->
      <div class="my-6 h-px bg-border-default"></div>
      <!-- 내담자 섹션 -->
      {#if clientStats.length > 0}
        <div class="pb-4">
          <!-- 액션 없는 텍스트 전용 헤더 = Title M 영역 높이 24 · 아래 gap 16 -->
          <div class="mb-4 flex h-6 items-center gap-1.5">
            <Typography
              variant="title-01-normal-semibold"
              color="text-title-default"
            >
              내담자
            </Typography>
            <Typography variant="body-03-normal-regular" color="text-gray-600">
              {clientStats.length}
            </Typography>
          </div>
          <!-- 접기/더보기 없이 전부 노출 — 넘치는 분량은 패널 전체 스크롤(ScrollFadeArea)이 처리 -->
          <div class="space-y-2">
            {#each clientStats as stat (stat.clientId)}
              {@render clientCard(stat)}
            {/each}
          </div>
        </div>
      {/if}
      <!-- 회기 섹션 -->
      {#if showSessions}
        <div class="pt-4">
          <div class="mb-3 flex h-8 items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-900"
              >
                회기
              </Typography>
              <Typography variant="body-03-regular" color="text-gray-600">
                {counselingSessions.length}
              </Typography>
            </div>
            {#if canEditCase}
              <div class="flex items-center gap-1">
                <button
                  class="flex items-center gap-2 px-2 py-1 rounded-lg text-action-primary hover:bg-gray-50 transition-colors"
                  onclick={openSessionCreateModal}
                >
                  <PlusIcon20 />
                  <Typography variant="body-02-regular" color="text-gray-500">
                    추가
                  </Typography>
                </button>
              </div>
            {/if}
          </div>

          <div class="space-y-2">
            {#each sortedSessions as session (session.session_id)}
              <SessionListItem
                {session}
                isSelected={selectedSessionId === session.session_id}
                fieldNoteStatus={fieldNoteStatusMap.get(session.schedule_id) ??
                  null}
                onClick={handleSessionClick}
              />
            {/each}
          </div>
        </div>
      {/if}
    </ScrollFadeArea>

    <!-- AI 경과 분석 진입 — 스크롤 밖 하단 고정.
         경과 분석은 회기 목록의 형제가 아니라 케이스 전체를 다른 렌즈로 보는 것이라
         우측 탭이 아니라 '문'으로 연다(CaseAnalysisModal). 스크롤 안에 두면 내담자가
         많은 케이스에서 끝까지 내려야 보이므로, 어느 위치에서도 같은 자리에 둔다.
         구분선은 두지 않는다 — 버튼 자신이 틴트 면을 갖고 있어 이미 스크롤 영역과
         갈리고, 헤어라인까지 더하면 경계가 두 겹이 된다(2026-09-02).
         위 여백 16은 mt-4가 소유하고, 아래 24는 패널 컨테이너 pb-6이 소유한다.
         면이 곧 성격이다(§Colors>AI) — 분석 전·실패는 **실행 버튼**이라 틴트 면
         (.bg-ai-gradient-subtle), 결과가 생긴 뒤(분석 중·완료)는 **AI 결과 카드** 정본인
         ai-50 면 + ai-500 라인. 같은 버튼이 두 일을 하니 상태는 우측 슬롯이 말한다
         (완료·분석 중·실패). 버튼은 §button Large 한 벌 — 높이 48 · 좌우 20 · 레이블
         Body_01(16) · 아이콘 20 · gap 8. 높이 고정이라 상태가 바뀌어도 패널 하단이
         들썩이지 않는다. radius 8(카드 16 ⊃ 버튼 8). -->
    {#if onOpenAnalysis}
      <div class="mt-4 shrink-0">
        <button
          type="button"
          onclick={() => onOpenAnalysis?.()}
          class="flex h-12 w-full items-center gap-2 rounded-lg px-5 text-body-01-normal-medium text-ai-500 transition-colors {isAnalysisDone ||
          isAnalysisRunning
            ? 'border border-ai-500 bg-ai-50 hover:bg-ai-100'
            : 'bg-ai-gradient-subtle hover:text-ai-600'}"
        >
          <AiStarIcon20 />
          AI 경과 분석
          {#if isAnalysisDone}
            <span
              class="ml-auto shrink-0 text-body-03-normal-medium text-state-done-text"
            >
              완료
            </span>
          {:else if isAnalysisRunning}
            <span
              class="ml-auto flex shrink-0 items-center gap-2 text-body-03-normal-medium text-body-subtle"
            >
              <span
                class="h-3 w-3 animate-spin rounded-full border-2 border-ai-200 border-t-ai-500"
              ></span>
              분석 중
            </span>
          {:else if isAnalysisFailed}
            <span
              class="ml-auto shrink-0 text-body-03-normal-medium text-state-canceled-text"
            >
              실패
            </span>
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>
