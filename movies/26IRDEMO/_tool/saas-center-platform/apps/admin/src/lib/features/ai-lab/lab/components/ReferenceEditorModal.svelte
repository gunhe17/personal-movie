<script lang="ts">
  import { setSampleReference, type ReferenceSegment } from '$hooks/actions/aiLab.action'
  import { snackbarStore } from '$stores/snackbar'

  let {
    open = false,
    sampleId = '',
    sampleName = '',
    initialSegments = [],
    onClose,
    onSaved,
  }: {
    open: boolean
    sampleId: string
    sampleName?: string
    initialSegments: ReferenceSegment[]
    onClose: () => void
    onSaved: () => void
  } = $props()

  const SPEAKERS = ['A', 'B', 'C', 'D'] as const
  const COLORS: Record<string, string> = {
    A: 'bg-violet-100 text-violet-700',
    B: 'bg-emerald-100 text-emerald-700',
    C: 'bg-orange-100 text-orange-700',
    D: 'bg-blue-100 text-blue-700',
  }

  let segments = $state<ReferenceSegment[]>([])
  let saving = $state(false)
  let seededFor = $state<string | null>(null)

  // open 될 때 1회 시드 (편집 중 재시드 방지)
  $effect(() => {
    if (open && seededFor !== sampleId) {
      segments = initialSegments.map((s) => ({ ...s }))
      seededFor = sampleId
    }
    if (!open) seededFor = null
  })

  function cycleSpeaker(i: number) {
    const cur = segments[i].speaker
    const idx = SPEAKERS.indexOf(cur as (typeof SPEAKERS)[number])
    segments[i].speaker = SPEAKERS[(idx + 1) % SPEAKERS.length]
  }

  function fmtTime(sec: number): string {
    const s = Math.floor(sec)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const speakerCount = $derived(new Set(segments.map((s) => s.speaker)).size)

  async function save() {
    if (segments.length === 0) return
    saving = true
    try {
      await setSampleReference().request({ sampleId, segments })
      snackbarStore.success('정답이 저장되었습니다.')
      onSaved()
      onClose()
    } catch {
      snackbarStore.error('정답 저장에 실패했습니다.')
    } finally {
      saving = false
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onclick={(e) => e.stopPropagation()}>
      <!-- 헤더 -->
      <div class="shrink-0 border-b border-gray-100 px-6 py-4">
        <h3 class="text-sm font-semibold text-gray-900">정답(화자) 만들기</h3>
        <p class="mt-0.5 text-xs text-gray-500">
          각 발화의 화자 라벨을 클릭해 올바르게 교정한 뒤 저장하세요. 이 정답으로 음향·텍스트 결과의 정확도를 측정합니다.
          {#if sampleName}· <span class="text-gray-400">{sampleName}</span>{/if}
        </p>
      </div>

      <!-- 세그먼트 편집 -->
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {#if segments.length === 0}
          <p class="py-16 text-center text-sm text-gray-400">세그먼트가 없습니다.</p>
        {:else}
          <div class="space-y-1.5">
            {#each segments as seg, i}
              <div class="flex items-start gap-2">
                <button
                  class="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold transition-transform hover:scale-105 {COLORS[seg.speaker] ?? 'bg-gray-100 text-gray-600'}"
                  onclick={() => cycleSpeaker(i)}
                  title="클릭해서 화자 변경"
                >
                  {seg.speaker}
                </button>
                <span class="shrink-0 pt-0.5 font-mono text-xs text-gray-400 tabular-nums">{fmtTime(seg.start)}</span>
                <span class="text-sm leading-relaxed text-gray-700">{seg.text}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 푸터 -->
      <div class="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
        <span class="text-xs text-gray-400">{segments.length}개 발화 · 화자 {speakerCount}명</span>
        <div class="flex gap-2">
          <button
            class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            onclick={onClose}
          >취소</button>
          <button
            class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            onclick={save}
            disabled={saving || segments.length === 0}
          >{saving ? '저장 중…' : '정답 저장'}</button>
        </div>
      </div>
    </div>
  </div>
{/if}
