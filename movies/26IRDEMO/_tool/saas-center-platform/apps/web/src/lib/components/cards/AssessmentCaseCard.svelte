<script lang="ts">
  /**
   * 검사 케이스 카드 — 3블록 구조.
   * "정체(내담자) / 검사·진행률(앵커) / 메타·행동" 세 덩어리.
   * 리스트 뷰가 전수 필드를 담당하므로 카드는 정체·상태·다음 행동만 싣는다.
   */
  import { goto } from '$app/navigation'
  import { twMerge } from 'tailwind-merge'

  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import type { CaseData } from '../../types/assessmentStatus'
  import {
    STATUS_API_MAP,
    formatBirthDate,
    formatScheduleDate,
    formatScheduleTime,
    calcScheduleDDay
  } from '../../types/assessmentStatus'
  import StatusBadge from '../assessment/StatusBadge.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '../ClientAvatar.svelte'
  import ClientBirthGender from '../common/ClientBirthGender.svelte'
  import BadgeRectangle from '../common/BadgeRectangle.svelte'
  import Tooltip from '../common/Tooltip.svelte'
  import KebabMenu from '../assessment/cells/KebabMenu.svelte'
  import CheckCircleMintIcon20 from '$lib/assets/CheckCircleMintIcon20.svelte'
  import { HIDE_SEND_LINK_AND_RESULT_FOR_BETA } from '$lib/features/assessment/status/constants'

  interface Props {
    caseInfo: CaseData
    onEdit?: (caseInfo: CaseData) => void
    onDelete?: (caseInfo: CaseData) => void
    onBilling?: (caseInfo: CaseData) => void
    /** 청구 권한(write:billing) — 없으면 청구하기 버튼 미노출 */
    canBill?: boolean
    canSendLink?: boolean
    class?: string
    hasOnlineLink?: boolean
    selected?: boolean
    onSelect?: (id: string, selected: boolean) => void
    onSendLink?: (caseInfo: CaseData) => void
    onSendResult?: (caseInfo: CaseData) => void
    onViewHistory?: (caseInfo: CaseData) => void
    onCancel?: (caseInfo: CaseData) => void
    onRollbackCancel?: (caseInfo: CaseData) => void
    onComplete?: (caseInfo: CaseData) => void
    onRollbackComplete?: (caseInfo: CaseData) => void
  }

  let {
    caseInfo,
    onEdit,
    onComplete,
    onRollbackComplete,
    onDelete,
    onBilling,
    canBill = false,
    canSendLink = false,
    hasOnlineLink = false,
    onSendLink,
    class: className
  }: Props = $props()

  // ===== 정체 =====
  const client = $derived(caseInfo.clients?.[0])
  const clientCount = $derived(caseInfo.clients?.length ?? 0)
  const clientName = $derived(client?.name ?? '')
  const clientDisplayName = $derived(
    clientName ? ($isSecretMode ? maskName(clientName) : clientName) : '-'
  )
  // 단체 케이스에서만 접수기관을 노출한다 (개인은 항상 비어 빈 행이 됨)
  const isOrganization = $derived(
    ['group', 'organization'].includes(
      String(caseInfo.case_type || '').toLowerCase()
    )
  )

  // ===== 앵커: 검사 + 진행 =====
  // 세트 = '세트' 배지 + 세트명 / 단일검사 = 첫 검사명 + '외 N건'
  const assessmentNames = $derived(
    caseInfo.assessment_names?.length
      ? caseInfo.assessment_names
      : (caseInfo.assessments?.map((a) => a.kor_name) ?? [])
  )
  const isSet = $derived(!!caseInfo.set_name)
  const assessmentLabel = $derived(
    caseInfo.set_name || assessmentNames[0] || '-'
  )
  const assessmentExtra = $derived(
    isSet ? 0 : Math.max(assessmentNames.length - 1, 0)
  )
  const done = $derived(caseInfo.completed_count ?? 0)
  const total = $derived(caseInfo.total_count ?? 0)
  const isFull = $derived(total > 0 && done >= total)
  const percent = $derived(
    total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0
  )

  // ===== 메타 =====
  const dDay = $derived(calcScheduleDDay(caseInfo.scheduled_start))
  const isPastSchedule = $derived(dDay?.startsWith('D+') ?? false)
  const scheduleLabel = $derived(
    caseInfo.scheduled_start
      ? `${formatScheduleDate(caseInfo.scheduled_start)} ${formatScheduleTime(caseInfo.scheduled_start)}`
      : null
  )

  // ===== 하단 CTA 슬롯 =====
  // 청구할 게 없으면 '청구 완료' 표기가 같은 자리를 채운다.
  const rowStatus = $derived(
    STATUS_API_MAP[caseInfo.status || ''] ??
      STATUS_API_MAP[(caseInfo.status || '').toUpperCase()] ??
      'pending'
  )
  const wantsBilling = $derived(!!caseInfo.has_uninvoiced_sessions && canBill)
  const showSendLink = $derived(
    !HIDE_SEND_LINK_AND_RESULT_FOR_BETA &&
      canSendLink &&
      hasOnlineLink &&
      !!onSendLink &&
      rowStatus !== 'cancelled'
  )

  type CtaKind = 'billing' | null
  const cta = $derived.by<CtaKind>(() => {
    if (rowStatus === 'cancelled') return null
    if (wantsBilling) return 'billing'
    return null
  })
  // 하단 슬롯(액션 버튼 또는 청구 완료 표기)이 렌더되는지
  const hasBottomSlot = $derived(
    cta !== null || !caseInfo.has_uninvoiced_sessions
  )
  // 구분선은 버튼이 아닌 '청구 완료' 표기에만. 슬롯의 top border로 그려서
  // 간격(16)을 늘리지 않는다 → 모든 변형의 카드 높이가 같다.
  const showBottomDivider = $derived(
    !showSendLink && cta === null && hasBottomSlot
  )

  // 케밥 = 검사 완료하기 · 수정 · 삭제 (+ CTA 자리를 내준 경우의 청구하기).
  // 맨 위 항목이 주어('검사')를 밝히므로 아래 항목은 짧게 둔다(상담 케밥과 같은 규칙).
  const menuItems = $derived([
    ...(rowStatus === 'completed'
      ? onRollbackComplete
        ? [
            {
              label: '완료 되돌리기',
              onClick: () => onRollbackComplete?.(caseInfo)
            }
          ]
        : []
      : onComplete && rowStatus !== 'cancelled'
        ? [{ label: '검사 완료하기', onClick: () => onComplete?.(caseInfo) }]
        : []),
    ...(onEdit ? [{ label: '수정', onClick: () => onEdit?.(caseInfo) }] : []),
    // CTA 자리를 다른 액션에 내준 경우에만 케밥에 청구하기를 둔다
    ...(wantsBilling && cta !== 'billing'
      ? [{ label: '청구하기', onClick: () => onBilling?.(caseInfo) }]
      : []),
    {
      label: '삭제',
      onClick: () => onDelete?.(caseInfo),
      variant: 'danger' as const
    }
  ])

  const handleCardClick = () => {
    goto(`/assessment/status/${caseInfo.uid || caseInfo.case_id}`)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleCardClick}
  class={twMerge(
    // 높이 고정 337 — 하단 슬롯 종류와 무관하게 모든 카드가 같은 높이.
    // 20(pt) + 32(배지행) + 12 + 45(정체: 이름 22 + 8 + 생년월일 15) + 33(hr)
    // + 47(검사·진행) + 16 + 52(메타)
    // + 16(mt-4) + 44(슬롯) + 20(pb) = 337
    'flex h-[337px] w-full cursor-pointer flex-col overflow-hidden',
    // 리스트 카드 단일 규격 — radius 16 · border-subtle · hover primary-400 + shadow
    'rounded-2xl border border-border-subtle bg-white p-5 duration-200',
    'hover:border-primary-400 hover:shadow-card-hover',
    className
  )}
