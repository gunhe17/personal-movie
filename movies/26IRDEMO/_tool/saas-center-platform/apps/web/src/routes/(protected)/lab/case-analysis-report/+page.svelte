<script lang="ts">
  // ============================================================
  // AI 상담 경과 분석 — 진입 구조 Lab (mock only)
  // ============================================================
  //
  // 리포트의 **내용과 배치**는 결정됐다(플로우시트 + 판단 레일 = LayoutRail, 프로덕션
  // 반영 완료). 이 Lab에 남은 질문은 하나다: **어디서 어떻게 여는가.**
  //
  // 프로덕션 1차 구현은 페이지 헤더의 세그먼트로 전환했는데, 그게 애매했다:
  //   · 스위치가 브레드크럼 옆(페이지 크롬 자리)이라 바뀌는 범위를 말해주지 않는다
  //   · 라벨은 "회기 | 경과 분석"인데 실제로는 좌측 케이스 패널까지 사라진다
  //   · 좌우가 동시에 재배치돼 제자리에 남는 게 없다 → "다른 페이지로 왔나?"
  //
  // 원인은 위계다 — 경과 분석은 회기 목록의 **형제가 아니다.** 회기 목록은 케이스의
  // 한 구획이고, 경과 분석은 케이스 전체를 다른 렌즈로 보는 것이라 화면 전체를 원한다.
  // 그 어긋남을 어떻게 풀 것인가로 두 안이 갈린다:
  //
  //   A · 우측 컨테이너 탭   — 형제로 만든다. 좌측이 고정돼 화면이 안 튀는 대신 폭을 잃는다.
  //   B · 여닫는 리포트      — 형제가 아님을 인정한다. 문을 열고 닫는다. 폭은 다 쓴다.
  //
  // 전환은 정지된 그림으로 판단되지 않으므로 둘 다 실제로 눌러볼 수 있게 만들었다.

  import { fade, slide } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import EntryTabs from './EntryTabs.svelte'
  import EntryDoor from './EntryDoor.svelte'
  import { SCENARIOS, RUN_STEPS, toReportVM } from './mock'

  type View = 'empty' | 'running' | 'failed' | 'done'

  const ENTRIES = [
    {
      key: 'tabs',
      label: 'A · 우측 컨테이너 탭',
      desc: '좌측 케이스 패널 고정 + 우측 탭 — 화면이 안 튀는 대신 본문 폭 774(1920 기준)'
    },
    {
      key: 'door',
      label: 'B · 여닫는 리포트',
      desc: '좌측 진입 카드로 열고 ← 로 닫는다 — 전환이 의도로 읽히고 폭을 다 쓴다'
    }
  ]
  let entryKey = $state('door')

  let view = $state<View>('done')
  const VIEW_SWITCH: { key: View; label: string }[] = [
    { key: 'done', label: '완료(리포트)' },
    { key: 'empty', label: '미실행' },
    { key: 'running', label: '분석 중' },
    { key: 'failed', label: '실패' }
  ]

  let scenarioKey = $state('mixed')
  const scenario = $derived(
    SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]
  )
  // 프로덕션 컴포넌트를 그대로 렌더한다 — 목업은 VM으로 변환해 먹인다.
  const r = $derived(toReportVM(scenario.report))

  // ── 실행 모달(범위 선택) + 진행 목업 ──
  let runOpen = $state(false)
  let rangeKey = $state('all')
  const RANGES = [
    {
      key: 'all',
      take: r.coverage.completedSessions,
      label: `전체 ${r.coverage.completedSessions}회기`,
      hint: '상담을 시작한 뒤 지금까지 어떻게 달라졌는지 봐요.'
    },
    {
      key: 'r10',
      take: 10,
      label: '최근 10회기',
      hint: '최근 흐름을 넓게 봐요.'
    },
    {
      key: 'r5',
      take: 5,
      label: '최근 5회기',
      hint: '요즘 상태를 중심으로 봐요.'
    }
  ]
  const ranges = $derived(
    RANGES.filter((x) => x.take <= r.coverage.completedSessions)
  )
  const selectedRange = $derived(
    ranges.find((x) => x.key === rangeKey) ?? ranges[0]
  )
  const estimate = $derived(6 + selectedRange.take)

  let step = $state(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function startRun() {
    runOpen = false
    view = 'running'
    step = 0
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      step += 1
      if (step >= RUN_STEPS.length) {
        if (timer) clearInterval(timer)
        timer = null
        view = 'done'
      }
    }, 1400)
  }
</script>

