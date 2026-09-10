<script lang="ts">
  /**
   * 소견 작성 모드 — 보고서를 보며 검사별 소견을 쓰는 전용 풀스크린 화면
   *
   * 3열: 검사 레일(280) · 보고서/결과(flex) · 소견 에디터(440).
   * 저장은 검사 단위 — 저장하면 레일 체크가 켜지고 그 자리에 머문다.
   * 읽기 전용 열람은 이 화면이 아니라 검사 상세 패널의 소견 블록이 맡는다.
   */
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import CompleteCheckIcon20 from '$lib/assets/CompleteCheckIcon20.svelte'
  import CloseStrokeIcon20 from '$lib/assets/CloseStrokeIcon20.svelte'
  import ArrowRightIcon16 from '$lib/assets/ArrowRightIcon16.svelte'
  import {
    AssessmentReportViewer,
    AssessmentResultView
  } from '$lib/components/assessment/status'
  import { modalStore } from '$lib/stores/modal'
  import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'
  import { ASSESSMENT_STATUS_LABELS } from '$lib/features/assessment/status-detail/constants'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'

  let {
    assessments,
    initialAssessmentId,
    clientName,
    clientBirthDate,
    clientCode,
    onSave,
    onClose
  } = $props<{
    /** 소견 대상 검사 (taskId 있는 것만) */
    assessments: AssessmentItem[]
    initialAssessmentId: string
    clientName?: string
    clientBirthDate?: string
    clientCode?: string
    /** 검사 하나 저장 — 성공 시 resolve, 실패 시 throw */
    onSave: (taskId: string, opinion: string | null) => Promise<void>
    onClose: () => void
  }>()

  const MAX_LENGTH = 5000

  let selectedId = $state(initialAssessmentId || assessments[0]?.id || '')
  let segment = $state<'report' | 'result'>('report')
  let isSaving = $state(false)

  /** 편집 중인 값 */
  const drafts = $state<Record<string, string>>({})
  /** 서버에 저장된 것으로 아는 값 (dirty 판정 기준) */
  const saved = $state<Record<string, string>>({})

  $effect(() => {
    for (const a of assessments) {
      if (!(a.id in drafts)) {
        drafts[a.id] = a.opinion ?? ''
        saved[a.id] = a.opinion ?? ''
      }
    }
  })

  const selected = $derived(
    assessments.find((a: AssessmentItem) => a.id === selectedId) ?? null
  )
  const writtenCount = $derived(
    assessments.filter((a: AssessmentItem) => (saved[a.id] ?? '').trim())
      .length
  )
  const draftText = $derived(drafts[selectedId] ?? '')
  const isDirty = $derived(
    (drafts[selectedId] ?? '').trim() !== (saved[selectedId] ?? '').trim()
  )

  /** 다음으로 넘어갈 검사 = 아직 소견이 없는 다음 검사, 없으면 바로 다음 검사 */
  const nextTarget = $derived.by(() => {
    const idx = assessments.findIndex((a: AssessmentItem) => a.id === selectedId)
    if (idx < 0) return null
    const rotated = [
      ...assessments.slice(idx + 1),
      ...assessments.slice(0, idx)
    ] as AssessmentItem[]
    return (
      rotated.find((a) => !(saved[a.id] ?? '').trim()) ?? rotated[0] ?? null
    )
  })

  /** 예외 상태만 레일에 표기 (진행 중인 검사는 검사명만) */
  function exceptionLabel(a: AssessmentItem): string | null {
    if (a.status === 'completed' || a.status === 'submitted') return null
    return ASSESSMENT_STATUS_LABELS[a.status] ?? null
  }

  /** 미저장 상태에서 이탈할 때 확인 — 확인하면 run() 실행 */
  function guardDirty(run: () => void) {
    if (!isDirty) {
      run()
      return
    }
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '저장하지 않은 소견이 있어요',
        description: '지금 이동하면 작성 중인 내용이 사라져요.',
        cancelText: '계속 작성',
        confirmText: '이동',
        type: 'warning',
        onConfirm: () => {
          drafts[selectedId] = saved[selectedId] ?? ''
          run()
        }
      },
      options: { customWidth: 420 }
    })
  }

  function selectAssessment(id: string) {
    if (id === selectedId) return
    guardDirty(() => {
      selectedId = id
    })
  }

  function requestClose() {
    guardDirty(onClose)
  }

  async function save(): Promise<boolean> {
    if (isSaving || !selected?.taskId) return false
    const next = (drafts[selectedId] ?? '').trim()
    if (next === (saved[selectedId] ?? '').trim()) return true
    isSaving = true
    try {
      await onSave(selected.taskId, next || null)
      saved[selectedId] = next
      return true
    } catch {
      // 스낵바는 서비스가 띄운다
      return false
    } finally {
      isSaving = false
    }
  }

  async function saveAndNext() {
    const target = nextTarget
    if (await save()) {
      if (target) selectedId = target.id
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      requestClose()
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="fixed inset-0 z-9990 flex flex-col bg-white"
  transition:fade={{ duration: 160 }}
>
  <!-- 헤더 — 누구의 소견인지 + 전체 진행 + 닫기 -->
  <header
    class="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-6"
  >
    <div class="flex min-w-0 items-baseline gap-3">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-gray-900"
        className="truncate-safe"
      >
        {clientName ? `${clientName}의 검사 소견` : '검사 소견'}
      </Typography>
      {#if clientCode}
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          {clientCode}
        </Typography>
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-4">
      <Typography variant="body-02-normal-medium" color="text-gray-600">
        {writtenCount}/{assessments.length} 완료
      </Typography>
      <button
        type="button"
        aria-label="닫기"
        onclick={requestClose}
        class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <CloseStrokeIcon20 />
      </button>
    </div>
  </header>

  <div class="flex min-h-0 flex-1">
    <!-- 좌: 검사 레일 -->
    <nav
      class="flex w-70 shrink-0 flex-col border-r border-gray-200 bg-bg-base"
    >
      <div class="flex h-14 shrink-0 items-center px-5">
        <Typography variant="body-01-normal-semibold" color="text-gray-900">
          검사 {assessments.length}
        </Typography>
      </div>
      <!-- 선택 배경은 full-bleed 금지 — px-5 인셋 + rounded-lg -->
      <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {#each assessments as a (a.id)}
          {@const isActive = a.id === selectedId}
          {@const isWritten = !!(saved[a.id] ?? '').trim()}
          {@const exception = exceptionLabel(a)}
          <button
            type="button"
            onclick={() => selectAssessment(a.id)}
            class="flex w-full items-center gap-2 rounded-lg p-3 text-left transition-colors {isActive
              ? 'bg-primary-50'
              : 'hover:bg-gray-100'}"
          >
            <span class="flex h-5 w-5 shrink-0 items-center justify-center">
              {#if isWritten}
                <CompleteCheckIcon20 />
              {:else}
                <!-- svelte-ignore element_invalid_self_closing_tag -->
                <span
                  class="h-1.5 w-1.5 rounded-full {isActive
                    ? 'bg-primary-500'
                    : 'bg-gray-300'}"
                  aria-hidden="true"
                />
              {/if}
            </span>
            <Typography
              variant="body-02-normal-medium"
              tag="span"
              color={isActive ? 'text-primary-600' : 'text-gray-700'}
              className="min-w-0 flex-1 truncate-safe"
            >
              {a.name}
            </Typography>
            {#if exception}
              <Typography
                variant="body-03-normal-regular"
                tag="span"
                color="text-gray-400"
                className="shrink-0"
              >
                {exception}
              </Typography>
            {/if}
          </button>
        {/each}
      </div>
    </nav>

    <!-- 중앙: 보고서 / 결과 -->
    <section class="flex min-h-0 min-w-0 flex-1 flex-col">
      <!-- 좌 검사명 · 가운데 토글 (3슬롯 — 우측은 비움) -->
      <div
        class="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-gray-200 px-6"
      >
        <Typography
          variant="title-01-normal-semibold"
          color="text-body-strong"
          className="min-w-0 truncate-safe"
        >
          {selected?.name ?? ''}
        </Typography>
        <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {#each [{ key: 'report', label: '보고서' }, { key: 'result', label: '결과' }] as tab (tab.key)}
            <button
              type="button"
              onclick={() => (segment = tab.key as 'report' | 'result')}
              class="h-8 w-20 rounded-md text-body-02-normal-medium transition-colors {segment ===
              tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}"
            >
              {tab.label}
            </button>
          {/each}
        </div>
        <div></div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto py-6">
        {#if selected}
          {#key selected.id + segment}
            {#if segment === 'report'}
              <AssessmentReportViewer
                assessment={selected}
                {clientName}
                {clientBirthDate}
              />
            {:else}
              <AssessmentResultView assessment={selected} />
            {/if}
          {/key}
        {/if}
      </div>
    </section>

    <!-- 우: 소견 에디터 -->
    <aside class="flex w-110 shrink-0 flex-col border-l border-gray-200">
      <div class="flex h-14 shrink-0 items-center justify-between px-6">
        <Typography variant="body-01-normal-semibold" color="text-gray-900">
          검사 소견
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          {draftText.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </Typography>
      </div>
      <div class="flex min-h-0 flex-1 flex-col px-6 pb-6">
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={drafts[selectedId]}
          maxlength={MAX_LENGTH}
          placeholder="검사 결과를 바탕으로 소견을 작성해주세요"
          class="min-h-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white p-4 text-body-01-reading-regular text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400"
        />
      </div>
      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-3"
      >
        {#if nextTarget}
          <button
            type="button"
            onclick={saveAndNext}
            disabled={isSaving}
            class="flex h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-4 text-body-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            저장 후 다음
            <ArrowRightIcon16 color="currentColor" strokeWidth={1.5} />
          </button>
        {/if}
        <button
          type="button"
          onclick={save}
          disabled={isSaving || !isDirty}
          class="h-11 w-35 rounded-lg bg-primary-500 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </aside>
  </div>
</div>
