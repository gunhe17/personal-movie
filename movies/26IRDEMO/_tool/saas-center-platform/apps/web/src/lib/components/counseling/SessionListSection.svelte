<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import SessionStatusText from './SessionStatusText.svelte'
  import FieldNoteBadge from './FieldNoteBadge.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import CheckCircleMintIcon20 from '$lib/assets/CheckCircleMintIcon20.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import SessionExtensionBanner from './SessionExtensionBanner.svelte'
  import type { CounselingSession } from '$lib/types/counseling'
  import { deriveSessionDisplayStatus } from '$lib/features/counseling/session-display'
  import { formatUtcToKst } from '../../utils/date'

  interface Props {
    sessions: CounselingSession[]
    onSelect?: (sessionId: string) => void
    onAddSession?: () => void
    /** 케이스 상태 — 종결/재개 메뉴 분기용 */
    caseStatus?: string
    showBanner?: boolean
    /** 'upcoming' 예고(예정 1~2건) · 'review' 결정(예정 0 + 완료 있음) */
    bannerStage?: 'upcoming' | 'review'
    bannerDays?: number
    onBannerDismiss?: () => void
    onBannerTerminate?: () => void
    /** 쓸 수 있는 필드노트가 달린 schedule_id 집합 (녹음 완료분만) */
    fieldNoteScheduleIds?: Set<string>
    /** 이미 청구된 session_id 집합 — 카드 하단에 청구 완료로 표시 */
    billedSessionIds?: Set<string>
    /** 탭 컨테이너 안에 놓일 때 — 껍데기(카드 외곽)와 제목 행을 컨테이너에 넘긴다 */
    embedded?: boolean
  }

  let {
    sessions,
    onSelect,
    onAddSession,
    caseStatus,
    showBanner = false,
    bannerStage = 'upcoming',
    bannerDays = 0,
    onBannerDismiss,
    onBannerTerminate,
    fieldNoteScheduleIds = new Set<string>(),
    billedSessionIds = new Set<string>(),
    embedded = false
  }: Props = $props()

  // 종결·취소된 케이스에선 '진행중인 회기'가 사실과 어긋난다 — 완료된 진행으로 시제를 바꾼다
  const isCaseClosed = $derived(
    caseStatus === 'completed' || caseStatus === 'cancelled'
  )

  // 예정(scheduled)을 위로, 그 외(완료/취소/노쇼)는 아래로. 각 그룹은 백엔드 시간순 유지.
  // 참석 토글로만 노쇼 처리된 회기(session.status=scheduled)도 아래로 내리도록 표시 상태 기준.
  const sortedSessions = $derived.by(() => {
    const scheduled = sessions.filter(
      (s) => deriveSessionDisplayStatus(s) === 'scheduled'
    )
    const others = sessions.filter(
      (s) => deriveSessionDisplayStatus(s) !== 'scheduled'
    )
    return [...scheduled, ...others]
  })
</script>

<div
  class="flex min-h-0 w-full flex-1 flex-col {embedded
    ? ''
    : 'rounded-2xl border border-gray-200 bg-white'}"
