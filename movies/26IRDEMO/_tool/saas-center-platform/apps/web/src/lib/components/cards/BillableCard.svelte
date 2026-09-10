<script lang="ts">
  /**
   * 청구서 카드 (청구 목록 · 카드 뷰)
   *
   * 톤은 상담(`CounselingCard`)·검사(`AssessmentCaseCard`) 카드와 같은 한 벌이다 —
   * radius 16 · border-subtle · p-5 · hover primary-400 + shadow-card-hover,
   * 상단 식별 행 → 내담자 → 구분선 → 레이블+값 그리드(15 · 행 20 · 행간 8 · 레이블↔값 24).
   *
   * 위계는 "누구의 · 무슨 청구건인가" 순서다:
   *   1) 내담자 — 아바타 40 + 이름 18 SemiBold (카드의 주어)
   *   2) 청구 내역 — 16 Medium (이 청구서가 무엇인가)
   *   3) 금액·미수금 — 15 레이블+값
   *
   * 걷어낸 것: 케이스 코드 칩 나열(font-mono 11px)·내담자 코드 병기 —
   * 목록에서 읽히지 않는 식별자라 상세가 소유한다. 내담자 최소 단위는
   * `아바타 + 이름 + 생년월일|성별`(ClientBirthGender 정본).
   */
  import { twMerge } from 'tailwind-merge'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import type { BillableListItemVM } from '$lib/features/billing/view-model'

  interface Props {
    data: BillableListItemVM
    onclick?: (data: BillableListItemVM) => void
    class?: string
  }

  let { data, onclick, class: className }: Props = $props()

  const clientName = $derived(
    $isSecretMode ? maskName(data.clientName) : data.clientName
  )
  const clientDisplayName = $derived(clientName || '내담자 없음')

  /** 항목이 여럿이면 대표 내역 + "외 N건" (원자 단위 = 회기·검사 1개) */
  const extraItemCount = $derived(Math.max(0, data.itemCount - 1))
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={() => onclick?.(data)}
  class={twMerge(
    // 높이 고정 — 생년월일·패키지 배지 유무와 무관하게 그리드 행 높이를 맞춘다
    'flex h-[248px] w-full cursor-pointer flex-col overflow-hidden',
    'rounded-2xl border border-border-subtle bg-white p-5 duration-200',
    'hover:border-primary-400 hover:shadow-card-hover',
    className
  )}
>
  <!-- 상단: 상태(좌) · 청구일(우). 배지는 목록 테이블의 상태 셀과 같은 규격 -->
  <div class="flex items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      <span
        class="inline-flex h-8 min-w-[60px] shrink-0 items-center justify-center rounded-full px-3 text-body-03-normal-regular {data.statusColor}"
      >
        {data.statusLabel}
      </span>
      {#if data.isPackage}
        <BadgeRectangle label="패키지" color="blue" size="sm" />
      {/if}
    </div>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="shrink-0"
    >
      {data.billableDate}
    </Typography>
  </div>

  <!-- 내담자 — 이 카드의 주어 -->
  <div class="mt-3 flex min-w-0 items-center gap-3">
    <ClientAvatar
      profileImageUrl={data.clientProfileImageUrl}
      name={clientName}
      gender={data.clientGender}
      sizeClass="h-10 w-10 shrink-0"
      textClass="text-body-02-normal-semibold"
    />
    <div class="flex min-w-0 flex-col gap-2">
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-900"
        className="truncate-safe"
        tag="span"
      >
        {clientDisplayName}
      </Typography>
      <ClientBirthGender
        birthDate={data.clientBirthDate}
        gender={data.clientGender}
      />
    </div>
  </div>

  <!-- 무슨 청구건인가 — 내담자 다음 위계(16 Medium) -->
  <div class="mt-4 flex min-h-6 min-w-0 items-center gap-2">
    <Typography
      variant="body-01-normal-medium"
      color="text-gray-900"
      className="truncate-safe"
      tag="span"
    >
      {data.itemSummary}
    </Typography>
    {#if extraItemCount > 0}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-500"
        className="shrink-0 whitespace-nowrap"
        tag="span"
      >
        외 {extraItemCount}건
      </Typography>
    {/if}
  </div>

  <hr class="my-4 border-gray-100" />

  <!-- 레이블+데이터(가로형) — 카드 안 규격: 15 · 행 높이 20 · 행간 8 · 레이블↔값 24 -->
  <div
    class="grid flex-1 grid-cols-[auto_1fr] auto-rows-[20px] content-start items-center gap-x-6 gap-y-2"
  >
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      총액
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-gray-900">
      {data.totalAmountFormatted}
    </Typography>

    <Typography
      variant="body-02-normal-regular"
      color="text-gray-600"
      className="whitespace-nowrap"
    >
      미수금
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color={data.unpaidAmount > 0 ? 'text-status-danger' : 'text-gray-900'}
    >
      {data.unpaidAmountFormatted}
    </Typography>
  </div>
</div>
