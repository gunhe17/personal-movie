<script lang="ts">
  interface Props {
    current: number
    total: number
    answered: number
  }

  let { current, total, answered }: Props = $props()

  let answeredPercent = $derived(Math.round((answered / total) * 100))
</script>

<div class="mb-6 w-full max-w-2xl">
  <div class="mb-2 flex items-center justify-between text-xs text-gray-500">
    <span>진행률 {answeredPercent}%</span>
    <span>응답 완료 {answered} / {total}</span>
  </div>
  <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
    <div
      class="h-full rounded-full bg-primary-500 transition-all duration-200"
      style="width: {answeredPercent}%"
    ></div>
  </div>
</div>