>
  <!-- 헤더 58 — 회기 상세(SessionDetailPanel)의 헤더와 같은 높이라 목록↔상세 전환에
       타이틀 줄이 제자리에 있다. embedded도 그린다: 옛 탭바(회기 목록/경과 분석)가
       이 자리를 대신하던 때만 숨겼고, 탭이 사라진 지금은 컨테이너에 제목이 없어진다. -->
  <div
    class="flex h-[58px] shrink-0 items-center justify-between border-b border-gray-200 px-6"
  >
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      {isCaseClosed ? '진행한 회기' : '진행중인 회기'}
    </Typography>
  </div>

  <!-- 상단 여백: 배너가 있으면 20(헤더↔배너), 없으면(전체 타이틀이 첫 요소) 16 -->
  <div
    class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 {showBanner
      ? 'pt-5'
      : 'pt-4'}"
  >
    {#if showBanner}
      <!-- 배너 아래 16 -->
      <div class="mb-4">
        <SessionExtensionBanner
          stage={bannerStage}
          daysUntil={bannerDays}
          onDismiss={() => onBannerDismiss?.()}
          onAddSession={() => onAddSession?.()}
          onTerminate={() => onBannerTerminate?.()}
        />
      </div>
    {/if}

    <!-- 전체 카운트 + 회기 추가 (한 컨테이너).
         상단 여백은 스크롤 영역의 pt-4 / 배너의 mb-4가 담당해 어느 경우든 16 —
         여기에 py-3의 상단 12가 더해지면 28이 되므로 pb-3만 남긴다.
         행 높이 40 고정 — 종결 케이스는 '회기 추가'가 빠지는데, 높이를 버튼에 맡기면
         버튼 유무로 행이 40↔24로 달라져 같은 pt-4에도 위 여백이 좁아 보인다
         (좌측 패널 섹션 헤더 32 고정과 같은 규칙) -->
    <div class="flex min-h-10 items-center justify-between pb-3">
      <Typography variant="body-01-normal-medium" color="text-body-default">
        총 {sessions.length}개의 회기가 있어요
      </Typography>
      {#if onAddSession}
        <!-- 컨테이너 안의 추가 버튼 = button-tertiary(Gray solid, Web_Design.md §Components).
             bg gray-100 · 텍스트 gray-600 · hover bg gray-200.
             primary solid는 페이지 우상단 메인 CTA(PageActionButton) 전용 —
             패널 안에서 쓰면 페이지 CTA와 같은 급으로 읽힌다.
             아이콘은 currentColor라 텍스트 색을 따라간다 -->
        <button
          type="button"
          onclick={() => onAddSession?.()}
          class="inline-flex h-10 w-[110px] items-center justify-center gap-2 rounded-lg bg-gray-100 text-body-02-normal-medium text-title-subtitle transition-colors hover:bg-gray-200"
        >
          <PlusIcon20 />
          회기 추가
        </button>
      {/if}
    </div>

    <!-- 회기 카드 목록 -->
    <div class="grid grid-cols-2 gap-3">
      {#each sortedSessions as session (session.session_id)}
        {@const isCancelled = session.status === 'cancelled'}
        <button
          type="button"
          onclick={() => onSelect?.(session.session_id)}
          class="flex w-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-primary-300 hover:bg-gray-50"
        >
          <!-- 1행: 타이틀(회기 배지·날짜·시간) ↔ 회기 상태.
               상태는 타이틀과 같은 선상 우측 — 카드가 '무엇/언제 · 어떤 상태'로 한 줄에 읽힌다 -->
          <div class="flex min-w-0 items-center justify-between gap-4">
            <!-- 회기 배지 → 날짜 타이틀 → 시간. 간격 8(gap-2).
                 items-center = 배지(박스)와 텍스트를 세로 중앙으로 맞춘다
                 (baseline은 박스인 배지가 글자 밑선에 걸려 떠 보인다).
                 배지는 정보 라벨이라 Rectangle. -->
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <BadgeRectangle label="{session.session_number}회기" />
              <Typography
                variant="title-01-normal-semibold"
                color={isCancelled ? 'text-body-subtle' : 'text-title-default'}
                className={isCancelled ? 'line-through' : ''}
                tag="span"
              >
                {formatUtcToKst(session.start, 'YYYY. MM. DD (d)')}
              </Typography>
              <Typography
                variant="body-01-normal-regular"
                color={isCancelled ? 'text-body-subtle' : 'text-body-default'}
                className="whitespace-nowrap {isCancelled
                  ? 'line-through'
                  : ''}"
                tag="span"
              >
                {formatUtcToKst(session.start, 'HH:mm')} - {formatUtcToKst(
                  session.end,
                  'HH:mm'
                )}
              </Typography>
              {#if session.schedule_id && fieldNoteScheduleIds.has(session.schedule_id)}
                <!-- 필드노트는 '이 회기에 무엇이 딸려 있나'라 회기 배지·시간과 같은 줄 -->
                <FieldNoteBadge />
              {/if}
            </div>
            <!-- session.status 그대로 — 참석 상태로 보정하지 않는다 -->
            <SessionStatusText status={session.status} />
          </div>

          <!-- 2행: 레이블+데이터. 타이틀↔데이터 16, 데이터↔구분선↔데이터 12 -->
          <div class="mt-4 flex flex-col gap-3">
            <!-- 레이블+데이터(가로형) — 카드 안이라 행 간 8
                 (Web_Design.md §Layout > 레이블+데이터).
                 레이블 열은 제일 긴 레이블('담당자')에 맞춘 48 고정 — 구분선으로 블록이
                 갈려도 데이터 시작선이 한 줄로 유지돼야 한다(auto면 블록마다 폭이 따로 계산됨) -->
            <div
              class="grid min-w-0 grid-cols-[48px_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-2"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
                tag="span"
              >
                담당자
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-body-strong"
                className="truncate-safe"
                tag="span"
              >
                {session.counselors?.map((c) => c.counselor_name).join(', ') ||
                  '-'}
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
                tag="span"
              >
                장소
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-body-strong"
                className="truncate-safe"
                tag="span"
              >
                {session.room_name || '-'}
              </Typography>
            </div>
            <!-- 청구는 회기 자체의 속성이 아니라 정산 결과 — 구분선으로 한 단 끊는다.
                 청구 전에도 행을 비우지 않는다: 상태에 따라 카드 골격이 달라지면
                 나란히 놓인 카드들의 밑선이 어긋난다(값만 갈린다) -->
            <div class="border-t border-border-subtle"></div>
            <div
              class="grid min-w-0 grid-cols-[48px_1fr] auto-rows-[20px] items-center gap-x-6"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
                tag="span"
              >
                청구
              </Typography>
              {#if billedSessionIds.has(session.session_id)}
                <!-- 상담 카드(cards/CounselingCard)의 청구 완료 표기와 동일 조합 —
                     민트 체크 20 + Body_02/Regular. 아이콘↔텍스트 8(§Spacing) -->
                <span class="flex min-w-0 items-center gap-2">
                  <CheckCircleMintIcon20 />
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-900"
                    tag="span"
                  >
                    청구 완료
                  </Typography>
                </span>
              {:else}
                <!-- 아직 청구되지 않음 — 값이 비어 있는 게 아니라 '전' 단계라
                     고스트(gray-400)가 아닌 보조 값 색을 쓴다(§table 셀 텍스트) -->
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                  tag="span"
                >
                  청구 전
                </Typography>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>
