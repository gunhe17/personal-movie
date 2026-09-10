<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import CountUp from '$root/src/lib/components/CountUp.svelte'
  import type { ProgramSummaryStats } from '$lib/features/center/program'

  interface Props {
    stats: ProgramSummaryStats
  }

  let { stats }: Props = $props()
</script>

<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
  <!-- 전체 프로그램 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      전체 프로그램
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.total} />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 개별 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      개별
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.individual} textColor="text-primary-500" />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 그룹 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      그룹
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.group} textColor="text-violet-500" />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 평균 금액 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      평균 금액
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.avgPrice} />
      <Typography variant="body-01-medium" color="text-gray-500">원</Typography>
    </div>
  </div>
</div>
