<script lang="ts">
  import type { SubscriptionVM } from '../view-model'

  interface Props {
    vm: SubscriptionVM
  }

  let { vm }: Props = $props()
</script>

<!-- 결제 내역·이력 페이지용 경량 구독 컨텍스트 스트립 -->
<div
  class="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-white px-6 py-3.5"
>
  <div class="flex items-center gap-2">
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {vm.badgeBg} {vm.badgeText}"
    >
      {vm.planLabel}
    </span>
    <span class="text-body-03-normal-regular text-gray-500"
      >{vm.statusLabel}</span
    >
  </div>
  <span class="hidden h-3.5 w-px bg-gray-300 sm:block"></span>
  <span class="text-body-03-normal-regular text-gray-500">
    구독 기간 <span class="text-gray-700">{vm.periodLabel}</span>
  </span>
  <a
    href="/subscription"
    class="ml-auto hidden text-body-03-normal-medium text-primary-400 hover:text-primary-500 sm:block"
  >
    구독 관리 →
  </a>
</div>
