<script lang="ts">
  import { page } from '$app/state'
  import { goto, beforeNavigate } from '$app/navigation'
  import { institutionId, requireInstitutionId } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'
  import { reportService } from '$lib/features/report/report-service'
  import {
    REPORT_STATUS_CONFIG,
    examTypeLabel,
    isReportConfirmed,
    isReportFinalized
  } from '$lib/features/report/constants'
  import type { ComprehensiveReport, ReportSection } from '$lib/features/report/types'

  let report = $state<ComprehensiveReport | null>(null)
  let sections = $state<ReportSection[]>([])
  let savedSnapshot = $state('')
  let isLoading = $state(true)
  let saving = $state(false)
  let generating = $state(false)
  let exporting = $state(false)
  let confirming = $state(false)
  // 사용자가 직접 편집한 섹션 키 (저장 시 source=clinician 으로 표시 → CDSS)
  let editedKeys = $state(new Set<string>())

  let clientId = $derived(page.params.id ?? '')
  let reportId = $derived(page.params.reportId ?? '')
  let dirty = $derived(JSON.stringify(sections) !== savedSnapshot)
  let statusCfg = $derived(
    report ? REPORT_STATUS_CONFIG[report.status] ?? { label: report.status, dot: 'bg-gray-400', text: 'text-gray-600' } : null
  )
  let canExport = $derived(!!report && isReportConfirmed(report.status))
  let isFinalized = $derived(!!report && isReportFinalized(report.status))
  let busy = $derived(saving || generating || exporting || confirming)

  $effect(() => {
    const instId = $institutionId
    if (!instId || !reportId) return
    load(instId, reportId)
  })

  async function load(instId: string, rid: string) {
    isLoading = true
    try {
      const r = await reportService.get(instId, rid)
      applyReport(r)
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail ?? '보고서를 불러오지 못했습니다.')
      report = null
    } finally {
      isLoading = false
    }
  }

  function applyReport(r: ComprehensiveReport) {
    report = r
    sections = r.sections.map((s) => ({ ...s }))
    savedSnapshot = JSON.stringify(sections)
    editedKeys = new Set()
  }

  function onSectionInput(key: string) {
    editedKeys.add(key)
  }

  async function handleSave() {
    if (!report || saving) return
    saving = true
    try {
      const instId = requireInstitutionId()
      // 사용자가 편집한 섹션은 clinician 소유로 표시 (AI 재생성 시 보존)
      const payload = sections.map((s) =>
        editedKeys.has(s.key) && s.source !== 'clinician'
          ? { ...s, source: 'clinician' as const }
          : s
      )
      const updated = await reportService.saveSections(instId, report.id, payload)
      applyReport(updated)
      snackbarStore.success('저장되었습니다.')
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail ?? '저장에 실패했습니다.')
    } finally {
      saving = false
    }
  }

  async function handleGenerateDraft() {
    if (!report || generating) return
    if (dirty) {
      const ok = await modalUtils.confirm(
        '저장하지 않은 변경사항이 있습니다. 저장 후 AI 초안을 생성할까요?',
        'AI 초안 생성',
        { confirmText: '저장 후 생성', cancelText: '취소' }
      )
      if (!ok) return
      await handleSave()
    }
    const ok = await modalUtils.confirm(
      'AI가 검사 결과를 바탕으로 비어 있는 섹션(종합 소견·제언 등)에 초안을 채웁니다. 임상가가 직접 작성·편집한 섹션은 변경되지 않습니다.',
      'AI 초안 생성',
      { confirmText: '초안 생성', cancelText: '취소' }
    )
    if (!ok) return
    generating = true
    try {
      const instId = requireInstitutionId()
      const updated = await reportService.generateDraft(instId, report.id, 'fill_empty')
      applyReport(updated)
      snackbarStore.success('AI 초안이 생성되었습니다.')
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail ?? 'AI 초안 생성에 실패했습니다.')
    } finally {
      generating = false
    }
  }

  async function handleConfirm() {
    if (!report || confirming) return
    const ok = await modalUtils.confirm(
      '보고서를 확정하면 이후 PDF를 생성할 수 있습니다. 확정하시겠습니까?',
      '보고서 확정',
      { confirmText: '확정', cancelText: '취소' }
    )
    if (!ok) return
    confirming = true
    try {
      const instId = requireInstitutionId()
      // 확정 전 현재 편집 내용 저장 (draft/ai_generated → under_review 전이 포함)
      const payload = sections.map((s) =>
        editedKeys.has(s.key) && s.source !== 'clinician'
          ? { ...s, source: 'clinician' as const }
          : s
      )
      await reportService.saveSections(instId, report.id, payload)
      const confirmed = await reportService.confirm(instId, report.id)
      applyReport(confirmed)
      snackbarStore.success('보고서가 확정되었습니다.')
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail ?? '확정에 실패했습니다.')
    } finally {
      confirming = false
    }
  }

  async function handleExport() {
    if (!report || exporting) return
    exporting = true
    try {
      const instId = requireInstitutionId()
      await reportService.downloadPdf(instId, report.id)
      // 상태(report_generated) 갱신 반영
      const refreshed = await reportService.get(instId, report.id)
      report = refreshed
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail ?? 'PDF 생성에 실패했습니다.')
    } finally {
      exporting = false
    }
  }

  // 미저장 변경 이탈 방지
  beforeNavigate((nav) => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 페이지를 벗어나시겠습니까?')) {
      nav.cancel()
    }
  })

  function fmt(d: string | null): string {
    if (!d) return '-'
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? '-' : `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
  }
</script>

<svelte:window
  onbeforeunload={(e) => {
    if (dirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }}
/>

<div class="fixed inset-0 z-50 flex h-screen overflow-hidden bg-gray-50">
  <!-- 좌측 사이드바: 검사 결과 -->
  <div class="hidden w-72 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
    <div class="px-5 pb-4 pt-5">
      <button
        type="button"
        onclick={() => goto(`/clients/${clientId}`)}
        class="mb-3 inline-flex items-center gap-1 text-label-01-normal-regular text-gray-500 transition-colors hover:text-gray-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        내담자로 돌아가기
      </button>
      <h1 class="text-headline-02-normal-bold text-gray-900">종합보고서</h1>
      <p class="mt-1 text-body-03-normal-regular text-gray-500">심리학적 평가보고서</p>
    </div>

    <div class="border-b border-gray-200 px-5 pb-2">
      <span class="text-label-02-normal-semibold uppercase tracking-wider text-gray-400">검사 결과</span>
    </div>

    <nav class="flex-1 overflow-y-auto py-2">
      {#if report}
        <ul class="flex flex-col gap-1 px-3">
          {#each report.linked_examinations as ex (ex.examination_id)}
            <li class="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span class="inline-flex h-7 w-11 shrink-0 items-center justify-center rounded bg-primary-50 text-label-02-normal-semibold text-primary-700">
                {examTypeLabel(ex.exam_type)}
              </span>
              <div class="min-w-0">
                <p class="truncate text-body-03-normal-regular {ex.is_deleted ? 'text-gray-400 line-through' : 'text-gray-700'}">
                  {ex.exam_type_label}
                </p>
                <p class="text-label-02-normal-regular text-gray-500">
                  {ex.is_deleted ? '원본 검사 삭제됨' : fmt(ex.exam_date)}
                </p>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </nav>

    <div class="flex h-16 shrink-0 flex-col justify-center border-t border-gray-200 px-5">
      {#if report}
        <p class="text-body-03-normal-semibold leading-snug text-gray-900">{report.client_name ?? '내담자'}</p>
        <p class="text-label-02-normal-regular text-gray-500">검사자 | {report.examiner_name ?? '-'}</p>
      {/if}
    </div>
  </div>

  <!-- 메인 -->
  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    <!-- 헤더 -->
    <header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:px-6">
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="truncate text-body-01-normal-semibold text-gray-900">
          {report?.title ?? '종합 심리평가 보고서'}
        </h2>
        {#if statusCfg}
          <span class="inline-flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-label-02-normal-medium {statusCfg.text}">
            <span class="h-1.5 w-1.5 rounded-full {statusCfg.dot}"></span>
            {statusCfg.label}
          </span>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          onclick={handleGenerateDraft}
          disabled={busy || isFinalized}
          class="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/></svg>
          {generating ? '생성 중...' : 'AI 초안 생성'}
        </button>
        <button
          onclick={handleSave}
          disabled={busy || !dirty || isFinalized}
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-body-03-normal-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {#if !canExport}
          <button
            onclick={handleConfirm}
            disabled={busy}
            class="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirming ? '확정 중...' : '확정'}
          </button>
        {:else}
          <button
            onclick={handleExport}
            disabled={busy}
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {exporting ? '생성 중...' : 'PDF 내보내기'}
          </button>
        {/if}
      </div>
    </header>

    <!-- 문서 캔버스 -->
    <main class="flex-1 overflow-y-auto bg-background">
      {#if isLoading}
        <div class="flex h-full items-center justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"></div>
        </div>
      {:else if !report}
        <div class="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
          <p class="text-sm font-medium">보고서를 찾을 수 없습니다</p>
          <a href={`/clients/${clientId}`} class="text-sm text-primary-600 hover:underline">내담자로 돌아가기</a>
        </div>
      {:else}
        <div class="mx-auto max-w-3xl px-4 py-8 md:px-8">
          <div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-12">
            <div class="mb-8 border-b border-gray-200 pb-6 text-center">
              <p class="text-xs tracking-[0.2em] text-gray-400">PSYCHOLOGICAL ASSESSMENT REPORT</p>
              <h1 class="mt-2 text-2xl font-bold text-gray-900">{report.title ?? '종합 심리평가 보고서'}</h1>
            </div>

            {#each sections as section (section.key)}
              <section class="mb-7">
                <div class="mb-2 flex items-center gap-2">
                  <h3 class="border-l-4 border-primary-500 pl-2.5 text-sm font-bold text-gray-800">
                    {section.title}
                  </h3>
                  {#if section.source === 'ai'}
                    <span class="rounded bg-purple-100 px-1.5 py-0.5 text-caption-01-normal-medium text-purple-700">AI</span>
                  {:else if section.source === 'clinician'}
                    <span class="rounded bg-blue-100 px-1.5 py-0.5 text-caption-01-normal-medium text-blue-700">임상가</span>
                  {/if}
                </div>
                {#if section.editable && !isFinalized}
                  <textarea
                    bind:value={section.body}
                    oninput={() => onSectionInput(section.key)}
                    rows={Math.max(3, (section.body?.split('\n').length ?? 1) + 1)}
                    placeholder="{section.title} 내용을 입력하세요"
                    class="w-full resize-y rounded-lg border border-gray-200 bg-gray-50/40 px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  ></textarea>
                {:else}
                  <div class="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-2.5 text-sm leading-relaxed text-gray-700">{section.body || '(작성된 내용 없음)'}</div>
                {/if}
              </section>
            {/each}

            {#if report.ai_generated_at}
              <p class="mt-8 border-t border-gray-100 pt-4 text-label-02-normal-regular text-gray-400">
                AI 초안 생성: {fmt(report.ai_generated_at)} · 모델 {report.ai_model_version ?? '-'} · 최종 해석·확정은 임상가 책임(CDSS)
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </main>
  </div>
</div>
