<script lang="ts">
  /**
   * 검사 단계 화면 — 검사 종류·단계와 무관한 단일 진입점.
   *
   * 모듈 선언에서 현재 step을 찾아 컴포넌트를 지연 로딩하고,
   * 진입 불가한 상태면 갈 수 있는 단계로 되돌린다.
   */
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import { resolveActiveStep } from '$lib/features/examination/core/module'
  import type { Component } from 'svelte'

  const ctx = getExamContext()

  let examId = $derived(page.params.examId ?? '')
  let stepKey = $derived(page.params.step ?? '')
  let step = $derived(ctx.module.steps.find((s) => s.key === stepKey))

  /**
   * 없는 단계로 들어오면 갈 수 있는 단계로 보낸다.
   *
   * exam뿐 아니라 **progress까지** 기다린다. progress를 모르는 채로 부르면
   * resolveActiveStep이 (규약대로) 첫 단계를 돌려주므로, 확정된 검사를 열어도
   * 원자료 화면으로 보내진 뒤 그대로 머문다 — 이 effect는 한 번 이동시키고
   * 끝나기 때문이다. 아래 첫 진입 판정이 같은 이유로 이미 progress를
   * 기다리고 있었는데 여기만 빠져 있었다.
   */
  $effect(() => {
    if (!stepKey || step || !ctx.exam?.progress) return
    const fallback = resolveActiveStep(ctx.module, ctx.gate)
    goto(`/examinations/${examId}/${fallback.key}`, { replaceState: true })
  })

  /**
   * 첫 진입 시 진행 상황에 맞는 단계로 옮긴다. **아래 잠금 가드보다 먼저.**
   *
   * 목록·대시보드는 progress를 모르므로 examProgressPath가 무조건 첫 단계로
   * 보낸다(exam-route.ts 주석). 도착한 뒤 여기서 실제 단계로 옮긴다.
   *
   * 이 이동은 사용자가 요청한 게 아니라 시스템 폴백이므로 **조용히** 옮긴다.
   * 잠금 가드가 먼저 돌면 "반응 영역 기록은 완료되어 수정할 수 없습니다" 같은
   * 경고가 뜨는데, 완료된 검사를 목록에서 열었을 뿐인데 경고를 보는 셈이 된다.
   *
   * 한 번만 판정한다. 이후 사이드바로 이전 단계를 다시 여는 것은 의도된
   * 이동이므로 되돌리지 않는다.
   */
  /**
   * $state로 둬야 아래 잠금 가드가 이 값의 변화에 반응한다.
   * 대신 이 effect 자신은 untrack으로 읽어 자기 쓰기에 재실행되지 않게 한다.
   */
  let didResolveEntry = $state(false)
  $effect(() => {
    if (!ctx.exam || !step) return
    if (untrack(() => didResolveEntry)) return
    // progress가 아직 없으면 판정을 미룬다 — 없는 채로 고르면 첫 단계가 나온다.
    if (!ctx.exam.progress) return
    didResolveEntry = true

    const target = resolveActiveStep(ctx.module, ctx.gate)
    if (target.key !== step.key) {
      goto(`/examinations/${examId}/${target.key}`, { replaceState: true })
    }
  })

  /**
   * 아직 열리지 않은 단계면 사유를 알리고 되돌린다.
   *
   * 위 첫 진입 판정이 끝난 뒤(didResolveEntry)에만 동작한다 — 그 전에 돌면
   * 시스템 폴백 이동에 사용자 대상 경고가 붙는다. 여기 걸리는 건 사용자가
   * 직접 잠긴 단계로 이동을 시도한 경우다.
   */
  $effect(() => {
    if (!ctx.exam || !step?.enabled) return
    if (!didResolveEntry) return
    if (step.enabled(ctx.gate)) return

    const fallback = resolveActiveStep(ctx.module, ctx.gate)
    if (fallback.key === step.key) return
    if (step.lockedHint) snackbarStore.info(step.lockedHint)
    goto(`/examinations/${examId}/${fallback.key}`, { replaceState: true })
  })

  /**
   * 단계 컴포넌트 지연 로딩.
   *
   * 한 번 받은 모듈은 캐시한다. 동적 import 자체는 브라우저가 캐시하지만
   * `.then()`이 마이크로태스크라 매번 한 프레임은 비어 있게 되고, 그 사이
   * 폴백이 그려졌다 사라지면서 화면이 딸깍인다. 캐시가 있으면 같은 틱에
   * 값을 정할 수 있어 그 프레임이 사라진다.
   *
   * 키는 모듈 타입 + 단계다 — 검사 종류가 다르면 같은 'collect'라도 다른
   * 컴포넌트다(HTP·SCT·로르샤하가 전부 collect를 쓴다).
   */
  const moduleCache = new Map<string, Component<any>>()
  let StepComponent = $state<Component<any> | null>(null)

  $effect(() => {
    const current = step
    if (!current) return

    const key = `${ctx.module.type}:${current.key}`
    const cached = moduleCache.get(key)
    if (cached) {
      // 같은 틱에 정한다 — 폴백을 거치지 않는다.
      StepComponent = cached
      return
    }

    let cancelled = false
    void current.component().then((m) => {
      moduleCache.set(key, m.default)
      if (!cancelled) StepComponent = m.default
    })
    return () => {
      cancelled = true
    }
  })

  /**
   * 첫 로드에만 폴백을 띄운다.
   *
   * 이 폴백은 ExamLayoutShell **바깥**이라 헤더·사이드바까지 통째로
   * 사라진다. 단계를 옮길 때마다 그러면 크롬 전체가 깜빡인다 —
   * 한 번이라도 화면을 그린 뒤에는 이전 화면을 그대로 두고 교체한다.
   *
   * (전환이 느리게 느껴질 일은 없다. 캐시된 단계는 같은 틱에 바뀌고,
   *  처음 가는 단계도 청크 하나를 받는 시간뿐이다.)
   */
  let everRendered = $state(false)
  $effect(() => {
    if (StepComponent) everRendered = true
  })
</script>

{#if StepComponent}
  <StepComponent />
{:else if !everRendered}
  <div class="flex h-screen items-center justify-center bg-gray-50">
    <div
      class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"
    ></div>
  </div>
{/if}
