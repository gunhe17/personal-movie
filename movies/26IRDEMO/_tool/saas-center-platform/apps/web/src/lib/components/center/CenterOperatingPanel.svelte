<script lang="ts">
  import { onMount } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { CENTER_EDIT_RULE } from '$lib/features/center/permissions'

  type OperatingRow = {
    weekday: string
    label: string
    isOpen: boolean
    openTime: string
    closeTime: string
  }

  type NonOp = {
    year: number | null
    month: number | null
    day: number | null
    reason: string
  }

  interface Props {
    operatingTimes: OperatingRow[]
    regularHolidayLabels: string[]
    nonOperatingTimes?: NonOp[]
    onEdit?: () => void
  }

  let {
    operatingTimes,
    regularHolidayLabels,
    nonOperatingTimes = [],
    onEdit
  }: Props = $props()

  const toMin = (t: string): number | null => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  const closedDays = $derived(operatingTimes.filter((d) => !d.isOpen))
  const hasAnyHoliday = $derived(
    closedDays.length > 0 || regularHolidayLabels.length > 0
  )

  // ── 오늘 실시간 상태 (SSR 불일치 방지: 클라이언트에서만) ──
  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const KO = ['일', '월', '화', '수', '목', '금', '토']
  let todayCode = $state<string | null>(null)
  let nowMin = $state<number | null>(null)
  let todayMs = $state<number | null>(null)
  onMount(() => {
    const d = new Date()
    todayCode = DOW[d.getDay()]
    nowMin = d.getHours() * 60 + d.getMinutes()
    todayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  })

  // 다가오는 휴무(공휴일·임시휴무 등 특정일 비운영) — 가까운 순 최대 4개
  const upcoming = $derived.by(() => {
    if (todayMs === null) return []
    return nonOperatingTimes
      .filter((h) => h.year != null && h.month != null && h.day != null)
      .map((h) => {
        const dt = new Date(h.year!, h.month! - 1, h.day!)
        return { ms: dt.getTime(), dt, reason: h.reason ?? '' }
      })
      .filter((x) => !Number.isNaN(x.ms) && x.ms >= todayMs!)
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 4)
      .map((x) => ({
        label: `${x.dt.getMonth() + 1}.${x.dt.getDate()}`,
        dow: KO[x.dt.getDay()],
        reason: x.reason
      }))
  })

  const todayRow = $derived(
    operatingTimes.find((d) => d.weekday === todayCode) ?? null
  )

  type Status = { label: string; text: string; bg: string }
  const todayStatus = $derived.by<Status | null>(() => {
    if (!todayRow) return null
    const gray = {
      text: 'text-tag-gray-fg',
      bg: 'bg-tag-gray-bg'
    }
    if (!todayRow.isOpen) return { label: '휴무', ...gray }
    const o = toMin(todayRow.openTime)
    const c = toMin(todayRow.closeTime)
    if (nowMin === null || o === null || c === null) return null
    if (nowMin < o)
      return {
        label: '운영 전',
        text: 'text-tag-orange-fg',
        bg: 'bg-tag-orange-bg'
      }
    if (nowMin >= c) return { label: '운영 종료', ...gray }
    return {
      label: '운영 중',
      text: 'text-tag-blue-fg',
      bg: 'bg-tag-blue-bg'
    }
  })
</script>

<section
  class="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_2px_6px_rgba(204,204,204,0.15)]"
>
  <!-- 헤더: 제목 + 실시간 상태 -->
  <div class="flex shrink-0 items-center justify-between">
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      운영시간
    </Typography>
    {#if onEdit}
      <PermissionGuard rule={CENTER_EDIT_RULE}>
        <button
          onclick={onEdit}
          aria-label="수정"
          class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
        >
          <EditIcon class="h-full w-auto" />
          <span class="text-body-02-normal-medium">수정</span>
        </button>
      </PermissionGuard>
    {/if}
  </div>

  <!-- 요일별 운영시간 — 테이블형(데이터 집중) -->
  <!-- 행 높이(h-9)가 텍스트 위아래로 여백을 만들어, 타이틀 간격은 8로 줄여야 다른 그룹과 같아 보인다 -->
  <div class="mt-2 shrink-0">
    {#each operatingTimes as d (d.weekday)}
      {@const isToday = d.weekday === todayCode}
      <div class="flex h-9 items-center gap-4">
        <Typography
          variant="body-01-normal-regular"
          color={isToday ? 'text-primary-500' : 'text-gray-600'}
          className="shrink-0"
        >
          {d.label}요일
        </Typography>
        <Typography
          variant="body-01-normal-medium"
          color={isToday
            ? 'text-primary-500'
            : d.isOpen
              ? 'text-gray-900'
              : 'text-gray-500'}
          className="tabular-nums"
        >
          {d.isOpen ? `${d.openTime} - ${d.closeTime}` : '휴무'}
        </Typography>
        {#if isToday && todayStatus}
          <!-- 운영 상태 = 텍스트만. 색 자체가 상태를 나타내므로 점은 중복 신호 -->
          <span
            class="flex items-center rounded-full px-3 py-2 {todayStatus.bg}"
          >
            <Typography
              variant="body-02-normal-medium"
              color={todayStatus.text}
            >
              {todayStatus.label}
            </Typography>
          </span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- 휴무일 -->
  <div class="mt-8 shrink-0 border-t border-gray-100 pt-8">
    <Typography
      variant="title-01-normal-semibold"
      color="text-gray-900"
      className="mb-4 block"
    >
      휴무일
    </Typography>
    {#if hasAnyHoliday}
      <div class="space-y-1">
        {#if closedDays.length}
          <Typography
            variant="body-01-normal-regular"
            color="text-gray-700"
            className="block"
          >
            매주 {closedDays.map((d) => d.label).join('·')}요일
          </Typography>
        {/if}
        {#each regularHolidayLabels as label (label)}
          <Typography
            variant="body-01-normal-regular"
            color="text-gray-700"
            className="block"
          >
            {label}
          </Typography>
        {/each}
      </div>
    {:else}
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        설정된 휴무일이 없어요
      </Typography>
    {/if}
  </div>

  <!-- 다가오는 휴무 (공휴일·임시휴무) -->
  <div class="mt-8 shrink-0 border-t border-gray-100 pt-8">
    <Typography
      variant="title-01-normal-semibold"
      color="text-gray-900"
      className="mb-4 block"
    >
      다가오는 휴무
    </Typography>
    {#if upcoming.length}
      <ul class="space-y-2">
        {#each upcoming as u, i (i)}
          <li class="flex items-center gap-2">
            <Typography
              variant="body-01-normal-semibold"
              color="text-rose-500"
              className="w-12 shrink-0 tabular-nums"
            >
              {u.label}
            </Typography>
            <Typography variant="body-02-normal-medium" color="text-gray-400">
              {u.dow}
            </Typography>
            {#if u.reason}
              <Typography
                variant="body-01-normal-regular"
                color="text-gray-700"
              >
                {u.reason}
              </Typography>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        예정된 임시 휴무가 없어요
      </Typography>
    {/if}
  </div>
</section>
