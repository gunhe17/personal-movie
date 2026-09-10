<script lang="ts">
  import { goto } from '$app/navigation'
  import { twMerge } from 'tailwind-merge'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import CircleCautionOrangeIcon20 from '$lib/assets/CircleCautionOrangeIcon20.svelte'
  import CheckCircleMintIcon20 from '$lib/assets/CheckCircleMintIcon20.svelte'
  import type { CounselingVM } from '../../features/counseling/status/view-model'

  interface Props {
    data: CounselingVM
    onEdit?: (data: CounselingVM) => void
    onClose?: (data: CounselingVM) => void
    onReopen?: (data: CounselingVM) => void
    onDelete?: (data: CounselingVM) => void
    onBilling?: (data: CounselingVM) => void
    canBill?: boolean
    class?: string
  }

  let {
    data,
    onEdit,
    onClose,
    onReopen,
    onDelete,
    onBilling,
    canBill = false,
    class: className
  }: Props = $props()

  const STATUS_BADGE: Record<
    string,
    { badge: 'in_progress' | 'completed' | 'cancelled'; label: string }
  > = {
    active: { badge: 'in_progress', label: '진행중' },
    completed: { badge: 'completed', label: '종결' },
    cancelled: { badge: 'cancelled', label: '취소' }
  }

  const statusBadge = $derived(STATUS_BADGE[data.status])
  const clientName = $derived(
    $isSecretMode ? maskName(data.client_name) : data.client_name
  )
  // 내담자 참여자가 없는 케이스(취소 후 참여자 정리 등) — 빈 이름 대신 명시적 표기
  const clientDisplayName = $derived(clientName || '내담자 없음')
  const counselorLabel = $derived(
    (data.counselorNames?.length ? data.counselorNames : [data.counselor_name])
      .map((n) => ($isSecretMode ? maskName(n) : n))
      .join(', ')
  )
  const nextDate = $derived(
    data.nextSession.dateLabel
      ? data.nextSession.dateLabel.replace(/-/g, '. ')
      : null
  )

  // 케밥 = 상담 종결하기 · 수정 · 삭제.
  // 맨 위 항목이 주어('상담')를 밝히므로 아래 둘은 짧게 둔다(회기 케밥과 같은 규칙).
  const menuItems = $derived([
    data.status === 'completed'
      ? { label: '되돌리기', onClick: () => onReopen?.(data) }
      : { label: '상담 종결하기', onClick: () => onClose?.(data) },
    ...(onEdit ? [{ label: '수정', onClick: () => onEdit?.(data) }] : []),
    {
      label: '삭제',
      onClick: () => onDelete?.(data),
      variant: 'danger' as const,
      divider: true
    }
  ])

  const handleCardClick = () => {
    goto(`/counseling/status/${data.id}`)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleCardClick}
  class={twMerge(
    // 높이 고정 326 — 청구 영역 유무와 무관하게 그리드 행 높이를 맞춘다
    'flex h-[326px] w-full cursor-pointer flex-col overflow-hidden',
    // 리스트 카드 단일 규격 — radius 16 · border-subtle · hover primary-400 + shadow
    'rounded-2xl border border-border-subtle bg-white p-5 duration-200',
    'hover:border-primary-400 hover:shadow-card-hover',
    className
  )}
