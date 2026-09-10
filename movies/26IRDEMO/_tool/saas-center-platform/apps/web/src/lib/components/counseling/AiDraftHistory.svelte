<script lang="ts">
  // AI 상담일지 초안 이력 — 모달 본문(AiDraftHistoryModal)이 소유한다.
  // 초안은 크레딧이 차감된 산출물이라 생성할 때마다 보관된다(덮어쓰지 않음).
  // 본문 반영은 상담사가 "넣기"로 명시적으로만 한다.
  // 초안은 필드노트 산출물(field_note_id NOT NULL)이라 녹음 없이는 존재하지 않는다.
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCounselingNoteAiDrafts,
    type CounselingNoteAiDraft
  } from '$lib/hooks/actions/counseling-note-ai-draft.action'
  import { formatUtcToKst } from '$lib/utils/date'
  import { slide } from 'svelte/transition'

  interface Props {
    sessionId: string
    /** 본문 필드에 초안 텍스트를 이어붙인다 */
    onInsert?: (field: 'goal' | 'progress' | 'nextPlan', text: string) => void
  }

  let { sessionId, onInsert }: Props = $props()

  const draftsQuery = queryBuilder(
    getCounselingNoteAiDrafts,
    () => ({ centerId: $centerId, sessionId }),
    () => ({ enabled: !!$centerId && !!sessionId, throwOnError: false })
  )
  const drafts = $derived((draftsQuery.data as CounselingNoteAiDraft[]) ?? [])

  // 서식마다 키가 달라 화이트리스트로 막지 않고, 아는 키만 한글 라벨을 붙인다.
  const FIELD_LABELS: Record<string, string> = {
    mood: '정서 상태',
    main_topic: '주요 주제',
    intervention: '개입 기법',
    progress: '진전 사항',
    homework: '과제',
    next_goal: '다음 회기 목표',
    raw_notes: '기타 메모',
    subjective: 'S · 주관적 정보',
    objective: 'O · 객관적 정보',
    assessment: 'A · 평가',
    plan: 'P · 계획'
  }

  // 본문 3개 필드에만 "넣기"를 붙인다 (나머지는 화면에 대응 입력란이 없음)
  const INSERT_TARGET: Record<string, 'goal' | 'progress' | 'nextPlan'> = {
    main_topic: 'goal',
    progress: 'progress',
    next_goal: 'nextPlan'
  }

  function toText(value: unknown): string {
    if (value == null) return ''
    if (Array.isArray(value)) return value.filter(Boolean).join(', ')
    return String(value)
  }

  function entriesOf(draft: CounselingNoteAiDraft) {
    return Object.entries(draft.content)
      .map(([key, value]) => ({
        key,
        label: FIELD_LABELS[key] ?? key,
        text: toText(value)
      }))
      .filter((e) => e.text.trim())
  }

  let expandedId = $state('')
  function toggle(id: string) {
    expandedId = expandedId === id ? '' : id
  }
</script>

{#if drafts.length > 0}
  <div>
    <p class="mb-3 text-body-03-normal-regular text-gray-500">
      이 회기 녹음에서 만든 초안이에요. 본문은 덮어쓰지 않고 이어붙여요.
    </p>

    <div class="space-y-2">
      {#each drafts as draft (draft.id)}
        {@const isOpen = expandedId === draft.id}
        <div class="rounded-lg border border-gray-200 bg-gray-50/60">
          <button
            type="button"
            onclick={() => toggle(draft.id)}
            class="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <span class="text-[14px] text-gray-700">
              {formatUtcToKst(draft.created_at as any, 'YYYY-MM-DD HH:mm')}
            </span>
            <span
              class="rounded-full bg-white px-2 py-0.5 text-[12px] text-gray-500 ring-1 ring-inset ring-gray-200"
            >
              {draft.template_type}
            </span>
            <span
              class="ml-auto shrink-0 text-gray-400 transition-transform duration-200 {isOpen
                ? 'rotate-180'
                : ''}"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 8L10 13L15 8"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </button>

          {#if isOpen}
            <div
              class="space-y-3 border-t border-gray-200 px-4 py-3"
              transition:slide={{ duration: 200 }}
            >
              {#each entriesOf(draft) as entry (entry.key)}
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-[13px] font-medium text-gray-500">
                      {entry.label}
                    </span>
                    {#if INSERT_TARGET[entry.key] && onInsert}
                      <button
                        type="button"
                        onclick={() =>
                          onInsert?.(INSERT_TARGET[entry.key], entry.text)}
                        class="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[12px] text-primary-500 transition-colors hover:bg-primary-50"
                      >
                        본문에 넣기
                      </button>
                    {/if}
                  </div>
                  <p class="mt-1 whitespace-pre-wrap text-[14px] text-gray-700">
                    {entry.text}
                  </p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
