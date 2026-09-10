<script lang="ts">
  // AI 상담 경과 분석 — 탭 본문 전체.
  //
  // 네 상태를 소유한다: 미실행 / 분석 중 / 완료 / 실패.
  // 「분석 중」은 데이터 로딩이 아니라 **작업**이라 스켈레톤이 아니라 단계 진행이다
  // (§loading-skeleton은 곧 도착할 데이터의 자리를 잡아주는 규격이고, 여기는 1~2분
  //  걸리는 LLM 작업의 진행 상태다).
  //
  // 서버가 processing 행을 그대로 돌려주므로(2026-08-31 개편) 화면이 진행을 안다 —
  // 예전에는 completed만 내려와 "눌러도 아무 일 없는" 화면이 됐다.

  import { browser } from '$app/environment'
  import { onDestroy } from 'svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import Button from '$lib/components/Button.svelte'
  import CaseAnalysisReport from './CaseAnalysisReport.svelte'
  import CaseAnalysisRunModal from '$lib/components/modal/CaseAnalysisRunModal.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getCreditBalance } from '$lib/hooks/actions/credit.action'
  import { mapToCreditVM, canAfford } from '$lib/features/credit/view-model'
  import {
    AI_PURPOSE,
    CREDIT_STALE_TIME,
    CREDIT_REFETCH_INTERVAL
  } from '$lib/features/credit/constants'
  import { getSubscription } from '$lib/hooks/actions/subscription.action'
  import {
    mapToSubscriptionVM,
    hasFeature
  } from '$lib/features/subscription/view-model'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import {
    getCaseAnalysisLatest,
    postCaseAnalysis
  } from '$lib/hooks/actions/case-analysis.action'
  import type { CaseAnalysisResult } from '$lib/hooks/actions/case-analysis.action'
  import { buildCaseReport } from '$lib/features/counseling/analysis/view-model'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import type { CounselingCaseBaseDetail } from '$lib/types/counseling'

  interface Props {
    caseDetail: CounselingCaseBaseDetail
    completedSessionCount: number
    canWrite?: boolean
    onSelectSession?: (sessionNumber: number) => void
  }

  let {
    caseDetail,
    completedSessionCount,
    canWrite = false,
    onSelectSession
  }: Props = $props()

  const queryClient = useQueryClient()

  // 실행 게이팅 — 플랜 기능 + 크레딧 잔량. staleTime으로 다른 화면과 캐시를 공유한다.
  const creditQuery = $derived(
    queryBuilder(
      getCreditBalance,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )
  const subQuery = $derived(
    queryBuilder(
      getSubscription,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME,
        refetchInterval: SUBSCRIPTION_REFETCH_INTERVAL
      })
    )
  )
  const isCreditExhausted = $derived(
    !hasFeature(
      subQuery.data ? mapToSubscriptionVM(subQuery.data) : null,
      'ai_case_analysis'
    ) ||
      !canAfford(
        creditQuery.data ? mapToCreditVM(creditQuery.data) : null,
        AI_PURPOSE.CASE_ANALYSIS
      )
  )

  const analysisQuery = $derived(
    queryBuilder(
      getCaseAnalysisLatest,
      () => ({ centerId: $centerId, caseId: caseDetail.case_id }),
      () => ({ enabled: !!$centerId && !!caseDetail.case_id, retry: false })
    )
  )
  const analysis = $derived(
    analysisQuery.data as CaseAnalysisResult | null | undefined
  )
  const status = $derived(analysis?.status ?? null)

  // 리포트의 주체는 케이스다 — 이름은 VM이 caseDetail에서 전원을 읽는다
  // (옛 `clients[0]` 하나만 넘기던 경로는 그룹 케이스에서 사실과 어긋났다).
  const report = $derived(
    analysis && analysis.status === 'completed'
      ? buildCaseReport(analysis, caseDetail, { maskNames: $isSecretMode })
      : null
  )

  // ── 진행 폴링 ──
  // 서버가 status를 주므로 "몇 번 시도했나"가 아니라 "아직 processing인가"로 멈춘다.
  const POLL_INTERVAL = 5_000
  const POLL_LIMIT = 60 // 5분
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollCount = $state(0)

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPoll() {
    stopPoll()
    pollCount = 0
    pollTimer = setInterval(async () => {
      pollCount += 1
      await queryClient.invalidateQueries({
        queryKey: ['getCaseAnalysisLatest'],
        exact: false
      })
      if (pollCount >= POLL_LIMIT) stopPoll()
    }, POLL_INTERVAL)
  }

  $effect(() => {
    if (status === 'processing' && !pollTimer) startPoll()
    if (status !== 'processing') stopPoll()
  })

  onDestroy(() => {
    if (browser) stopPoll()
  })

  // ── 진행 표시 ──────────────────────────────────────────────────────
  // 🔴 **서버에는 단계가 없다.** executor를 끝까지 따라가면 DB 조회 6번 + 프롬프트
  // 조립 + 저장은 전부 합쳐 1초 안쪽이고, 나머지 95%가 `generate_json` 호출 하나다.
  // 옛 화면은 이걸 4단계로 그리고 15초마다 한 칸씩 넘겼는데, 분석이 20초에 끝나면
  // 1단계만 보이고 끝나서 "멈춘 것처럼" 읽혔다 — 서버에 없는 구조를 그린 대가다.
  //
  // 그래서 실제 구조대로 **둘**만 둔다: 모으기(찰나, 이미 끝남) → AI가 읽는 중(전부).
  // 단계로 만들 수 없는 진행감은 **경과 시간**이 대신 진다.
  // (진짜 진척률은 LLM 스트리밍으로만 낼 수 있고, 그건 게이트웨이 계약 변경이다 —
  //  `generate_json`은 지금 `client.quick()`으로 한 번에 받는다.)
  const RUN_STEPS = [
    {
      label: '상담일지 모으기',
      detail: '끝난 회기의 일지와 출결 기록을 시간순으로 모아요'
    },
    {
      label: 'AI가 읽는 중',
      detail: '무엇이 달라졌고 어떤 개입이 통했는지 짚고, 근거 회기를 달아요'
    }
  ]

  // 경과 시간은 **이 화면에서 실행을 눌렀을 때만** 안다.
  // `analysis.created_at`으로 역산하지 않는 이유: 서버가 timezone 없는 UTC를
  // 내려주는데 JS `new Date()`는 그걸 로컬로 읽어 KST에서 9시간이 어긋난다.
  // 모르면 아예 표시하지 않는다(틀린 숫자보다 없는 게 낫다).
  let runStartedAt = $state<number | null>(null)
  let nowMs = $state(Date.now())

  $effect(() => {
    if (status !== 'processing' || runStartedAt === null) return
    const timer = setInterval(() => (nowMs = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  $effect(() => {
    if (status !== 'processing') runStartedAt = null
  })

  const elapsedLabel = $derived.by(() => {
    if (runStartedAt === null) return null
    const sec = Math.floor((nowMs - runStartedAt) / 1000)
    if (sec < 0) return null
    return sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분 ${sec % 60}초`
  })

  // ── 실행 ──
  async function runAnalysis(sessionTake: number | null) {
    try {
      await postCaseAnalysis().request({
        centerId: requireCenterId(),
        caseId: caseDetail.case_id,
        sessionTake
      })
      queryClient.invalidateQueries({
        queryKey: ['getCreditBalance'],
        exact: false
      })
      await queryClient.invalidateQueries({
        queryKey: ['getCaseAnalysisLatest'],
        exact: false
      })
      runStartedAt = Date.now()
      nowMs = Date.now()
      startPoll()
    } catch (e: any) {
      // 429 크레딧 부족은 interceptor가 이미 안내한다
      if (e?.response?.status !== 429)
        snackbarStore.error('분석 실행에 실패했어요.')
      throw e
    }
  }

  function openRunModal() {
    if (isCreditExhausted) {
      snackbarStore.error('AI 크레딧이 부족해요.')
      return
    }
    modalStore.open({
      component: CaseAnalysisRunModal,
      props: {
        completedSessionCount,
        hasPrevious: !!analysis,
        onConfirm: runAnalysis
      },
      // §modal 폭 4단 — 540(기본) / 640(중간) / 740(2단) / 1000(넓음).
      // 이 모달은 한 컬럼(안내 한 줄 또는 범위 라디오 3장 + 비용 행)이라 **기본 540**이다.
      // 640은 폼이 촘촘한 모달의 단이고, 여기서는 짧은 문장 하나가 넓게 퍼져 보였다.
      options: { size: 'sm' }
    })
  }
</script>

{#if analysisQuery.isLoading}
  <div class="flex min-h-0 flex-1 items-center justify-center p-6">
    <span class="text-body-02-normal-regular text-body-subtle">로딩 중...</span>
  </div>
{:else if status === 'processing'}
  <div class="mx-auto flex w-full max-w-[560px] flex-col gap-6 p-6 py-10">
    <div class="text-center">
      <Typography variant="title-01-normal-semibold" color="text-title-default">
        경과 분석을 진행하고 있어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="mt-2 block"
      >
        보통 1~2분 걸려요. 화면을 벗어나도 분석은 계속돼요.
      </Typography>
    </div>

    <!-- 마지막 단계가 늘 활성이다 — 화면이 processing을 볼 때쯤 서버는 이미
         LLM 호출에 들어가 있다(앞 단계는 1초 안쪽에 끝난다). 시간으로 칸을
         넘기지 않으므로 "멈춘 것처럼" 보이던 문제가 사라진다. -->
    <ol class="flex flex-col gap-2">
      {#each RUN_STEPS as step, i}
        {@const isActive = i === RUN_STEPS.length - 1}
        <li
          class="flex gap-3 rounded-xl p-4 {isActive ? 'bg-brand-subtle' : ''}"
        >
          <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
            {#if isActive}
              <span
                class="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500"
              ></span>
            {:else}
              <span
                class="flex h-5 w-5 items-center justify-center rounded-full bg-status-success text-caption-01-normal-medium text-white"
              >
                ✓
              </span>
            {/if}
          </span>
          <div class="min-w-0">
            <p class="text-body-01-normal-medium text-body-strong">
              {step.label}
            </p>
            {#if isActive}
              <p class="mt-2 text-body-03-reading-regular text-body-subtle">
                {step.detail}
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    <!-- 단계로 낼 수 없는 진행감을 시간이 대신 진다. 실행을 이 화면에서 누른
         경우에만 뜬다(위 runStartedAt 주석 참고). -->
    {#if elapsedLabel}
      <p class="text-center text-body-03-normal-regular text-body-subtle">
        {elapsedLabel} 지났어요
      </p>
    {/if}
  </div>
{:else if status === 'failed'}
  <div
    class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      분석을 마치지 못했어요
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-body-subtle">
      일시적인 문제일 수 있어요. 크레딧은 차감되지 않았어요.
    </Typography>
    {#if canWrite}
      <Button
        color="white-action"
        size="title"
        content="다시 시도"
        class="mt-2"
        onclick={openRunModal}
      />
    {/if}
  </div>
{:else if report}
  <CaseAnalysisReport
    {report}
    canRerun={canWrite}
    onRerun={openRunModal}
    {onSelectSession}
  />
{:else}
  <!-- 판 높이가 고정(940)이라 세로 중앙에 두면 내용이 한참 아래에 떠 보인다.
       상단 기준으로 놓되 헤더에 붙지 않도록 위 여백을 넉넉히(80) 준다. -->
  <div
    class="flex min-h-0 flex-1 flex-col items-center gap-4 px-6 pt-20 pb-10 text-center"
  >
    <div
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-50"
    >
      <AiStarIcon20 />
    </div>
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      아직 경과 분석이 없어요
    </Typography>
    <!-- 🔴 안내문은 `reading`(150%) 변형이다. 옛 `body-02-normal-regular`는
         행간이 폰트 크기와 같아(15px 글자에 15px 행간) 두 줄이 붙어 읽혔다 —
         §Typography "여러 줄 텍스트는 반드시 reading". `<br />`로 줄을 끊던 것도
         뺐다: 폭에 맞춰 접히게 두고 `max-w`로 한 줄 길이만 잡는다. -->
    {#if completedSessionCount < 2}
      <p class="max-w-[420px] text-body-02-reading-regular text-body-subtle">
        끝난 회기가 2개 이상이어야 흐름을 볼 수 있어요.
      </p>
    {:else}
      <p class="max-w-[420px] text-body-01-reading-regular text-body-default">
        끝난 회기 {completedSessionCount}개의 상담일지를 한 번에 읽어, 무엇이
        달라졌고 어떤 개입 기법이 통했는지 정리해요.
      </p>
      {#if canWrite}
        <Button
          size="title"
          content="경과 분석 실행"
          disabled={isCreditExhausted}
          onclick={openRunModal}
          class="mt-2 h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
        />
          
        {#if isCreditExhausted}
          <span class="text-body-03-normal-regular text-status-warning">
            AI 크레딧이 부족해요 ·
            <a href="/subscription/ai-usage" class="underline">사용량 확인</a>
          </span>
        {/if}
      {/if}
    {/if}
  </div>
{/if}
