<script lang="ts">
  // AI 상담 경과 분석 — 범위 선택 + 비례 비용 표시 시안 (mock only)
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'

  // ── 목업 시나리오: 완료 회기 수에 따라 선택지가 어떻게 달라지는지 ──
  type Scenario = { label: string; completed: number; notes: number }
  const SCENARIOS: Scenario[] = [
    { label: '단기 케이스', completed: 4, notes: 3 },
    { label: '진행 중', completed: 12, notes: 10 },
    { label: '장기 케이스', completed: 30, notes: 27 }
  ]
  let scenarioIdx = $state(1)
  const scenario = $derived(SCENARIOS[scenarioIdx])

  // ── 간이 추정 계수 (lab에서 조정해보기 위한 노출) ──
  let baseCredit = $state(6)
  let perSessionCredit = $state(1)
  const remainingCredit = 240

  // ── 범위 선택지: 회기 수에 따라 의미 없는 선택지는 감춘다 ──
  type Range = { key: string; label: string; take: number | null; hint: string }
  const ranges = $derived.by((): Range[] => {
    const n = scenario.completed
    const all: Range = {
      key: 'all',
      label: `전체 ${n}회기`,
      take: null,
      hint: '상담을 시작한 뒤 지금까지 어떻게 달라졌는지 봅니다.'
    }
    if (n < 6) return [all]
    const recent5: Range = {
      key: 'r5',
      label: '최근 5회기',
      take: 5,
      hint: '요즘 상태를 중심으로 봅니다.'
    }
    if (n < 11) return [all, recent5]
    return [
      all,
      recent5,
      {
        key: 'r10',
        label: '최근 10회기',
        take: 10,
        hint: '최근 흐름을 조금 넓게 봅니다.'
      }
    ]
  })

  let rangeKey = $state('all')
  const selected = $derived(ranges.find((r) => r.key === rangeKey) ?? ranges[0])

  // 시나리오를 바꾸면 사라진 선택지가 남지 않도록 보정
  $effect(() => {
    if (!ranges.some((r) => r.key === rangeKey)) rangeKey = 'all'
  })

  const sessionCount = $derived(
    selected.take
      ? Math.min(selected.take, scenario.completed)
      : scenario.completed
  )
  const noteCount = $derived(
    Math.min(scenario.notes, Math.max(0, sessionCount - 1))
  )
  const estimate = $derived(baseCredit + perSessionCredit * sessionCount)
  const notEnough = $derived(estimate > remainingCredit)
</script>

<div in:fade class="flex h-full w-full flex-col gap-6 bg-gray-50 pb-10">
  <div class="shrink-0">
    <Typography variant="headline-01-normal-semibold" color="text-gray-900">
      AI 상담 경과 분석 — 범위 선택 Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-2 block"
    >
      회기 수에 따라 선택지와 예상 크레딧이 어떻게 달라지는지 확인하는
      시안이에요. 전부 목업 데이터입니다.
    </Typography>
  </div>

  <!-- 시나리오 전환 -->
  <div class="flex flex-wrap items-center gap-2">
    {#each SCENARIOS as s, i (s.label)}
      <button
        type="button"
        onclick={() => (scenarioIdx = i)}
        class="h-9 rounded-lg px-3 text-body-02-normal-medium transition-colors {scenarioIdx ===
        i
          ? 'bg-primary-500 text-white'
          : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'}"
      >
        {s.label} · 완료 {s.completed}회기
      </button>
    {/each}
  </div>

  <div class="flex flex-wrap items-start gap-6">
    <!-- ── 시안 카드 ── -->
    <div
      class="w-[420px] max-w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div class="mb-5 flex items-center gap-2">
        <Typography variant="title-01-semibold" color="text-gray-900">
          AI 상담 경과 분석
        </Typography>
      </div>

      <p class="mb-2 text-[14px] font-medium text-gray-600">
        어느 범위로 볼까요?
      </p>

      <div class="flex flex-wrap gap-2">
        {#each ranges as r (r.key)}
          <button
            type="button"
            onclick={() => (rangeKey = r.key)}
            class="h-10 rounded-lg px-3.5 text-body-02-normal-medium transition-colors {rangeKey ===
            r.key
              ? 'bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-400'
              : 'bg-bg-base text-gray-600 hover:bg-gray-100'}"
          >
            {r.label}
          </button>
        {/each}
      </div>

      <p class="mt-3 text-[14px] leading-relaxed text-gray-500">
        {selected.hint}
      </p>

      <div class="my-5 h-px bg-gray-100"></div>

      <div class="flex items-baseline gap-1.5 text-[14px] text-gray-500">
        <span>회기 {sessionCount}개</span>
        <span class="text-gray-300">·</span>
        <span>상담일지 {noteCount}개</span>
      </div>

      <div class="mt-1.5 flex items-baseline gap-2">
        <span class="text-[16px] font-semibold text-gray-800">
          예상 {estimate}크레딧
        </span>
        <span class="text-[13px] text-gray-400">잔여 {remainingCredit}</span>
      </div>

      {#if notEnough}
        <p class="mt-2 text-[13px] text-amber-600">
          크레딧이 부족해요. 범위를 줄이거나 충전이 필요합니다.
        </p>
      {/if}

      <button
        type="button"
        disabled={notEnough}
        class="mt-5 h-11 w-full rounded-lg bg-primary-500 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        경과 분석 시작
      </button>

      <p class="mt-3 text-[13px] leading-relaxed text-gray-400">
        예상치예요. 실제 사용량에 따라 조금 달라질 수 있어요.
      </p>
    </div>

    <!-- ── 추정식 조정 (lab 전용) ── -->
    <div
      class="w-[320px] max-w-full rounded-2xl border border-dashed border-gray-300 bg-white p-5"
    >
      <p class="mb-1 text-[14px] font-medium text-gray-700">
        간이 추정식 (lab 전용)
      </p>
      <p class="mb-4 text-[13px] text-gray-400">
        이 패널은 계수를 맞춰보기 위한 것이라 실제 화면에는 넣지 않습니다.
      </p>

      <code
        class="mb-4 block rounded-lg bg-gray-50 px-3 py-2 text-[13px] text-gray-700"
      >
        {baseCredit} + {perSessionCredit} × {sessionCount} = {estimate}
      </code>

      <label class="mb-3 block">
        <span class="text-[13px] text-gray-500">기본 {baseCredit}크레딧</span>
        <input
          type="range"
          min="0"
          max="20"
          bind:value={baseCredit}
          class="mt-1 w-full"
        />
      </label>

      <label class="block">
        <span class="text-[13px] text-gray-500">
          회기당 {perSessionCredit}크레딧
        </span>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          bind:value={perSessionCredit}
          class="mt-1 w-full"
        />
      </label>

      <div class="mt-5 border-t border-gray-100 pt-4">
        <p class="mb-2 text-[13px] font-medium text-gray-500">
          시나리오별 전체 분석 비용
        </p>
        {#each SCENARIOS as s (s.label)}
          <div class="flex justify-between py-0.5 text-[13px] text-gray-600">
            <span>{s.label} ({s.completed}회기)</span>
            <span class="font-medium">
              {baseCredit + perSessionCredit * s.completed}크레딧
            </span>
          </div>
        {/each}
        <p class="mt-3 text-[13px] leading-relaxed text-amber-600">
          현재 운영값은 회기 수와 무관하게 고정 11크레딧으로 표시됩니다.
        </p>
      </div>
    </div>
  </div>
</div>