>
  <!-- 상단: 상태 배지 + 케이스 코드(좌 묶음) · 더보기(우) — 상담 카드(CounselingCard)와 동일 규칙.
       코드는 검사 종류가 아니라 이 카드(=케이스) 자체의 식별자라 최상단에 두고,
       같은 '이 케이스는 무엇인가' 정보인 상태 배지 옆에 붙인다.
       코드 표기는 상세 좌측 패널·내담자 코드와 동일한 BadgeRectangle(sm) -->
  <div class="flex items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      <StatusBadge status={caseInfo.status} class="w-fit min-w-[63px] px-3" />
      {#if caseInfo.case_code}
        <Tooltip text="검사 코드">
          <BadgeRectangle label={caseInfo.case_code} size="sm" />
        </Tooltip>
      {/if}
    </div>
    <!-- 케밥 hover 영역(40)이 카드 패딩 안에 들어오도록 음수 마진을 두지 않는다 -->
    <div class="flex shrink-0 items-center">
      <KebabMenu items={menuItems} />
    </div>
  </div>

  <!-- 블록 1: 정체 -->
  <div class="mt-3 flex min-w-0 items-center gap-3">
    <div class="relative shrink-0">
      <ClientAvatar
        profileImageUrl={client?.profile_image_url}
        name={clientDisplayName}
        gender={client?.gender}
        sizeClass="h-10 w-10"
        textClass="text-[15px]"
      />
      {#if clientCount > 1}
        <span
          class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100"
        >
          <Typography
            variant="caption-01-normal-medium"
            color="text-caption-default"
            tag="span"
          >
            +{clientCount - 1}
          </Typography>
        </span>
      {/if}
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <Typography
          variant="title-01-normal-semibold"
          className="truncate-safe leading-[22px]"
          color="text-gray-900"
          tag="span"
        >
          {clientDisplayName}
        </Typography>
        {#if clientCount > 1}
          <Typography
            variant="body-02-normal-regular"
            color="text-body-default"
            className="shrink-0 whitespace-nowrap"
            tag="span"
          >
            외 {clientCount - 1}명
          </Typography>
        {/if}
      </div>
      {#if clientCount <= 1 && client}
        <ClientBirthGender
          birthDate={formatBirthDate(client.birth_date ?? '')}
          gender={client.gender}
        />
      {/if}
    </div>
  </div>

  <hr class="my-4 border-gray-100" />

  <!-- 블록 2: 앵커 — 검사 + 진행률 -->
  <div class="flex flex-col gap-2">
    <!-- 검사명 행 높이는 세트 기준(배지 h-6 = 24)으로 고정 — 배지 유무로 행이
         들쭉날쭉하면 카드끼리 진행률 바 위치가 어긋난다 -->
    <div class="flex h-6 min-w-0 items-center gap-1.5">
      {#if isOrganization && caseInfo.institution_name}
        <BadgeRectangle label={caseInfo.institution_name} size="sm" />
      {/if}
      {#if isSet}
        <!-- 테두리는 tag-orange-outline 대신 중립 border/default -->
        <BadgeRectangle
          label="세트"
          color="orange"
          outlined
          size="sm"
          class="border-border-default"
        />
      {/if}
      <!-- min-w-0 없이는 플렉스 자식의 min-width:auto 때문에 줄어들지 못해
           truncate-safe의 말줄임이 발동하지 않는다. 검사명이 길면(예:
           '집-나무-사람 그림검사') 카드 밖으로 밀려 overflow-hidden에
           말줄임표 없이 잘리고, 뒤따르는 '외 N건'이 통째로 사라졌다. -->
      <Typography
        variant="body-01-normal-medium"
        color="text-gray-800"
        className="truncate-safe min-w-0"
        tag="span"
      >
        {assessmentLabel}
      </Typography>
      {#if assessmentExtra > 0}
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-400"
          className="shrink-0 whitespace-nowrap"
          tag="span"
        >
          외 {assessmentExtra}건
        </Typography>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full transition-all duration-500 {isFull
            ? 'bg-primary-500'
            : 'bg-gray-500'}"
          style="width: {percent}%"
        ></div>
      </div>
      <span
        class="shrink-0 text-body-02-normal-regular {isFull
          ? 'text-primary-500'
          : 'text-gray-700'}"
      >
        {done}/{total}
      </span>
    </div>
  </div>

  <!-- 블록 3: 메타 — 레이블+데이터(가로형) · Web_Design.md §Layout 정본.
       레이블 열 auto(가장 넓은 '검사 일정' 기준) · 레이블↔값 24 · 행 높이 20 · 행간 8.
       위 간격 16 = 구분선 아래 16과 대칭 (검사·진행률 블록의 상하 갭 동일).
       flex-1 + content-start = 남는 높이를 이 블록이 흡수해 하단 슬롯이 바닥에 붙는다
       (상담 카드와 동일 — 없으면 카드 고정 높이의 잔여분이 그대로 하단 여백이 된다) -->
  <div
    class="mt-4 grid flex-1 grid-cols-[auto_1fr] auto-rows-[20px] content-start items-center gap-x-6 gap-y-2"
  >
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      검사 일정
    </Typography>
    {#if scheduleLabel}
      <div class="flex min-w-0 items-center gap-1.5">
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-900"
          className="truncate-safe"
          tag="span"
        >
          {scheduleLabel}
        </Typography>
        <!-- 지난 일정(D+)은 D-day를 감춘다 — 카운트다운은 다가오는 일정에만 의미가 있고,
             지난 날짜에 'D+12'를 붙이면 날짜 자체가 이미 말해 주는 정보를 중복한다 -->
        {#if !isPastSchedule}
          <span
            class="shrink-0 text-body-03-normal-medium {dDay === 'D-Day'
              ? 'text-imomtae'
              : 'text-primary-500'}"
          >
            {dDay}
          </span>
        {/if}
      </div>
    {:else}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-400"
        tag="span"
      >
        -
      </Typography>
    {/if}

    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      담당자
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-900"
      className="min-w-0 truncate-safe"
    >
      {caseInfo.counselor_name ?? '-'}
    </Typography>
  </div>

  <!-- 하단 CTA 슬롯.
       위 데이터와 항상 16(mt-4), 슬롯 자체는 항상 44(h-11), 아래는 패딩 20.
       구분선은 슬롯의 top border라 이 간격을 늘리지 않는다(모든 변형 높이 동일). -->
  <div
    class="mt-4 flex h-11 w-full shrink-0 items-center justify-center gap-2 {showBottomDivider
      ? 'border-t border-gray-100'
      : ''}"
  >
    {#if showSendLink}
      <button
        type="button"
        onclick={(event) => {
          event.stopPropagation()
          onSendLink?.(caseInfo)
        }}
        class="flex h-full min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-primary-200 px-2 text-body-02-normal-medium text-primary-600 transition-colors hover:bg-primary-50"
        >바로링크 전송</button
      >
    {/if}
    {#if cta === 'billing'}
      <button
        type="button"
        onclick={(e) => {
          e.stopPropagation()
          onBilling?.(caseInfo)
        }}
        class="flex h-full min-w-0 flex-1 items-center justify-center rounded-lg border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover"
      >
        <Typography
          variant="body-02-normal-medium"
          color="text-current"
          tag="span"
        >
          청구하기
        </Typography>
      </button>
    {:else if !caseInfo.has_uninvoiced_sessions}
      <!-- 청구할 게 없으면 상태 표기로 슬롯을 채운다 (상담 카드와 동일) -->
      <span
        class="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5"
      >
        <CheckCircleMintIcon20 />
        <Typography
          variant="body-01-normal-regular"
          color="text-gray-800"
          tag="span"
        >
          청구 완료
        </Typography>
      </span>
    {/if}
  </div>
</div>
