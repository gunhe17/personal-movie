<script lang="ts">
  // ─────────────────────────────────────────────────────────────
  // 진입 구조 A — 우측 컨테이너 탭
  // ─────────────────────────────────────────────────────────────
  //
  // 탭바를 우측 컨테이너 머리에 두고 좌측 케이스 패널은 항상 유지한다.
  // 바뀌는 범위가 탭바 아래로 한정돼 눈에 보이고, 화면 절반이 제자리에 남는다.
  //
  // 대가는 폭이다. 1920 기준 우측 컨테이너 ≈ 1,094 → 판단 레일(320)을 빼면 본문
  // 774. 플로우시트 최소폭이 760이라 겨우 들어가고, 1440에서는 표가 가로 스크롤된다.
  // 이 트레이드오프는 설명이 아니라 여기서 직접 보이는 게 맞다.

  import TabBar from '$lib/components/TabBar.svelte'
  import CasePanelMock from './parts/CasePanelMock.svelte'
  import SessionListMock from './parts/SessionListMock.svelte'
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

  let activeTab = $state('analysis')
</script>

<div class="flex min-h-0 flex-1 gap-4">
  <CasePanelMock {report} />

  <div
    class="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white xl:rounded-2xl xl:border xl:border-gray-200"
  >
    <TabBar
      bind:activeTab
      tabs={[
        { value: 'sessions', label: '회기 목록' },
        { value: 'analysis', label: '경과 분석' }
      ]}
      class="shrink-0 px-6"
      tabClass="xl:w-[140px] xl:px-0"
    />

    {#if activeTab === 'sessions'}
      <SessionListMock />
    {:else}
      <ReportBody {report} {view} {step} {onRun} />
    {/if}
  </div>
</div>
