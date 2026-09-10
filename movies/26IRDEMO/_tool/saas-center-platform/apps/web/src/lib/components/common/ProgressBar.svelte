<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    /** 완료 수 */
    completed: number
    /** 전체 수 */
    total: number
    /** 예약 수 (옵션) — 0보다 크면 "· 예약 N" 세그먼트 노출 */
    scheduled?: number
    /** 숫자 라벨 표시 여부 (바 아래 오른쪽) */
    showLabel?: boolean
  }

  let { completed, total, scheduled = 0, showLabel = true }: Props = $props()

  const ratio = $derived(total > 0 ? Math.min(completed / total, 1) : 0)
  const percent = $derived(Math.round(ratio * 100))
</script>

<!-- 바 + 라벨(바 아래) 묶음. 셀 안에서 grid items-center로 세로중앙 정렬됨 -->
<div class="flex w-full flex-col gap-1">
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-gray-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
  >
    <div
      class="relative h-full rounded-full bg-linear-to-r from-primary-500 to-primary-400 shadow-[0_0_6px_rgba(37,110,244,0.45)] transition-all duration-500 ease-out"
      style="width: {percent}%"
    >
      <!-- 끝부분 하이라이트 glow -->
      <span
        class="absolute inset-y-0 right-0 w-1.5 rounded-full bg-white/30 blur-[1px]"
      ></span>
    </div>
  </div>
  {#if showLabel}
    <div class="flex w-full items-center justify-end gap-1 px-1.5 leading-none">
      <Typography
        variant="body-03-normal-regular"
        color="text-gray-700"
        className="text-[12px]!"
        tag="span"
      >
        완료 {completed}
      </Typography>
      {#if scheduled > 0}
        <Typography
          variant="body-03-normal-regular"
          color="text-gray-300"
          className="text-[12px]!"
          tag="span">·</Typography
        >
        <Typography
          variant="body-03-normal-regular"
          color="text-primary-500"
          className="text-[12px]!"
          tag="span"
        >
          예약 {scheduled}
        </Typography>
      {/if}
      <Typography
        variant="body-03-normal-regular"
        color="text-gray-400"
        className="text-[12px]!"
        tag="span"
      >
        / 총 {total}
      </Typography>
    </div>
  {/if}
</div>
