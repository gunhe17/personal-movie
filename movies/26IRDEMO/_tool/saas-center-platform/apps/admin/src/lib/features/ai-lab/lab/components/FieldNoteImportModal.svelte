<script lang="ts">
  import { formatDateKST } from '../../constants'
  import {
    getFieldNoteCandidates,
    importFieldNoteSample,
    type FieldNoteCandidate,
  } from '$hooks/actions/aiLab.action'
  import { snackbarStore } from '$stores/snackbar'

  let {
    open = false,
    onClose,
    onImported,
  }: {
    open: boolean
    onClose: () => void
    onImported: () => void
  } = $props()

  let candidates = $state<FieldNoteCandidate[]>([])
  let isLoading = $state(false)
  let importingId = $state<string | null>(null)
  let loadedOnce = $state(false)

  async function load() {
    isLoading = true
    try {
      const res = await getFieldNoteCandidates().request({ limit: 100 })
      candidates = res.items ?? []
      loadedOnce = true
    } catch {
      snackbarStore.error('필드노트 녹음 목록을 불러오지 못했습니다.')
    } finally {
      isLoading = false
    }
  }

  // open 될 때 1회 로드
  $effect(() => {
    if (open && !loadedOnce && !isLoading) load()
  })

  async function handleImport(c: FieldNoteCandidate) {
    if (c.already_imported || importingId) return
    importingId = c.field_note_id
    try {
      await importFieldNoteSample().request({ field_note_id: c.field_note_id })
      snackbarStore.success('샘플로 가져왔습니다.')
      // 로컬 상태 갱신 (등록됨 표시)
      candidates = candidates.map((x) =>
        x.field_note_id === c.field_note_id ? { ...x, already_imported: true } : x,
      )
      onImported()
    } catch {
      snackbarStore.error('가져오기에 실패했습니다.')
    } finally {
      importingId = null
    }
  }

  function fmtDuration(sec: number): string {
    const s = Math.round(sec)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`
  }

  function diarizeBadge(status: string | null): { label: string; cls: string } {
    if (status === 'completed') return { label: '화자분리됨', cls: 'bg-violet-50 text-violet-600' }
    if (status === 'processing') return { label: '분리 중', cls: 'bg-amber-50 text-amber-600' }
    return { label: '평문', cls: 'bg-gray-100 text-gray-500' }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onclick={(e) => e.stopPropagation()}>
      <!-- 헤더 -->
      <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">필드노트에서 가져오기</h3>
          <p class="mt-0.5 text-xs text-gray-500">전사 완료된 녹음을 오디오 샘플로 등록합니다.</p>
        </div>
        <button
          class="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
          onclick={load}
          disabled={isLoading}
        >새로고침</button>
      </div>

      <!-- 목록 -->
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {#if isLoading && !loadedOnce}
          <div class="flex items-center justify-center py-16 text-sm text-gray-400">불러오는 중...</div>
        {:else if candidates.length === 0}
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <p class="text-sm text-gray-500">가져올 수 있는 녹음이 없습니다.</p>
            <p class="mt-1 text-xs text-gray-400">전사가 완료된 필드노트 녹음만 표시됩니다.</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each candidates as c (c.field_note_id)}
              {@const badge = diarizeBadge(c.diarization_status)}
              <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-600">
                      {c.field_note_id.slice(0, 8)}
                    </span>
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium {badge.cls}">{badge.label}</span>
                    {#if c.chunk_count > 1}
                      <span class="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-500">
                        {c.chunk_count}청크
                      </span>
                    {/if}
                  </div>
                  <p class="mt-1 text-xs text-gray-400">
                    {fmtDuration(c.duration)} · {formatDateKST(c.created_at)}
                  </p>
                </div>
                {#if c.already_imported}
                  <span class="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400">등록됨</span>
                {:else}
                  <button
                    class="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    onclick={() => handleImport(c)}
                    disabled={importingId !== null}
                  >
                    {importingId === c.field_note_id ? '가져오는 중...' : '가져오기'}
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 푸터 -->
      <div class="flex shrink-0 justify-end border-t border-gray-100 px-6 py-4">
        <button
          class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          onclick={onClose}
        >닫기</button>
      </div>
    </div>
  </div>
{/if}