{#snippet switcher(
  title: string,
  items: { key: string; label: string; desc?: string }[],
  current: string,
  pick: (key: string) => void
)}
  <div class="flex flex-wrap items-center gap-2">
    <span class="w-20 shrink-0 text-body-02-normal-medium text-title-subtitle">
      {title}
    </span>
    {#each items as item}
      <button
        type="button"
        onclick={() => pick(item.key)}
        title={item.desc}
        class="h-10 rounded-lg px-4 text-body-02-normal-medium transition-colors {current ===
        item.key
          ? 'bg-primary-500 text-white'
          : 'border border-gray-200 bg-white text-body-default hover:bg-gray-50'}"
      >
        {item.label}
      </button>
    {/each}
  </div>
{/snippet}

<div in:fade class="flex h-full w-full flex-col bg-bg-base">
  <div class="shrink-0">
    <Typography
      variant="headline-01-normal-semibold"
      color="text-title-default"
    >
      AI 상담 경과 분석 — 진입 구조 Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="mt-2 block"
    >
      리포트 내용·배치는 확정됐고, 남은 질문은 "어디서 어떻게 여는가"예요. 두
      안을 실제로 눌러 전환을 비교해 보세요.
    </Typography>

    <div class="mt-4 flex flex-col gap-2">
      {@render switcher('진입 구조', ENTRIES, entryKey, (k) => (entryKey = k))}
      {@render switcher(
        '일지 종류',
        SCENARIOS.map((s) => ({ key: s.key, label: s.label, desc: s.desc })),
        scenarioKey,
        (k) => (scenarioKey = k)
      )}
      {@render switcher('화면 상태', VIEW_SWITCH, view, (k) => {
        view = k as View
        if (k === 'running') step = 1
      })}
    </div>

    <p class="mt-3 mb-4 text-body-03-normal-regular text-body-subtle">
      {ENTRIES.find((e) => e.key === entryKey)?.desc}
    </p>
  </div>

  <!-- ─── 케이스 상세 프레임 (셸 폭 그대로) ─── -->
  <div class="flex min-h-0 flex-1 pb-8">
    {#if entryKey === 'tabs'}
      <EntryTabs report={r} {view} {step} onRun={() => (runOpen = true)} />
    {:else}
      <EntryDoor report={r} {view} {step} onRun={() => (runOpen = true)} />
    {/if}
  </div>
</div>

<!-- ─── 실행 모달 (범위 선택) ─── -->
{#if runOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    transition:fade={{ duration: 120 }}
  >
    <div class="w-full max-w-[540px] rounded-2xl bg-white shadow-dropdown">
      <div
        class="flex items-center justify-between border-b border-border-subtle px-5 py-4"
      >
        <Typography
          variant="headline-02-normal-semibold"
          color="text-body-strong"
        >
          경과 분석 실행
        </Typography>
        <button
          type="button"
          onclick={() => (runOpen = false)}
          aria-label="닫기"
          class="flex h-8 w-8 items-center justify-center text-body-subtle hover:text-body-strong"
        >
          ✕
        </button>
      </div>

      <div class="flex flex-col gap-6 px-5 pt-5 pb-7">
        <div>
          <p class="mb-2 text-body-02-normal-medium text-title-subtitle">
            분석 범위
          </p>
          <div class="flex flex-col gap-3">
            {#each ranges as range}
              <button
                type="button"
                onclick={() => (rangeKey = range.key)}
                class="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors {rangeKey ===
                range.key
                  ? 'border-border-active bg-brand-subtle'
                  : 'border-gray-200 hover:border-primary-300'}"
              >
                <span
                  class="mt-1 flex h-4 w-4 shrink-0 rounded-full border {rangeKey ===
                  range.key
                    ? 'border-[5px] border-primary-500'
                    : 'border-border-strong'}"
                ></span>
                <span class="min-w-0">
                  <span
                    class="block text-body-01-normal-medium text-body-strong"
                  >
                    {range.label}
                  </span>
                  <span
                    class="mt-1 block text-body-02-normal-regular text-body-subtle"
                  >
                    {range.hint}
                  </span>
                </span>
              </button>
            {/each}
          </div>
        </div>

        <div
          class="flex items-center justify-between rounded-lg bg-gray-50 p-4"
        >
          <span class="text-body-02-normal-regular text-body-default"
            >예상 크레딧</span
          >
          <span class="text-body-01-normal-medium text-body-strong">
            {estimate} 크레딧
          </span>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-3 border-t border-border-subtle px-5 pt-4 pb-5"
      >
        <button
          type="button"
          onclick={() => (runOpen = false)}
          class="h-11 rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-body-default transition-colors hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onclick={startRun}
          class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
        >
          분석 실행
        </button>
      </div>
    </div>
  </div>
{/if}
