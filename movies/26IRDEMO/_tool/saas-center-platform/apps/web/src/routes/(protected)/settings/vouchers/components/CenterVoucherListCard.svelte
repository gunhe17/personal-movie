<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import type { CenterVoucherVM } from '$lib/features/voucher/center-voucher/view-model'

  let {
    item,
    activeClientCount = null,
    onOpen
  }: {
    item: CenterVoucherVM
    /** 해당 바우처를 사용 중인 내담자 수 (미연결 시 null) */
    activeClientCount?: number | null
    onOpen?: (item: CenterVoucherVM) => void
  } = $props()

  // 상태 배지는 예외 상태(종료·비활성)에만 — 활성은 배지를 달지 않는다.
  // 배지는 타이틀 행 우측 끝에 놓고 행 높이를 32로 고정해, 배지 유무로
  // 카드마다 본문 시작선이 어긋나지 않게 한다.
  const isDimmed = $derived(item.isExpired || !item.isActive)
</script>

<!--
  클릭 가능한 리스트 카드 (Web_Design.md §Components>card)
  radius 16 · border-subtle · hover primary-400 + shadow-card-hover
  패딩 사방 20 — 상태 배지가 머리 행으로 들어와 상단 밴드가 없어졌다(디자이너 지정).
-->
<button
  type="button"
  onclick={() => onOpen?.(item)}
  class="flex w-full flex-col rounded-2xl border border-border-subtle bg-white p-5 text-left transition-all duration-200 hover:border-primary-400 hover:shadow-card-hover"
>
  <!-- 머리 행 — [바우처명 + 사업 요약] 묶음과 우측 끝 상태 배지, 사이 간격 8.
       배지는 두 줄 묶음의 세로 중앙에 정렬한다(items-center). 타이틀·서브 각 행은
       글자 높이만 갖고, 배지(32)는 묶음(45)보다 낮아 본문 시작선을 밀지 않는다.
       배지는 딤드 대상이 아니다(상태를 읽는 단서라 흐려지면 안 된다) -->
  <div class="flex w-full min-w-0 items-center gap-2">
    <div class="flex min-w-0 flex-1 flex-col {isDimmed ? 'opacity-40' : ''}">
      <Typography
        variant="title-01-normal-semibold"
        tag="h2"
        color="text-gray-900"
        className="block truncate-safe"
      >
        {item.catalogName}
      </Typography>
      <!-- 타이틀 ↔ 서브문구 12 -->
      <Typography
        variant="body-02-normal-regular"
        tag="p"
        color="text-gray-500"
        className="mt-3 block truncate-safe"
      >
        {item.catalogSummary}
      </Typography>
    </div>
    {#if item.isExpired}
      <!-- 종료(사업 기간 만료) = canceled → tag-red -->
      <BadgeRound status="cancelled" label="종료" class="min-w-[60px] px-3" />
    {:else if !item.isActive}
      <!-- 비활성 = inactive → tag-gray (내담자 카드와 동일 규격) -->
      <BadgeRound
        status="completed"
        label="비활성"
        class="min-w-[60px] bg-tag-gray-bg px-3 text-tag-gray-fg"
      />
    {/if}
  </div>

  <!-- 본문 — 종료·비활성이면 딤드(상태는 머리 행 배지가 말한다) -->
  <div class="flex w-full min-w-0 flex-col {isDimmed ? 'opacity-40' : ''}">
    <hr class="my-4 border-gray-100" />

    <!-- 레이블+데이터(가로형) — 카드 안 규격: body-02 · 레이블↔값 24 · 행 높이 20 · 행간 8 -->
    <div
      class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-2"
    >
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-600"
        className="whitespace-nowrap"
      >
        단가
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-900">
        {item.unitPriceFormatted}
      </Typography>

      <Typography
        variant="body-02-normal-regular"
        color="text-gray-600"
        className="whitespace-nowrap"
      >
        기본 회기
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-900">
        {item.defaultTotalSessionsFormatted}
      </Typography>

      {#if item.formTemplateIds.length > 0}
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-600"
          className="whitespace-nowrap"
        >
          서식
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-900">
          {item.formTemplateIds.length}건
        </Typography>
      {/if}

      {#if activeClientCount != null}
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-600"
          className="whitespace-nowrap"
        >
          사용 내담자
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-900">
          {activeClientCount}명
        </Typography>
      {/if}
    </div>
  </div>
</button>