>
  <!-- 상단: 상태 배지 + 케이스 코드(좌 묶음) · 더보기(우).
       코드는 프로그램이 아니라 이 카드(=케이스) 자체의 식별자라 최상단에 두고,
       같은 '이 케이스는 무엇인가' 정보인 상태 배지 옆에 붙인다.
       코드 표기는 상세 좌측 패널·내담자 코드와 동일한 BadgeRectangle(sm) -->
  <div class="flex items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      {#if statusBadge}
        <BadgeRound
          status={statusBadge.badge}
          label={statusBadge.label}
          class="w-fit min-w-[63px] px-3"
        />
      {:else}
        <BadgeRound
          status="completed"
          label={data.status}
          class="w-fit min-w-[63px] bg-gray-100 px-3 text-gray-500"
        />
      {/if}
      {#if data.caseCode}
        <Tooltip text="상담 코드">
          <BadgeRectangle label={data.caseCode} size="sm" />
        </Tooltip>
      {/if}
    </div>
    <!-- 케밥 hover 영역(40)이 카드 패딩 안에 들어오도록 음수 마진을 두지 않는다 -->
    <div class="flex shrink-0 items-center">
      <KebabMenu items={menuItems} />
    </div>
  </div>

  <!-- 내담자 -->
  <div class="mt-3 flex min-w-0 items-center gap-3">
    <div class="relative shrink-0">
      <ClientAvatar
        profileImageUrl={data.clientProfileImageUrl}
        name={clientName}
        gender={data.clientGender}
        sizeClass="h-10 w-10"
        textClass="text-[15px]"
      />
      {#if data.clientCount > 1}
        <span
          class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100"
        >
          <Typography
            variant="caption-01-normal-medium"
            color="text-caption-default"
            tag="span"
          >
            +{data.clientCount - 1}
          </Typography>
        </span>
      {/if}
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <Typography
          variant="title-01-normal-semibold"
          color="text-gray-900"
          className="truncate-safe"
          tag="span"
        >
          {clientDisplayName}
        </Typography>
        {#if data.clientCount > 1}
          <Typography
            variant="body-02-normal-regular"
            color="text-body-default"
            className="shrink-0 whitespace-nowrap"
            tag="span"
          >
            외 {data.clientCount - 1}명
          </Typography>
        {/if}
      </div>
      {#if data.clientCount <= 1 && data.client_birth_date}
        <ClientBirthGender
          birthDate={data.client_birth_date}
          gender={data.clientGender}
        />
      {/if}
    </div>
  </div>

  <hr class="my-4 border-gray-100" />

  <!-- 레이블+데이터(가로형) — Web_Design.md §Layout 정본.
       레이블 열 auto = 가장 긴 레이블(다음 상담일) 기준 / 레이블↔값 24(gap-x-6)
       / 행 높이 20(auto-rows) / 행간 8(gap-y-2) / content-start = 남는 높이는 아래로 -->
  <div
    class="grid flex-1 grid-cols-[auto_1fr] auto-rows-[20px] content-start items-center gap-x-6 gap-y-2"
  >
    <!-- 프로그램 -->
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      프로그램
    </Typography>
    <!-- 케이스 코드는 상단 식별자 행으로 이동 — 여기 두면 '프로그램'의 값으로 읽힌다 -->
    <div class="flex min-w-0 items-center gap-1.5">
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-900"
        className="truncate-safe"
        tag="span"
      >
        {data.program_name}
      </Typography>
    </div>

    <!-- 담당자 -->
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
      {counselorLabel}
    </Typography>

    <!-- 진행률 -->
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      진행률
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-gray-900">
      {data.current_session}/{data.total_sessions}
    </Typography>

    <!-- 다음 상담일 -->
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      다음 상담일
    </Typography>
    <div class="flex min-w-0 items-center gap-1.5">
      {#if nextDate}
        <Typography variant="body-02-normal-regular" color="text-gray-900">
          {nextDate}
        </Typography>
      {:else if data.nextSession.kind === 'needs_review'}
        <CircleCautionOrangeIcon20 />
        <Typography
          variant="body-02-normal-regular"
          color="text-semantic-warning"
          tag="span"
          className="truncate-safe"
        >
          연장 · 종결 확인
        </Typography>
      {:else}
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          -
        </Typography>
      {/if}
    </div>
  </div>

  <!-- 청구 -->
  {#if data.hasUninvoicedSessions}
    <!-- 권한이 없어도 버튼 자리는 지킨다(비활성 표시) — 빈 칸이면 청구 대상인지 아닌지 구분이 안 된다 -->
    <button
      type="button"
      disabled={!canBill}
      title={canBill ? undefined : '청구 권한이 없어요'}
      onclick={(e) => {
        e.stopPropagation()
        onBilling?.(data)
      }}
      class="mt-4 flex h-11 w-full items-center justify-center rounded-lg border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover disabled:cursor-not-allowed disabled:border-billing-line-disabled disabled:text-billing-fg-disabled disabled:hover:border-billing-line-disabled disabled:hover:bg-transparent disabled:hover:text-billing-fg-disabled"
    >
      <Typography
        variant="body-02-normal-medium"
        color="text-current"
        tag="span"
      >
        청구하기
      </Typography>
    </button>
  {:else}
    <!-- 버튼이 아니므로 h-11로 키우지 않고 아이콘+텍스트 실제 높이(20)만 차지한다.
         위 정보와는 구분선으로 끊는다(카드 내 기존 hr과 동일 규격) -->
    <hr class="my-4 border-gray-100" />
    <div class="flex w-full items-center justify-center gap-1.5">
      <CheckCircleMintIcon20 />
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-900"
        tag="span"
      >
        청구 완료
      </Typography>
    </div>
  {/if}
</div>
