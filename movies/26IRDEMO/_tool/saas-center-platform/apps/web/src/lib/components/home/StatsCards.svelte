<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import CountUp from '../CountUp.svelte'

  interface Stats {
    todayReservation: number
    attendanceRate: number
    inProgress: number
    noShow: number
    cancelled: number
  }

  interface Props {
    stats?: Stats
  }

  let {
    stats = {
      todayReservation: 0,
      attendanceRate: 0,
      inProgress: 0,
      noShow: 0,
      cancelled: 0
    }
  }: Props = $props()
</script>

<div class="grid grid-cols-5 gap-4">
  <!-- 오늘 예약 -->
  <div class="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
    <div class="mb-3 flex items-center gap-2">
      <Typography variant="body-02-medium" color="text-gray-500">
        오늘 예약
      </Typography>
    </div>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.todayReservation} />
      <Typography variant="body-01-medium" color="text-gray-500">건</Typography>
    </div>
  </div>
  <!-- 출석률 -->
  <div class="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
    <div class="mb-3 flex items-center gap-2">
      <Typography variant="body-02-medium" color="text-gray-500">
        출석률
      </Typography>
    </div>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.attendanceRate} />
      <Typography variant="body-01-medium" color="text-gray-500">%</Typography>
    </div>
  </div>

  <!-- 진행중 -->
  <div class="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
    <div class="mb-3 flex items-center gap-2">
      <Typography variant="body-02-medium" color="text-gray-500">
        진행완료
      </Typography>
    </div>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.inProgress} />
      <Typography variant="body-01-medium" color="text-gray-500">건</Typography>
    </div>
  </div>

  <!-- 노쇼 -->
  <div class="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
    <div class="mb-3 flex items-center gap-2">
      <Typography variant="body-02-medium" color="text-gray-500">
        노쇼
      </Typography>
    </div>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.noShow} textColor={'text-status-danger'} />
      <Typography variant="body-01-medium" color="text-status-danger"
        >건</Typography
      >
    </div>
  </div>

  <!-- 취소 -->
  <div class="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
    <div class="mb-3 flex items-center gap-2">
      <Typography variant="body-02-medium" color="text-gray-500">
        취소
      </Typography>
    </div>
    <div class="flex items-baseline gap-1">
      <CountUp value={stats.cancelled} textColor={'text-status-danger'} />
      <Typography variant="body-01-medium" color="text-status-danger"
        >건</Typography
      >
    </div>
  </div>
</div>
