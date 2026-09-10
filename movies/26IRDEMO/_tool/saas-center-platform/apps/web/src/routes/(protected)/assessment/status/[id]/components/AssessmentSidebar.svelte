<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type {
    AssessmentItem,
    CaseDetailVM
  } from '$lib/features/assessment/status-detail/types'
  import Switch from '$root/src/lib/components/Switch.svelte'
  import { goto } from '$app/navigation'
  import BillingActionButton from '$lib/features/billing/components/BillingActionButton.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  // 날짜·위치 = Figma Icon_20 세트의 calendar / place 한 쌍
  // (옛 ScheduleIcon 아웃라인 캘린더 · RoomIcon 라인 문 아이콘 대체)
  import CalendarIcon20 from '$lib/assets/CalendarIcon20.svelte'
  import SpotIcon20 from '$lib/assets/SpotIcon20.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import ChildIcon from '$root/src/lib/assets/profileIcon/ChildIcon.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'

  let {
    caseId,
    clientVM,
    isSecretMode = $bindable(false),
    assessments,
    selectedAssessment,
    onSelectAssessment,
    onSendResult,
    onWriteReport,
    onToggleFinalReport,
    onAddSchedule,
    onRevertSchedule,
    onCancelSchedule,
    onEditCase,
    onDeleteCase,
    billingState = 'none',
    canWriteBilling = false,
    canReadBilling = false,
    onCreateBilling,
    onViewBilling,
    overlay = false,
    canEdit = true
  } = $props<{
    caseId: string
    clientVM: CaseDetailVM
    isSecretMode: boolean
    assessments: AssessmentItem[]
    selectedAssessment: AssessmentItem | null
    onSelectAssessment: (assessment: AssessmentItem) => void
    onSendResult: () => void
    onWriteReport?: () => void
    onToggleFinalReport?: (
      enabled: boolean
    ) => Promise<boolean | void> | boolean | void
    /** 일정 추가 클릭 시 */
    onAddSchedule?: () => void
    /** 일정 취소 되돌리기 클릭 시 */
    onRevertSchedule?: () => void
    /** 일정 취소하기 클릭 시 */
    onCancelSchedule?: () => void
    /** 검사 정보 수정 클릭 시 */
    onEditCase?: () => void
    /** 케밥(수정 버튼 우측) — 검사 삭제 */
    onDeleteCase?: () => void
    /** 청구 상태 (none | pending | completed) */
    billingState?: 'none' | 'pending' | 'completed'
    canWriteBilling?: boolean
    canReadBilling?: boolean
    /** 청구하기 클릭 시 */
    onCreateBilling?: () => void
    /** 청구서 보기 클릭 시 */
    onViewBilling?: () => void
    /** 오버레이 모드 (태블릿 슬라이드 패널) */
    overlay?: boolean
    /** false면 열람 전용 — 부담당(참여 검사자)은 케이스·일정을 수정할 수 없다 */
    canEdit?: boolean
  }>()

  // 부담당(참여 검사자)은 열람만 — 서버도 주담당에게만 수정을 허용한다
  const isEditDisabled = $derived(
    !canEdit || ['completed', 'cancelled'].includes(clientVM.caseStatus)
  )
  // 청구 버튼 노출 여부 (BillingActionButton이 실제로 렌더되는 조건과 일치)
  const showBilling = $derived(
    billingState === 'completed' ||
      (billingState === 'pending' && canReadBilling) ||
      (billingState === 'none' && canWriteBilling)
  )
  let isReportEnabled = $state(false)

  $effect(() => {
    isReportEnabled = clientVM.requireFinalReport
  })

  async function handleReportToggle() {
    const nextValue = isReportEnabled
    const result = await onToggleFinalReport?.(nextValue)
    if (result === false) {
      isReportEnabled = !nextValue
    }
  }

  // 프로필 아바타 (내담자 성별 tint + 아동 아바타)
  const isMale = $derived(clientVM.genderLabel === '남')
  const isFemale = $derived(clientVM.genderLabel === '여')

  // 검사 정보 케밥 = 삭제 — '수정'은 옆에 버튼으로 노출돼 있어 넣지 않는다
  const caseMenuItems = $derived(
    onDeleteCase && canEdit
      ? [
          {
            label: '삭제',
            onClick: () => onDeleteCase?.(),
            variant: 'danger' as const
          }
        ]
      : []
  )

  // 검사 일정 더보기 메뉴 (일정 변경 / 일정 취소 / 취소 되돌리기) — 아이콘 없이 텍스트만
  const scheduleMenuItems = $derived.by(() => {
    const items: { label: string; onClick: () => void }[] = []
    if (isEditDisabled) return items
    const schedule = clientVM.schedule
    if (schedule && !schedule.isCancelled) {
      if (onAddSchedule)
        items.push({ label: '일정 변경', onClick: onAddSchedule })
      if (onCancelSchedule && schedule.sessionId)
        items.push({ label: '일정 취소', onClick: onCancelSchedule })
    } else if (schedule?.isCancelled) {
      if (onRevertSchedule && schedule.sessionId)
        items.push({ label: '취소 되돌리기', onClick: onRevertSchedule })
    }
    return items
  })
