<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import InlineJournalEditor from './InlineJournalEditor.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import StackCounselingIcon102 from '$lib/assets/StackCounselingIcon102.svelte'
  import type {
    CounselingSession,
    CaseClient,
    SessionStatus,
    SessionParticipant
  } from '$lib/types/counseling'

  type ClientBillingEntry = {
    state: 'none' | 'pending' | 'completed'
    billableId?: string
    source?: 'case' | 'session'
  }
  import { formatUtcToKst } from '../../utils/date'
  import KebabIcon20 from '../../assets/KebabIcon20.svelte'
  import SessionStatusText from './SessionStatusText.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ArrowBackIcon24 from '../../assets/ArrowBackIcon24.svelte'
  import Tooltip from '../common/Tooltip.svelte'
  import FieldNoteFloatingSheet from './field-note/FieldNoteFloatingSheet.svelte'
  import type { FieldNoteService } from '$lib/features/field-note/field-note-service'
  import {
    getCenterNotePreference,
    getFieldNoteBySchedule
  } from '../../hooks/actions/field-note.action'
  import { buildFieldNoteBySchedule } from '$lib/features/field-note/query-builders'
  import {
    formatDuration,
    mapToEntryStatus
  } from '$lib/features/field-note/view-model'
  import { queryBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'

  interface Props {
    session?: CounselingSession | null
    caseStatus?: string
    isSecretMode: boolean
    fieldNoteService?: FieldNoteService
    onStatusChange?: (sessionId: string, status: SessionStatus) => void
    onEditSession?: (session: CounselingSession) => void
    onDeleteSession?: (session: CounselingSession) => void
    onAttendanceChange?: (sessionParticipantId: string, status: string) => void
    onEditNoShow?: (client: SessionParticipant) => void
    caseClients?: CaseClient[]
    onAddClientToSession?: (session: CounselingSession) => void
    clientBillingMap?: Record<string, ClientBillingEntry>
    canWriteBilling?: boolean
    canReadBilling?: boolean
    onCreateBillingForClient?: (client: SessionParticipant) => void
    onViewBillingForClient?: (client: SessionParticipant) => void
    /** 회기 목록으로 돌아가기 */
    onBack?: () => void
    /** 탭 컨테이너 안에 놓일 때 — 껍데기(카드 외곽)를 컨테이너에 넘긴다 */
    embedded?: boolean
    /** false면 열람 전용 — 부담당(공동 상담사)은 회기 수정·출결 변경을 할 수 없다 */
    canEdit?: boolean
  }

  let {
    session,
    caseStatus,
    isSecretMode,
    fieldNoteService,
    onBack,
    onStatusChange,
    onEditSession,
    onDeleteSession,
    onAttendanceChange,
    onEditNoShow,
    caseClients,
    onAddClientToSession,
    clientBillingMap = {},
    canWriteBilling = false,
    canReadBilling = false,
    onCreateBillingForClient,
    onViewBillingForClient,
    canEdit = true,
    embedded = false
  }: Props = $props()

  const canAddClient = $derived(
    canEdit && (caseClients?.length ?? 0) > (session?.clients?.length ?? 0)
  )

  // ── 좌측 내담자 리스트 + 우측 인라인 일지 ──────────────────────
  // 정렬: 가나다 (모달/카드와 동일)
  const sortedClients = $derived(
    (session?.clients ?? [])
      .slice()
      .sort((a, b) =>
        a.participant_name.localeCompare(b.participant_name, 'ko')
      )
  )
  // 참여자 바는 항상 렌더한다 — 칩(누구의 일지인가)과 출결을 함께 담기 때문에
  // 참여자가 1명이어도 존재 이유가 있다(옛 '일지 상단바'를 흡수했다).

  // 선택 키 = participant_id (note.client_id와 매칭). 세션 전환 시 첫 참여자로 리셋.
  let selectedClientId = $state('')
  // 에디터 ref — 전환/이탈 전 flush() 호출용
  let editorRef = $state<InlineJournalEditor | null>(null)

  // 출석 배지 색상 (ClientActionCard 동일) + 책갈피 탭용 색(paper/dot)
  const ATTENDANCE_BADGE: Record<
    string,
    { label: string; chip: string; paper: string; dot: string }
  > = {
    scheduled: {
      label: '미확인',
      chip: 'bg-white border-gray-200 text-gray-600',
      paper: 'bg-gray-50',
      dot: 'bg-gray-300'
    },
    attended: {
      label: '참석',
      chip: 'bg-white border-etc-green-yellow text-etc-green-yellow',
      paper: 'bg-lime-50',
      dot: 'bg-tag-green-fg'
    },
    absent: {
      label: '취소',
      chip: 'bg-white border-etc-red text-etc-red',
      paper: 'bg-status-danger-bg',
      dot: 'bg-etc-red'
    },
    no_show: {
      label: '노쇼',
      chip: 'bg-white border-orange-300 text-orange-600',
      paper: 'bg-orange-50',
      dot: 'bg-orange-400'
    }
  }

  // 좌측 리스트에서 내담자 선택: 현재 폼 flush 후 전환 (중복 저장 방지)
  async function handleSelectClient(participantId: string) {
    if (participantId === selectedClientId) return
    await editorRef?.flush()
    selectedClientId = participantId
  }

  // ── 출결 세그먼트 (옛 일지 상단바에서 참여자 바로 이동) ────────
  const selectedClient = $derived(
    sortedClients.find((c) => c.participant_id === selectedClientId) ?? null
  )
  // 예정 회기 = 출결이 아직 성립하지 않은 회기. 저장된 출결값이 남아 있어도
  // (레거시 데이터·되돌리기 잔재) 전부 미확정으로 본다.
  const attendanceStatus = $derived(
    session?.status === 'scheduled'
      ? 'scheduled'
      : (selectedClient?.attendance_status ?? '')
  )
  const ATTENDANCE_CONFIRMED = ['attended', 'absent', 'no_show']
  const isUnconfirmed = $derived(
    !!selectedClient &&
      canEdit &&
      !ATTENDANCE_CONFIRMED.includes(attendanceStatus)
  )
  // 아직 시작하지 않은 회기 — 출석은 '회기가 진행되어야' 성립하는 개념이라
  // 시작 전에는 출결 선택을 열지 않는다.
  const isBeforeStart = $derived.by(() => {
    if (!session?.start) return false
    const start = new Date(session.start)
    if (isNaN(start.getTime())) return false
    return start.getTime() > Date.now()
  })
  const ATTENDANCE_SEGMENTS: {
    value: string
    label: string
    activeText: string
  }[] = [
    { value: 'attended', label: '참석', activeText: 'text-etc-green-yellow' },
    { value: 'absent', label: '취소', activeText: 'text-etc-red' },
    { value: 'no_show', label: '노쇼', activeText: 'text-orange-600' }
  ]
  function handleAttendanceSegment(value: string) {
    // 비교도 정규화값으로 — 예정 회기에 남아 있던 옛 값과 같은 항목을 골라도 확정으로 처리
    if (!selectedClient || value === attendanceStatus) return
    onAttendanceChange?.(selectedClient.session_participant_id, value)
  }

  // 취소된 회기는 카드(SessionListSection)와 동일하게 헤더 타이틀도 dim 처리
  const isCancelledSession = $derived(session?.status === 'cancelled')

  // 종결된 케이스는 회기 편집을 잠근다 — 단 '되돌리기'만은 남긴다.
  // 잘못 취소·완료한 회기를 고치려고 케이스를 재개했다 다시 종결하는 우회가 생기기 때문.
  // (2026-08-19 결정. 편집·삭제는 종결 상태에서 계속 차단)
  const isCaseClosed = $derived(caseStatus === 'completed')

  // 더보기 드롭다운
  let isDropdownOpen = $state(false)

  // 완료·노쇼·취소 회기는 청구·차감·일지의 앵커라 직접 수정 불가 — 되돌리기 후 수정 안내
  const sessionEditLockedLabel = $derived.by(() => {
    if (!session || session.status === 'scheduled') return null
    const prefix =
      session.status === 'completed'
        ? '완료된 회기예요'
        : session.status === 'no_show'
          ? '노쇼 처리된 회기예요'
          : '취소된 회기예요'
    return `${prefix} — 되돌리기 후 수정할 수 있어요`
  })

  // 필드노트 모드 상태
  let isFieldNoteMode = $state(false)
  const scheduleId = $derived(session?.schedule_id ?? '')

  // 세션 헤더에 필드노트 상태 뱃지를 보여주기 위한 쿼리 (fieldNoteService가 있을 때만)
  const fieldNoteStatusQuery = queryBuilder(
    getFieldNoteBySchedule,
    () => buildFieldNoteBySchedule($centerId, scheduleId),
    () => ({
      enabled: !!$centerId && !!scheduleId && !!fieldNoteService,
      // 헤더 뱃지용이라 자주 폴링할 필요 없음 — 수동 invalidate에 맡김
      refetchOnMount: 'always' as const,
      // 비필수 뱃지용 — 에러가 세션 상세 렌더를 깨지 않게 차단
      throwOnError: false,
      retry: false
    })
  )

  // 일지 문서 맨 위 블록에 넘길 상태 — 녹음 자체가 없으면 블록을 띄우지 않는다.
  // 판정은 검사 상세와 공유한다(view-model.mapToEntryStatus).
  const fieldNoteStatus = $derived(
    mapToEntryStatus(fieldNoteStatusQuery.data as any)
  )
  const fieldNoteDurationLabel = $derived.by(() => {
    const data = fieldNoteStatusQuery.data as any
    const seconds = data?.total_duration
    return seconds ? formatDuration(seconds) : ''
  })
  // 필드노트 표시명 = "필드노트 {note_number}" — 전문가앱 목록과 같은 규칙.
  // 번호가 없는(회기 미지정 등) 노트는 번호를 지어내지 않고 총칭으로 부른다.
  const fieldNoteName = $derived.by(() => {
    const n = (fieldNoteStatusQuery.data as any)?.note_number
    return n != null ? `필드노트 ${n}` : '이 회기 녹음'
  })

  // 세션 변경 시 부가 UI 초기화 (필드노트 모드 / 더보기 드롭다운)
  let prevSessionId = $state<string | null>(null)

  $effect(() => {
    if (!session) return
    if (prevSessionId !== session.session_id) {
      isDropdownOpen = false
      isFieldNoteMode = false
      prevSessionId = session.session_id
    }
  })

  // 선택 내담자 보정: 비어있거나 현재 세션에 없으면 첫 참여자로.
  // 값이 실제로 바뀔 때만 할당해 effect 자기재실행(루프)을 막는다.
  $effect(() => {
    const ids = sortedClients.map((c) => c.participant_id)
    const valid = !!selectedClientId && ids.includes(selectedClientId)
    if (!valid) {
      const next = sortedClients[0]?.participant_id ?? ''
      if (next !== selectedClientId) selectedClientId = next
    }
  })

  // 시트는 탭을 지정해 열 수 있다 — 문서 상단 '초안 생성'은 AI 분석 탭으로 연다
  // (생성 CTA는 서식 선택·크레딧 게이팅과 함께 시트가 계속 소유한다)
  // 초안 생성은 필드노트 id 와 센터 기본 서식이 필요하다 — 둘 다 여기 있으므로
  // 저널 에디터엔 '돌려주는 함수'만 내려보낸다(에디터가 API를 직접 알지 않게)
  const fieldNoteId = $derived(
    ((fieldNoteStatusQuery.data as any)?.id as string | undefined) ?? null
  )
  const notePreferenceQuery = queryBuilder(
    getCenterNotePreference,
    () => ({ centerId: $centerId ?? '' }),
    () => ({ enabled: !!$centerId && !!fieldNoteService, throwOnError: false })
  )
  const defaultTemplateType = $derived(
    (notePreferenceQuery.data as any)?.default_template_type ?? undefined
  )

  async function handleGenerateNoteDraft(): Promise<Record<
    string,
    any
  > | null> {
    const sessionId = session?.session_id
    if (!fieldNoteService || !fieldNoteId || !sessionId) return null
    const draft = await fieldNoteService.generateCounselingNoteDraft(
      fieldNoteId,
      sessionId,
      defaultTemplateType
    )
    return (draft?.content as Record<string, any>) ?? null
  }

  let fieldNoteInitialTab = $state<'transcript' | 'memo' | 'analysis'>(
    'transcript'
  )
  function handleOpenFieldNote(
    tab: 'transcript' | 'memo' | 'analysis' = 'transcript'
  ) {
    fieldNoteInitialTab = tab
    isFieldNoteMode = true
  }
  function handleCloseFieldNote() {
    isFieldNoteMode = false
  }

  function handleStatusChange(value: string) {
    if (session) {
      onStatusChange?.(session.session_id, value as SessionStatus)
    }
  }

  const attendanceEditable = $derived(canEdit)
</script>

<div
  class="flex xl:min-h-0 w-full min-w-0 flex-1 flex-col bg-white {embedded
    ? ''
    : 'xl:rounded-2xl xl:border xl:border-gray-200'}"
