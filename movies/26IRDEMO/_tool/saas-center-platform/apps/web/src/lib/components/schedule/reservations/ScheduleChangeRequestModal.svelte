<script lang="ts">
  /**
   * 일정 변경 요청 상세 — 내담자 앱에서 올라온 요청을 자세히 보고 그 자리에서 승인·반려한다.
   * 대시보드 확인 요청 배너에서 항목을 누르면 열린다(배너 한 줄에는 담기지 않는
   * 담당·프로그램·사유까지 보여주는 것이 이 모달의 몫).
   *
   * 승인·반려는 예약 현황 화면과 **같은 서비스**(reservations-service)를 쓴다 —
   * 확인 팝업·반려 사유 입력·invalidate가 두 화면에서 갈라지지 않게.
   */
  import Typography from '@common/components/Typography.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import ArrowAllIcon24 from '$lib/assets/ArrowAllIcon24.svelte'
  import { formatUtcToKst } from '$lib/utils/date'
  import type { ScheduleChangeRequestItem } from '$lib/hooks/actions/schedule.action'

  interface Props {
    request: ScheduleChangeRequestItem
    /** true를 돌려주면 처리된 것으로 보고 모달을 닫는다 */
    onApprove: (requestId: string) => Promise<boolean>
    onReject: (requestId: string) => Promise<boolean>
    closeModal?: () => void
  }

  let { request, onApprove, onReject, closeModal = () => {} }: Props = $props()

  let busy = $state(false)

  /** 2026.09.24 (수) 14:00 - 14:50 */
  const period = (start: string, end: string) =>
    `${formatUtcToKst(start, 'YYYY.MM.DD (d) HH:mm')} - ${formatUtcToKst(end, 'HH:mm')}`

  const currentPeriod = $derived(
    period(request.current_start, request.current_end)
  )
  const requestedPeriod = $derived(
    period(request.requested_start, request.requested_end)
  )

  /** 놀이치료-2회기 — 회기는 프로그램에 붙는 서수라 별도 행으로 뜯지 않는다 */
  const programLabel = $derived.by(() => {
    if (!request.program_name) return '-'
    if (request.session_number == null) return request.program_name
    return `${request.program_name}-${request.session_number}회기`
  })

  async function run(action: (id: string) => Promise<boolean>) {
    if (busy) return
    busy = true
    try {
      if (await action(request.id)) closeModal()
    } finally {
      busy = false
    }
  }

  // §Components>레이블+데이터(가로형) — 라벨 열은 가장 긴 라벨에 맞춘 auto,
  // 라벨↔값 gap 24, 행 높이 20(min-h-5 + items-center), 행↔행 12.
  // 옛 `grid-cols-[80px_1fr] gap-4`(고정 80 · 간격 16)는 규격 밖이었다.
  const GRID = 'grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3'
  const CELL = 'flex min-h-5 items-center'
</script>

<!-- §modal 규격 — 폭 md(640) · header 좌우20/상하16 · body 상·좌·우 20 하 28(푸터 동반) ·
     footer 좌우·하 20 상 16(BaseModal 기본) -->
<BaseModal {closeModal} size="md" headerClass="px-5 py-4" bodyClass="p-5 pb-7">
  {#snippet header()}
    <Typography
      variant="headline-02-normal-semibold"
      color="text-body-strong"
      tag="h2"
    >
      일정 변경 요청
    </Typography>
  {/snippet}

  {#snippet body()}
    <!-- 누구의 어떤 일정인지 — 면 없이 라벨+데이터 목록만.
         면을 씌우면 아래 '변경 내용' 블록과 같은 급의 카드로 읽혀 위계가 사라진다. -->
    <div class={GRID}>
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className={CELL}>내담자</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-body-strong"
        className={CELL}>{request.client_name ?? '-'}</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className={CELL}>프로그램</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-body-strong"
        className={CELL}>{programLabel}</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className={CELL}>담당자</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-body-strong"
        className={CELL}>{request.counselor_name ?? '-'}</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className={CELL}>장소</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-body-strong"
        className={CELL}>{request.room_name ?? '-'}</Typography
      >
    </div>

    <!-- 기존 → 변경 → 사유 = 한 영역. 바뀌는 값과 그 이유는 같은 사건이라 면을 나누지 않는다.
         면은 브랜드 틴트 배경 토큰(bg/brand-subtle = primary-500 6%) — 중립 회색 well이
         아니라 '요청'이라는 브랜드 맥락의 블록이다. -->
    <div class="mt-6 rounded-2xl bg-brand-subtle p-4 pt-6">
      <!-- 라벨(기존·변경 요청) 없이 값만 — 위아래 두 날짜를 잇는 화살표가 이미
           '무엇이 무엇으로'를 말한다. 라벨을 두면 같은 말을 두 번 한다.
           라벨이 빠지면서 정렬 기준도 사라지므로 세 조각 모두 면 안에서 가운데.
           크기는 한 단계 위(Body_01 16 → Title_01 18) — 이 블록의 값이 모달의 주인공이다. -->
      <div class="flex flex-col items-center gap-3">
        <Typography variant="title-01-normal-regular" color="text-body-default">
          {currentPeriod}
        </Typography>
        <!-- 듀오톤 이중 화살촉(Figma Icon_24 Arrow_all, node 3592:274886) -->
        <ArrowAllIcon24 />
        <Typography variant="title-01-normal-medium" color="text-primary-500">
          {requestedPeriod}
        </Typography>
      </div>

      {#if request.reason}
        <!-- 내담자가 적어 보낸 사유 — 같은 면 안에서 구분선으로만 가른다 -->
        <div class="mt-6 space-y-3 border-t border-border-default pt-6">
          <Typography variant="body-02-normal-medium" color="text-gray-600">
            요청 사유
          </Typography>
          <Typography
            variant="body-01-reading-regular"
            color="text-body-strong"
            className="whitespace-pre-line"
          >
            {request.reason}
          </Typography>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      disabled={busy}
      onclick={() => run(onReject)}
      class="flex h-11 items-center justify-center rounded-lg border border-red-200 px-4 text-body-02-normal-medium text-status-danger transition-colors hover:border-transparent hover:bg-status-danger-bg disabled:text-gray-400"
    >
      반려
    </button>
    <button
      type="button"
      disabled={busy}
      onclick={() => run(onApprove)}
      class="flex h-11 items-center justify-center rounded-lg bg-primary-500 px-4 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled"
    >
      승인
    </button>
  {/snippet}
</BaseModal>
