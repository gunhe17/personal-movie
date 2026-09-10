<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import CountUp from '$root/src/lib/components/CountUp.svelte'
  import type { RoomSummaryStats } from '$lib/features/center/room/view-model'

  interface Props {
    stats: RoomSummaryStats
  }

  let { stats }: Props = $props()
</script>

<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
  <!-- 전체 상담실 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      전체 상담실
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.total} />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 사용 가능 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      사용 가능
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.active} textColor="text-primary-500" />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 사용 불가 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      사용 불가
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.inactive} textColor="text-gray-400" />
      <Typography variant="body-01-medium" color="text-gray-500">개</Typography>
    </div>
  </div>

  <!-- 오늘 예약 -->
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <Typography
      variant="body-02-medium"
      color="text-gray-500"
      className="mb-3 block"
    >
      오늘 예약
    </Typography>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.todayReservation} />
      <Typography variant="body-01-medium" color="text-gray-500">건</Typography>
    </div>
  </div>
</div>