>
  {#if session}
    <!-- 기본 세션 상세 모드 -->
    <!-- 세션 상세 헤더 -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 px-6 py-3 md:py-0 md:h-[58px] gap-2 md:gap-0"
    >
      <!-- 좌측: 뒤로가기 + 뱃지 + 날짜 -->
      <div class="flex items-center gap-2 min-w-0">
        {#if onBack}
          <button
            type="button"
            onclick={() => onBack?.()}
            aria-label="회기 목록"
            class="-ml-1 rounded-lg p-1 transition-colors hover:bg-gray-100"
          >
            <ArrowBackIcon24 />
          </button>
        {/if}
        <!-- 회기 목록 헤더('진행중인 회기')와 동일한 18(title-01-normal-semibold).
             옛 body-01(16) + xl에서만 18로 키우던 반응형 분기는 폐기 -->
        <Typography
          variant="title-01-normal-semibold"
          color={isCancelledSession ? 'text-gray-400' : 'text-gray-900'}
          className="truncate-safe"
        >
          {formatUtcToKst(session?.start, 'YYYY-MM-DD (d) HH:mm')} ~ {formatUtcToKst(
            session?.end,
            'HH:mm'
          )}
        </Typography>
        <!-- 회기 상태 = 텍스트 표기(케이스 상태 배지보다 한 위계 아래).
             session.status를 그대로 쓴다 — 참석 상태로 보정(deriveSessionDisplayStatus)하면
             사용자가 조작한 값과 화면이 어긋난다: 참석만 눌러도 완료로 보이고,
             예정으로 되돌려도 완료로 남는다.
             취소만 예외로 배지 — 일정 취소 배지 공통 규격
             (Rectangle S · tag-red, Web_Design.md §Components>badge) -->
        <!-- 장소 = 회기 속성이라 여기 산다(옛 일지 상단바에서 이동).
             프로그램명은 좌측 상담 정보 패널이 이미 소유하므로 중복하지 않는다 -->
        {#if session.room_name}
          <Typography
            variant="body-01-normal-regular"
            color="text-body-default"
            className="truncate-safe min-w-0"
          >
            {session.room_name}
          </Typography>
        {/if}
        {#if isCancelledSession}
          <span class="ml-2 shrink-0">
            <BadgeRectangle label="취소" color="red" size="sm" />
          </span>
        {:else}
          <SessionStatusText status={session.status} class="ml-2" />
        {/if}
      </div>
      <!-- 우측: 액션 버튼 -->
      <div class="flex items-center gap-2 shrink-0 self-end md:self-auto">
        <!-- 완료/취소 세그먼트 제거 —
             완료는 참석 확정 시 자동 전환(getSuggestedSessionStatus)이,
             취소·되돌리기는 더보기 메뉴가 담당한다 -->
        {#if canEdit}
          <!-- 더보기 메뉴 -->
          <div class="relative">
            <Tooltip text="더보기">
              <button
                type="button"
                aria-label="더보기"
                onclick={() => (isDropdownOpen = !isDropdownOpen)}
                class="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <KebabIcon20 color="currentColor" />
              </button>
            </Tooltip>
            {#if isDropdownOpen}
              <!-- backdrop -->
              <button
                type="button"
                class="fixed inset-0 z-10"
                aria-label="메뉴 닫기"
                onclick={() => (isDropdownOpen = false)}
              ></button>
              <div class="dropdown-panel absolute top-full right-0 z-20 mt-1">
                {#if session.status !== 'scheduled'}
                  <!-- 완료·취소·노쇼 회기를 예정으로 복구. 회기 수정이 잠기는 상태라
                       ("되돌리기 후 수정할 수 있어요") 그 안내와 짝이 되는 진입점이다.
                       어디로 돌아가는지는 레이블이 아니라 확인 모달이 밝힌다. -->
                  <button
                    type="button"
                    class="dropdown-item"
                    onclick={() => {
                      isDropdownOpen = false
                      handleStatusChange('scheduled')
                    }}
                  >
                    예정으로 되돌리기
                  </button>
                  {#if !isCaseClosed}
                    <div class="dropdown-divider"></div>
                  {/if}
                {/if}
                {#if session.status === 'scheduled'}
                  <!-- 순서 = 상태 전이(완료·취소) → (구분선) → 수정 → (구분선) → 삭제.
                       구분선은 같은 축끼리 묶는 장치다 — 완료·취소는 둘 다
                       handleStatusChange를 부르는 한 축이므로 사이를 가르지 않는다
                       ('예정으로 되돌리기'가 비-예정 회기에서 독립 그룹인 것과 같은 규칙).
                       상태 전이 두 항목은 '회기 완료'·'회기 취소'로 주어를 함께 달아
                       같은 축임을 라벨에서도 드러낸다(단독 '취소'는 메뉴 닫기로 읽힌다).
                       아래 편집·삭제 항목은 주어 없이 짧게 둔다. -->
                  <!-- 완료 전이 — 미확인 참여자는 서비스의 역방향 연동이 '참석'으로 일괄 처리한다 -->
                  <button
                    type="button"
                    class="dropdown-item"
                    onclick={() => {
                      isDropdownOpen = false
                      handleStatusChange('completed')
                    }}
                  >
                    회기 완료
                  </button>
                  <!-- 취소 진입점 — 헤더 세그먼트를 없앤 대신 여기로 옮겼다 -->
                  <button
                    type="button"
                    class="dropdown-item"
                    onclick={() => {
                      isDropdownOpen = false
                      handleStatusChange('cancelled')
                    }}
                  >
                    회기 취소
                  </button>
                  <!-- 내용 편집 — 종결된 케이스에서는 잠긴다(상태 전이만 허용).
                       종결이면 아래 삭제도 함께 잠기므로 구분선도 같이 감춘다 -->
                  {#if !isCaseClosed}
                    <div class="dropdown-divider"></div>
                    <button
                      type="button"
                      class="dropdown-item"
                      onclick={() => {
                        isDropdownOpen = false
                        if (session) onEditSession?.(session)
                      }}
                    >
                      수정
                    </button>
                    <div class="dropdown-divider"></div>
                  {/if}
                {/if}
                <!-- 예정이 아닌 회기(완료·취소·노쇼)에는 수정·취소를 딤드로 남기지 않고
                     아예 노출하지 않는다 — 되돌린 뒤에 쓰는 흐름이라 위 '예정으로 되돌리기'가 안내 역할.
                     종결 케이스에서는 삭제도 잠긴다(되돌리기만 허용) -->
                {#if !isCaseClosed}
                  <button
                    type="button"
                    class="dropdown-item is-danger"
                    onclick={() => {
                      isDropdownOpen = false
                      if (session) onDeleteSession?.(session)
                    }}
                  >
                    삭제
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    <!-- 참여자 바 — 칩(누구의 일지인가) + 출결. 옛 '일지 상단바'를 흡수했다.
         출결이 선택된 칩과 같은 줄에 있어 칩의 상태 점과 인과가 보인다 -->
    {#if sortedClients.length > 0}
      <div
        class="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-6 py-3"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {#each sortedClients as c (c.participant_id)}
            <!-- 예정 회기는 출결이 성립하지 않는다 — 저장값이 남아 있어도 미확인 색으로 -->
            {@const att =
              ATTENDANCE_BADGE[
                session.status === 'scheduled'
                  ? 'scheduled'
                  : c.attendance_status
              ] ?? ATTENDANCE_BADGE.scheduled}
            {@const active = c.participant_id === selectedClientId}
            {@const cc = (caseClients ?? []).find(
              (x) => x.client_id === c.participant_id
            )}
            <button
              type="button"
              onclick={() => handleSelectClient(c.participant_id)}
              class="flex h-11 shrink-0 items-center gap-2 rounded-full border pl-[10px] pr-3 transition-colors {active
                ? 'border-border-active bg-brand-subtle'
                : 'border-gray-200 bg-white hover:bg-gray-50'}"
            >
              <ClientAvatar
                profileImageUrl={cc?.profile_image_url ?? null}
                name={isSecretMode
                  ? c.participant_name.replace(/./g, '○')
                  : c.participant_name}
                gender={cc?.gender}
                sizeClass="h-6 w-6"
                textClass="text-caption-01-normal-medium"
              />
              <span
                class="whitespace-nowrap leading-none text-body-02-normal-medium {active
                  ? 'text-border-active'
                  : 'text-gray-700'}"
              >
                {isSecretMode
                  ? c.participant_name.replace(/./g, '○')
                  : c.participant_name}
              </span>
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {att.dot}"></span>
            </button>
          {/each}
          {#if canAddClient && session.status === 'scheduled'}
            <button
              type="button"
              onclick={() => session && onAddClientToSession?.(session)}
              class="mr-1 flex h-11 shrink-0 items-center gap-2 rounded-full border border-dashed border-border-strong px-3 text-body-02-normal-medium text-action-primary transition-colors hover:border-icon-secondary hover:text-action-primary-hover"
            >
              <!-- 높이 44 = 내담자 칩과 동일. 아이콘은 공용 에셋(PlusIcon20) -->
              <PlusIcon20 />
              추가
            </button>
          {/if}
        </div>

        <!-- 출결 세그먼트 — 노출 조건은 옛 상단바와 동일하다.
           미확인·시작 전에는 본문 전체 안내가 담당하므로 여기서는 숨긴다 -->
        {#if selectedClient && !isUnconfirmed && !isBeforeStart}
          <!-- 세그먼트 컨트롤 — 간격은 4px 그리드로 통일(§Spacing: 2px 금지).
               트랙 패딩 6 · 알약 간 4 → 트랙 높이 48(알약 36 + 6·2).
               알약은 60×36 고정 — 라벨 길이(참석·취소·노쇼)와 무관하게 폭이 같아야 세그먼트로 읽힌다.
               radius는 중첩 규칙(바깥>안쪽): 트랙 12 ⊃ 알약 8. -->
          <div
            class="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gray-50 p-1.5"
          >
            {#each ATTENDANCE_SEGMENTS as seg (seg.value)}
              <button
                type="button"
                disabled={!canEdit}
                onclick={() => handleAttendanceSegment(seg.value)}
                class="h-9 w-15 rounded-lg text-body-03-normal-medium transition-colors disabled:cursor-not-allowed {attendanceStatus ===
                seg.value
                  ? `bg-white shadow-sm ${seg.activeText}`
                  : 'text-gray-500 hover:text-gray-700'}"
              >
                {seg.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- 본문: 인라인 일지 / 출석 확인 -->
    <div class="flex min-h-0 flex-1">
      <section class="flex min-h-0 min-w-0 flex-1 flex-col">
        {#if !canEdit}
          <!-- 상담일지는 작성자(주담당)만 열람 — 부담당은 회기 정보까지만 본다 -->
          <div
            class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <Typography variant="body-01-normal-medium" color="text-gray-600">
              상담일지는 주담당 상담사만 볼 수 있어요
            </Typography>
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              공동 상담사는 회기 정보만 열람할 수 있어요
            </Typography>
          </div>
        {:else if sortedClients.length === 0}
          <!-- 참여자가 없는 회기 — 일지를 쓸 대상이 없다.
               녹음은 회기 자산이라 참여자와 무관하게 존재할 수 있으므로 진입점을 남긴다
               (옛 헤더 버튼이 담당하던 경로). 빈 상태 규격 = 아이콘 → 타이틀 24 → 서브 12 -->
          <div
            class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-10 pt-30"
          >
            <StackCounselingIcon102 />
            <Typography
              variant="title-01-normal-semibold"
              color="text-body-strong"
              className="mt-6 block"
            >
              이 회기에 참여한 내담자가 없어요
            </Typography>
            <Typography
              variant="body-02-normal-regular"
              color="text-body-subtle"
              className="mt-3 block text-center"
            >
              내담자를 추가하면 상담일지를 작성할 수 있어요.
            </Typography>
            {#if fieldNoteService && scheduleId && fieldNoteStatus !== 'none'}
              <button
                type="button"
                class="mt-6 h-10 rounded-lg border border-gray-200 bg-white px-4 text-body-02-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
                onclick={() => handleOpenFieldNote()}
              >
                이 회기 녹음 보기
              </button>
            {/if}
          </div>
        {:else}
          <InlineJournalEditor
            bind:this={editorRef}
            {session}
            caseClients={caseClients ?? []}
            {selectedClientId}
            {isSecretMode}
            {attendanceEditable}
            {onAttendanceChange}
            {onEditNoShow}
            fieldNoteStatus={fieldNoteService ? fieldNoteStatus : 'none'}
            {fieldNoteDurationLabel}
            {fieldNoteName}
            onOpenFieldNote={fieldNoteService && scheduleId
              ? handleOpenFieldNote
              : undefined}
            onGenerateNoteDraft={fieldNoteService && fieldNoteId
              ? handleGenerateNoteDraft
              : undefined}
            billingState={clientBillingMap[selectedClientId]?.state ?? 'none'}
            billingSource={clientBillingMap[selectedClientId]?.source}
            {canWriteBilling}
            {canReadBilling}
            onCreateBilling={() => {
              const c = sortedClients.find(
                (x) => x.participant_id === selectedClientId
              )
              if (c) onCreateBillingForClient?.(c)
            }}
            onViewBilling={() => {
              const c = sortedClients.find(
                (x) => x.participant_id === selectedClientId
              )
              if (c) onViewBillingForClient?.(c)
            }}
          />
        {/if}
      </section>
    </div>
  {/if}
</div>

{#if isFieldNoteMode && fieldNoteService && scheduleId && session}
  {@const participantCandidates = [
    ...(session?.counselors ?? []).map((c) => c.counselor_name).filter(Boolean),
    ...(session?.clients ?? []).map((c) => c.participant_name).filter(Boolean)
  ]}
  <FieldNoteFloatingSheet
    {scheduleId}
    service={fieldNoteService}
    {participantCandidates}
    initialTab={fieldNoteInitialTab}
    onClose={handleCloseFieldNote}
  />
{/if}
