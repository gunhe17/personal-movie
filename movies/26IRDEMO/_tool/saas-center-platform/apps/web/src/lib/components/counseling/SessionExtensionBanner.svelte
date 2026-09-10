<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import PrimaryCalendarIcon44 from '$lib/assets/PrimaryCalendarIcon44.svelte'

  /**
   * 회기 배너 — 단계로 갈린다. 조건이 예정 회기 수(1~2건 / 0건)라 두 단계가 동시에 뜨지 않는다.
   * - upcoming: 예정 1~2건 = 예고. 연장만 안내하고 '나중에'로 미룰 수 있다.
   * - review:   예정 0 + 완료 있음 = 결정. 연장/종결 중 하나를 골라야 하므로 닫기 없이 상주한다.
   */
  type BannerStage = 'upcoming' | 'review'

  interface Props {
    stage?: BannerStage
    /** upcoming 전용 — 마지막 예정 회기까지 남은 일수 */
    daysUntil?: number
    /** upcoming 전용 */
    onDismiss?: () => void
    onAddSession: () => void
    /** review 전용 */
    onTerminate?: () => void
  }
  let {
    stage = 'upcoming',
    daysUntil = 0,
    onDismiss,
    onAddSession,
    onTerminate
  }: Props = $props()

  const title = $derived(
    stage === 'review'
      ? '예정된 회기가 없어요'
      : `마지막 예정 회기가 ${daysUntil}일 후에 있어요`
  )
  const description = $derived(
    stage === 'review'
      ? '회기를 연장하거나 상담을 종결 처리해 주세요'
      : '상담을 계속 진행하려면 새로운 회기를 추가해주세요'
  )
</script>

<!-- 높이 고정 없이 내부 패딩이 결정한다 — 콘텐츠(아이콘·텍스트 44) + 상하 20×2 = 84.
     바깥 여백은 쓰는 쪽이 소유한다(컴포넌트가 자기 margin을 갖지 않는다) -->
<div
  class="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-5"
>
  <!-- 아이콘 + 텍스트 -->
  <div class="flex items-center gap-4 min-w-0">
    <div class="shrink-0">
      <PrimaryCalendarIcon44 />
    </div>

    <div class="flex h-[44px] min-w-0 flex-col justify-between">
      <Typography
        variant="body-01-normal-semibold"
        color="text-gray-900"
        className="truncate-safe"
      >
        {title}
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        {description}
      </Typography>
    </div>
  </div>

  <!-- 버튼 -->
  <div class="flex shrink-0 items-center gap-2">
    {#if stage === 'review'}
      <!-- 종결은 되돌리기 어려운 선언 — 연장(주 액션) 왼쪽에 button-white(중립 액션)로 한 단 낮춰 둔다.
           파란 면 위라 흰 배경만으로 면 구분이 되므로 보더는 두지 않는다 -->
      <button
        onclick={onTerminate}
        class="flex h-10 w-[78px] items-center justify-center rounded-lg bg-white text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
      >
        상담 종결
      </button>
    {:else}
      <button
        onclick={onDismiss}
        class="px-3 py-2 text-body-02-normal-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        나중에
      </button>
    {/if}
    <button
      onclick={onAddSession}
      class="flex h-10 w-[78px] items-center justify-center rounded-lg bg-primary-100 text-body-02-normal-medium text-primary-500 transition-colors hover:bg-primary-200"
    >
      회기 추가
    </button>
  </div>
</div>