</script>

<!-- 왼쪽: 내담자 정보 -->
<!-- 프로필 + 기본정보는 고정 헤더, 그 아래(검사 일정~목록)만 스크롤 -->
<div
  class="flex min-h-0 flex-col {overlay
    ? 'w-full flex-1'
    : 'w-[var(--spacing-detail-side)] shrink-0 rounded-2xl border border-gray-200'} bg-white p-6 overflow-y-auto"
>
  <!-- 프로필: 아바타 + 이름 / 생년월일 | 성별 (높이 54) -->
  <div class="flex items-center gap-3 pb-6">
    <div
      class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full {isMale
        ? 'bg-blue-50'
        : isFemale
          ? 'bg-status-danger-bg'
          : 'bg-gray-100'}"
    >
      {#if clientVM.profileImageUrl}
        <img
          src={clientVM.profileImageUrl}
          alt={clientVM.maskedName}
          class="h-full w-full object-cover"
        />
      {:else}
        <ChildIcon className="h-full w-full" />
      {/if}
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        class="w-fit text-left focus:outline-none focus:ring-0"
        onclick={() => goto(`/clients/${clientVM.clientId}`)}
      >
        <Typography
          variant="title-01-reading-semibold"
          tag="span"
          color="text-title-default"
          className="underline decoration-1 underline-offset-4 decoration-gray-300 transition-colors hover:text-primary-500 hover:decoration-primary-500"
        >
          {clientVM.maskedName}
        </Typography>
      </button>
      <div class="flex items-center gap-1.5">
        <Typography
          variant="body-01-normal-regular"
          tag="span"
          color="text-body-default"
        >
          {clientVM.maskedBirthDate}
        </Typography>
        {#if clientVM.genderLabel}
          <Typography
            variant="body-01-normal-regular"
            tag="span"
            color="text-gray-300"
          >
            |
          </Typography>
          <Typography
            variant="body-01-normal-regular"
            tag="span"
            color="text-body-default"
          >
            {clientVM.genderLabel}
          </Typography>
        {/if}
      </div>
    </div>
  </div>

  <!-- 프로필 하단 구분선: 컨테이너 좌우 패딩(p-6=24)을 관통해 폭 전체를 채운다 -->
  <hr class="-mx-6 border-t border-gray-100" />

  <!-- 검사 일정~정보: 스크롤 영역 (위/아래 fade·화살표) -->
  <ScrollFadeArea class="-mx-5 px-5" bounceArrow deps={[clientVM, showBilling]}>
    <!-- 검사 정보 -->
    <div class="pt-4">
      <div class="flex h-8 items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <Typography
            variant="title-01-normal-semibold"
            tag="span"
            color="text-gray-800">검사 정보</Typography
          >
          <!-- 케이스 코드는 여기(섹션 머리 배지)가 아니라 아래 정보 그리드 첫 행에 둔다
               (2026-08-26 개정). 배지 형태는 **목록에서 카드를 식별할 때만** 쓴다 —
               상세는 이미 그 케이스 안이라 식별이 아니라 조회 대상 속성이고,
               속성은 다른 값들과 같은 레이블+데이터 규격으로 읽히는 편이 맞다. -->
        </div>
        <!-- 수정 + 더보기는 한 묶음 — justify-between이 둘을 양끝으로 벌리지 않도록 감싼다.
             각 버튼이 패딩 8을 가지므로 그룹 gap은 0(시각 간격 16). -->
        <div class="flex shrink-0 items-center">
          <button
            type="button"
            disabled={isEditDisabled}
            onclick={() => onEditCase?.()}
            aria-label="수정"
            class="inline-flex items-center gap-2 rounded-lg p-2 transition-colors {isEditDisabled
              ? 'cursor-not-allowed text-gray-400 opacity-30'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700'}"
          >
            <!-- 아이콘 + 레이블 (상담 정보 패널과 동일 구성) -->
            <EditIcon />
            <span class="text-body-02-normal-medium">수정</span>
          </button>

          {#if caseMenuItems.length > 0}
            <div class="shrink-0">
              <KebabMenu items={caseMenuItems} size={20} />
            </div>
          {/if}
        </div>
      </div>

      <!-- 검사 항목 / 담당자 / 완료일 (기관·완료일은 값 있을 때만) -->
      <!-- 레이블+데이터(가로형, 텍스트 레이블) — Web_Design.md §Layout.
           레이블 열은 가장 넓은 레이블에 맞춰 auto(옛 w-28 고정은 실제 글자 뒤로
           40px 넘게 남아 규격 24를 훌쩍 넘었다) · 레이블↔값 24 · 행 높이 20 · 행 간 12 -->
      <div class="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
        <!-- 검사 코드 — 식별자라 정보 그리드 맨 위 -->
        {#if clientVM.caseCode}
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-title-subtitle"
            >
              검사 코드
            </Typography>
          </div>
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-body-strong"
            >
              {clientVM.caseCode}
            </Typography>
          </div>
        {/if}
        {#if clientVM.institutionName}
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-title-subtitle"
            >
              기관/단체
            </Typography>
          </div>
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-body-strong"
            >
              {clientVM.institutionName}
            </Typography>
          </div>
        {/if}

        <!-- 라벨을 24 높이 상자에 세로 가운데로 둔다 — 값의 첫 줄이 '세트' 배지 행(h-6=24)
             이거나 Reading 행간(150%=24)이라, 라벨을 16 행상자로 두면 4~5px 위로 뜬다 -->
        <div class="flex h-6 items-center self-start">
          <Typography
            variant="body-01-normal-regular"
            tag="span"
            color="text-title-subtitle">검사 항목</Typography
          >
        </div>
        <div class="flex min-w-0 flex-col gap-1 self-start">
          {#if clientVM.assessmentSetName}
            <!-- 검사 세트: 세트명(북마크) + 하위 검사 목록 설명 -->
            <div class="flex items-center gap-1.5">
              <BadgeRectangle
                label="세트"
                color="orange"
                outlined
                size="sm"
                class="border-border-default"
              />
              <Typography
                variant="body-01-normal-medium"
                tag="span"
                color="text-title-default"
              >
                {clientVM.assessmentSetName}
              </Typography>
            </div>
            {#if clientVM.assessmentItemNames}
              <Typography
                variant="body-01-reading-regular"
                tag="span"
                color="text-body-default"
                className="break-words"
              >
                {clientVM.assessmentItemNames}
              </Typography>
            {/if}
          {:else}
            <Typography
              variant="body-01-reading-regular"
              tag="span"
              color={clientVM.assessmentItemNames
                ? 'text-body-default'
                : 'text-gray-300'}
              className="break-words"
            >
              {clientVM.assessmentItemNames || '선택된 검사 항목이 없습니다'}
            </Typography>
          {/if}
        </div>

        <div class="flex min-h-5 items-center">
          <Typography
            variant="body-01-normal-regular"
            tag="span"
            color="text-title-subtitle"
          >
            담당자
          </Typography>
        </div>
        <div class="flex min-h-5 min-w-0 items-center">
          {#if clientVM.specialistName}
            <button
              type="button"
              class="flex items-center gap-1.5 text-left focus:outline-none focus:ring-0 py-0 min-w-0"
              onclick={() => goto(`/member/${clientVM.specialistId}`)}
            >
              <Typography
                variant="body-01-normal-regular"
                tag="span"
                color="text-body-strong"
                className="underline underline-offset-4 decoration-gray-300 transition-colors hover:text-primary-500 hover:decoration-primary-500 min-w-0"
              >
                {clientVM.specialistName}
              </Typography>
            </button>
          {:else}
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-gray-300"
            >
              담당자가 아직 배정되지 않았습니다
            </Typography>
          {/if}
        </div>

        <!-- 완료일: 완료 전에는 값이 없다 — 빈 행('-')을 남기지 않고 행 자체를 감춘다 -->
        {#if clientVM.completedAtLabel}
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-title-subtitle">완료일</Typography
            >
          </div>
          <div class="flex min-h-5 items-center">
            <Typography
              variant="body-01-normal-regular"
              tag="span"
              color="text-body-strong"
            >
              {clientVM.completedAtLabel}
            </Typography>
          </div>
        {/if}
      </div>
    </div>

    <!-- 종합 보고서 섹션 (잠시 비노출) -->
    {#if false}
      <div class="border-b border-gray-100 py-5">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class="flex h-6 w-6 items-center justify-center rounded bg-orange-100"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2h10v10H2V2z" fill="#F97316" opacity="0.3" />
                <path
                  d="M4 5h6M4 7h6M4 9h4"
                  stroke="#F97316"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <Typography
              variant="body-01-semibold"
              tag="span"
              color="text-body-strong"
            >
              종합 보고서
            </Typography>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="text-body-02-normal-medium {isReportEnabled
                ? 'text-primary-500'
                : 'text-gray-400'}"
            >
              {isReportEnabled ? '작성 해요' : '작성 안해요'}
            </span>
            <Switch
              bind:checked={isReportEnabled}
              ariaLabel="종합 보고서 작성 여부"
              onclick={handleReportToggle}
            />
          </div>
        </div>
        <button
          class="flex w-full h-11 items-center justify-center gap-2 rounded-lg transition-colors {isReportEnabled
            ? 'border border-primary-500 bg-white text-primary-500 hover:bg-primary-50'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
          onclick={isReportEnabled ? onWriteReport : undefined}
          disabled={!isReportEnabled}
        >
          {#if !isReportEnabled}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12.667 7.333H3.333A1.333 1.333 0 002 8.667v4.666a1.333 1.333 0 001.333 1.334h9.334A1.333 1.333 0 0014 13.333V8.667a1.333 1.333 0 00-1.333-1.334z"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M4.667 7.333V4.667a3.333 3.333 0 116.666 0v2.666"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}
          <span class="text-body-01-normal-medium">종합 보고서 작성</span>
        </button>
      </div>
    {/if}

    <!-- 검사 일정 -->
    <!-- 검사 정보와의 사이는 구분선 없이 여백만 36 (사용자 결정 2026-08-19).
         구분선을 뺀 만큼 규격값 28보다 키워 섹션 경계를 여백으로만 세운다.
         여백은 이 섹션만 소유한다 — 앞 섹션에도 pb를 주면 36+36으로 합산된다 -->
    <div class="mt-9 pb-5">
      <!-- 섹션 헤더 행 = 높이 32 고정. 액션(케밥·수정) 유무로 행 높이가 달라지면
           아래 16 간격이 섹션마다 다르게 읽힌다 -->
      <div class="flex h-8 items-center justify-between gap-2">
        <Typography
          variant="title-01-normal-semibold"
          tag="span"
          color="text-gray-800">검사 일정</Typography
        >
        {#if scheduleMenuItems.length > 0}
          <div class="shrink-0">
            <KebabMenu items={scheduleMenuItems} size={20} />
          </div>
        {/if}
      </div>

      {#if clientVM.schedule?.isCancelled}
        <!-- 취소된 일정 표시 -->
        <div class="mt-3 rounded-lg bg-bg-base p-4">
          <div class="flex items-center gap-2">
            <CalendarIcon20 />
            <Typography
              variant="body-01-normal-medium"
              tag="span"
              color="text-gray-500"
              className="line-through"
            >
              {clientVM.schedule.dateTimeLabel}
            </Typography>
            <!-- Rectangle S (24 · Label_01/Medium 13) + 취소 컬러(tag-red)
                 — Web_Design.md §Components>badge. 옛 rounded-full·text-xs 하드코딩 폐기 -->
            <BadgeRectangle
              label="취소"
              color="red"
              size="sm"
              class="ml-auto"
            />
          </div>
          {#if clientVM.schedule.roomName}
            <div class="mt-3 flex items-center gap-2">
              <SpotIcon20 />
              <Typography
                variant="body-01-normal-medium"
                tag="span"
                color="text-body-default"
              >
                {clientVM.schedule.roomName}
              </Typography>
            </div>
          {/if}
          {#if clientVM.schedule.cancelReason}
            <div class="mt-2 flex gap-1.5 pl-0.5">
              <Typography
                variant="body-02-regular"
                tag="span"
                color="text-gray-500"
                className="shrink-0"
              >
                취소 사유:
              </Typography>
              <Typography
                variant="body-02-regular"
                tag="span"
                color="text-gray-600"
                className="break-all"
              >
                {clientVM.schedule.cancelReason}
              </Typography>
            </div>
          {/if}
        </div>
      {:else if clientVM.schedule}
        <!-- 정상 일정 표시 -->
        <div class="mt-3 rounded-lg bg-bg-base p-4">
          <div class="flex items-center gap-2">
            <CalendarIcon20 />
            <Typography
              variant="body-01-normal-medium"
              tag="span"
              color="text-body-default"
            >
              {clientVM.schedule.dateTimeLabel}
            </Typography>
          </div>
          {#if clientVM.schedule.roomName}
            <div class="mt-3 flex items-center gap-2">
              <SpotIcon20 />
              <Typography
                variant="body-01-normal-medium"
                tag="span"
                color="text-body-default"
              >
                {clientVM.schedule.roomName}
              </Typography>
            </div>
          {/if}
        </div>
      {:else if !isEditDisabled && onAddSchedule}
        <button
          type="button"
          onclick={onAddSchedule}
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary-300 bg-primary-50/40 px-3.5 py-3 text-primary-500 transition-colors hover:bg-primary-50 hover:border-primary-400"
        >
          <!-- 날짜 아이콘 = 일정 카드와 동일한 CalendarIcon20 에셋 (네이티브 20) -->
          <span class="flex shrink-0" aria-hidden="true">
            <CalendarIcon20 />
          </span>
          <Typography
            variant="body-02-medium"
            tag="span"
            color="text-primary-500"
          >
            일정 추가
          </Typography>
        </button>
      {:else}
        <div
          class="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-3.5 py-3"
        >
          <div class="flex items-center gap-2">
            <!-- 날짜 아이콘 = 일정 카드와 동일한 CalendarIcon20 에셋 (네이티브 20).
                 듀오톤 자체가 옅은 회색이라 빈 상태에서도 별도 감광이 필요 없다 -->
            <span class="flex shrink-0" aria-hidden="true">
              <CalendarIcon20 />
            </span>
            <Typography
              variant="body-02-regular"
              tag="span"
              color="text-gray-300"
            >
              검사 일정이 아직 배정되지 않았습니다
            </Typography>
          </div>
        </div>
      {/if}

      <!-- 청구하기 (일정 카드 하단, 풀폭) -->
      {#if showBilling}
        <div class="mt-3">
          <BillingActionButton
            state={billingState}
            canWrite={canWriteBilling}
            canRead={canReadBilling}
            onCreate={() => onCreateBilling?.()}
            onView={() => onViewBilling?.()}
            size="md"
            className="w-full"
          />
        </div>
      {/if}
    </div>
  </ScrollFadeArea>
</div>
