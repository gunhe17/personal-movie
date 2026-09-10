<script lang="ts">
  // ─────────────────────────────────────────────────────────────
  // 진입 구조 B — 여닫는 리포트
  // ─────────────────────────────────────────────────────────────
  //
  // 케이스 화면은 그대로 두고, 좌측 패널의 진입 카드로 전폭 리포트를 연다.
  // 나갈 때는 "← 케이스로 돌아가기".
  //
  // 왜 탭이 아닌가 — 경과 분석은 회기 목록의 형제가 아니다. 회기 목록은 케이스의
  // 한 구획이고, 경과 분석은 케이스 전체를 다른 렌즈로 보는 것이라 화면 전체를
  // 원한다. 형제가 아닌 걸 탭으로 묶으면 "탭을 눌렀는데 화면 전체가 바뀌는" 어긋남이
  // 생긴다. 문으로 만들면 전환이 의도로 읽히고 폭도 전부 쓴다.
  //
  // 되돌아갈 길이 항상 한 자리에 있는 것이 이 구조의 조건이다 — 그래서 뒤로가기는
  // 리포트 상단 고정이고, 배너가 "지금 누구의 리포트인가"를 계속 들고 있다.

  import { fade, fly } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import CasePanelMock from './parts/CasePanelMock.svelte'
  import SessionListMock from './parts/SessionListMock.svelte'
  import AnalysisEntryCard from './parts/AnalysisEntryCard.svelte'
  import ReportBody from './parts/ReportBody.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    view,
    step = 0,
    onRun
  }: {
    report: CaseReportVM
    view: 'empty' | 'running' | 'failed' | 'done'
    step?: number
    onRun: () => void
  } = $props()

  let opened = $state(false)
</script>

{#if !opened}
  <div class="flex min-h-0 flex-1 gap-4" in:fade={{ duration: 120 }}>
    <CasePanelMock {report}>
      {#snippet children()}
        <div class="mb-4 flex h-6 items-center">
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
          >
            경과
          </Typography>
        </div>
        <AnalysisEntryCard {report} {view} onOpen={() => (opened = true)} />
      {/snippet}
    </CasePanelMock>

    <div
      class="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white xl:rounded-2xl xl:border xl:border-gray-200"
    >
      <div
        class="flex h-[58px] shrink-0 items-center border-b border-gray-200 px-6"
      >
        <Typography
          variant="title-01-normal-semibold"
          color="text-title-default"
        >
          진행중인 회기
        </Typography>
      </div>
      <SessionListMock />
    </div>
  </div>
{:else}
  <div
    class="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white xl:rounded-2xl xl:border xl:border-gray-200"
    in:fly={{ x: 16, duration: 200 }}
  >
    <!-- 돌아갈 길은 항상 같은 자리에 — 이게 없으면 '문'이 아니라 '다른 페이지'가 된다 -->
    <div
      class="flex h-[58px] shrink-0 items-center gap-3 border-b border-gray-200 px-6"
    >
      <button
        type="button"
        onclick={() => (opened = false)}
        class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-body-02-normal-medium text-body-default transition-colors hover:bg-gray-50"
      >
        ← 케이스로 돌아가기
      </button>
      <span class="text-body-02-normal-regular text-caption-subtle">·</span>
      <Typography variant="body-02-normal-medium" color="text-title-subtitle">
        AI 경과 분석
      </Typography>
    </div>

    <ReportBody {report} {view} {step} {onRun} />
  </div>
{/if}
