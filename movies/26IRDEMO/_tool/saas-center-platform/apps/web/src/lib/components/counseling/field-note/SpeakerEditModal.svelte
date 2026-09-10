<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import { SPEAKER_COLORS } from '$lib/features/field-note/constants'

  interface Props {
    modalId?: string
    /** 식별된 unique speaker id 목록 (세그먼트에서 추출된 순서) */
    speakers: string[]
    /** 현재 저장된 speaker_map (speaker_id → 표시이름) */
    initialMap: Record<string, string>
    /** 세션 참가자 후보 이름 (상담사 → 내담자 순) */
    participantCandidates?: string[]
    /** 저장 시 호출. 매핑 전체를 넘김. */
    onConfirm: (map: Record<string, string>) => void
    closeModal?: () => void
  }

  const {
    modalId = '',
    speakers,
    initialMap,
    participantCandidates = [],
    onConfirm,
    closeModal
  }: Props = $props()

  function initDraft(): Record<string, string> {
    return speakers.reduce(
      (acc, id, idx) => {
        const saved = initialMap[id]
        acc[id] =
          saved && saved.trim() ? saved : (participantCandidates[idx] ?? id)
        return acc
      },
      {} as Record<string, string>
    )
  }

  let draft = $state<Record<string, string>>(initDraft())

  function applyCandidates() {
    draft = speakers.reduce(
      (acc, id, idx) => {
        acc[id] = participantCandidates[idx] ?? draft[id] ?? id
        return acc
      },
      {} as Record<string, string>
    )
  }

  function handleSave() {
    onConfirm(draft)
    closeModal?.()
  }
</script>

<!-- 모달 규격 = Web_Design.md §Components>modal — 헤더/본문/푸터 패딩·타이틀·버튼 전부
     BaseModal이 소유한다(타이틀 20/600 · 본문 사방 20 · 푸터 좌우·하 20/상 16 · 버튼 44) -->
<BaseModal {modalId} {closeModal} title="화자 설정" bodyClass="p-5 pb-7">
  {#snippet body()}
    <!-- 그룹 간 구분 24 / 그룹 내부 12 (§Spacing 그룹핑 vs 구분) -->
    <div class="flex flex-col gap-6">
      {#if participantCandidates.length > 0}
        <!-- 참여자 자동 채우기 — 안내 + 실행을 한 줄에.
             중형 블록이라 radius 12 (안쪽 버튼 8보다 한 단계 크게 — 중첩 radius 규칙) -->
        <div
          class="flex items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-3"
        >
          <!-- 라벨(15/500 gray-700) + 값 — 값은 같은 크기에서 색만 strong으로 올려 구분 -->
          <div class="flex min-w-0 items-center gap-2">
            <Typography
              variant="body-02-normal-medium"
              color="text-gray-700"
              className="shrink-0"
            >
              참여자
            </Typography>
            <Typography
              variant="body-02-normal-medium"
              color="text-gray-900"
              className="truncate-safe"
            >
              {participantCandidates.join(', ')}
            </Typography>
          </div>
          <button
            type="button"
            onclick={applyCandidates}
            class="h-8 shrink-0 rounded-lg border border-primary-300 px-4 text-body-03-normal-medium text-primary-500 transition-colors hover:border-primary-400 hover:text-primary-600"
          >
            자동 채우기
          </button>
        </div>
      {/if}

      <div class="flex flex-col gap-3">
        <!-- 라벨 정본 — Body_02/Medium(15) gray-700, 라벨↔입력 8 (§5.5).
             제목이 아니라 라벨이다(§Title system — Title S는 없다) -->
        <div class="flex items-center gap-2">
          <Typography variant="body-02-normal-medium" color="text-gray-700">
            화자
          </Typography>
          <Typography variant="body-03-normal-regular" color="text-gray-500">
            {speakers.length}
          </Typography>
        </div>

        <div class="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          {#each speakers as speakerId, idx (speakerId)}
            {@const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length]}
            <div class="flex items-center gap-3">
              <div class="flex w-28 shrink-0 items-center gap-2">
                <span class="h-2 w-2 rounded-full {color.dot}"></span>
                <span
                  class="truncate-safe text-body-02-normal-regular text-gray-500"
                >
                  {speakerId}
                </span>
              </div>
              <input
                type="text"
                bind:value={draft[speakerId]}
                placeholder="표시할 이름"
                class="field-input flex-1"
              />
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={() => closeModal?.()}
      class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
    >
      취소
    </button>
    <button
      type="button"
      onclick={handleSave}
      class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
    >
      저장
    </button>
  {/snippet}
</BaseModal>
