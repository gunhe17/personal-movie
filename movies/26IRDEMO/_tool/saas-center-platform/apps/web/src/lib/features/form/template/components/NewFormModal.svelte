<style>
  /* 생성 중 버튼 — 흐르는 그라데이션 pill (불확정 진행: LLM 소요시간 미지) */
  .ai-pill {
    background: linear-gradient(110deg, #4f46e5, #3b82f6, #6366f1, #4f46e5);
    background-size: 220% 100%;
    animation: ai-pill-shift 2.4s linear infinite;
  }
  @keyframes ai-pill-shift {
    0% {
      background-position: 0% 0;
    }
    100% {
      background-position: 220% 0;
    }
  }

  /* pill 내부 미니 스위프 바 */
  .ai-pill-sweep {
    animation: ai-pill-sweep 1.1s ease-in-out infinite;
  }
  @keyframes ai-pill-sweep {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(300%);
    }
  }
</style>

<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import AgentOn24 from '$lib/assets/sidebar/AgentOn24.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import FormGalleryCard from './FormGalleryCard.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import type { TemplateVM } from '../view-model'

  interface Props {
    /** 가져올 수 있는 공개(전역) 양식 목록 */
    templates: TemplateVM[]
    /** 생성 실행 — template=null이면 빈 양식, description 있으면 AI 초안 생성 */
    onCreate: (selection: {
      template: TemplateVM | null
      name: string
      description?: string | null
    }) => Promise<void> | void
    /** modalStore가 주입 */
    closeModal?: () => void
  }

  let { templates, onCreate, closeModal }: Props = $props()

  // 선택: 'blank' | template.id
  let selectedId = $state<string>('blank')
  let formName = $state('새 양식')
  let submitting = $state(false)

  // AI 초안 생성 (양식 설명) — 토글 활성 시에만 설명 입력 활성화
  let aiEnabled = $state(false)
  let description = $state('')

  const selectedTemplate = $derived(
    selectedId === 'blank'
      ? null
      : (templates.find((t) => t.id === selectedId) ?? null)
  )
  const isBlank = $derived(selectedId === 'blank')
  // AI 초안 생성이 켜져 있으면 양식 설명이 있어야 생성 가능
  const canCreate = $derived(
    !!formName.trim() &&
      !submitting &&
      (!(isBlank && aiEnabled) || !!description.trim())
  )

  function selectBlank() {
    selectedId = 'blank'
    formName = '새 양식'
  }

  function selectTemplate(t: TemplateVM) {
    selectedId = t.id
    formName = t.name
    aiEnabled = false // AI 초안 생성은 빈 양식 전용 → 공개 양식 선택 시 해제
  }

  // AI 토글 — 빈 양식에서만 사용 가능. Switch 가 먼저 toggle 한 뒤 onclick 을 호출하므로,
  // 빈 양식이 아니면 되돌리고 안내한다.
  function onAiToggle() {
    if (!isBlank) {
      aiEnabled = false
      snackbarStore.warning(
        'AI 초안 생성은 빈 양식에서만 사용할 수 있어요.',
        null
      )
    }
  }

  async function handleCreate() {
    if (!canCreate) return
    submitting = true
    try {
      await onCreate({
        template: selectedTemplate,
        name: formName.trim(),
        description:
          isBlank && aiEnabled && description.trim() ? description.trim() : null
      })
      closeModal?.()
    } finally {
      submitting = false
    }
  }
</script>

<BaseModal title="새 양식 만들기" size="wideXl" {closeModal}>
  {#snippet body()}
    <div class="p-5 pb-7">
      <p class="mb-4 text-body-02-normal-regular text-gray-500">
        빈 양식으로 시작하거나, 공개 양식을 선택해 센터 양식으로 복제하세요.
      </p>

      <!-- 한 줄: [빈 양식] | [공개 양식...] (가로 스크롤) -->
      <!-- -mx-3 px-3 py-4: hover/선택 그림자가 스크롤 컨테이너에 잘리지 않도록 여백 확보 -->
      <div class="-mx-3 flex items-start gap-5 overflow-x-auto px-3 py-4">
        <!-- 빈 양식 (새로 만들기) -->
        <div class="flex w-[150px] shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            onclick={selectBlank}
            aria-label="빈 양식"
            class="flex aspect-[210/297] w-full items-center justify-center rounded-lg transition-all {selectedId ===
            'blank'
              ? 'bg-gray-100 shadow-md ring-2 ring-primary-400'
              : 'bg-gray-50 hover:bg-gray-100 hover:shadow-md'}"
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              class="text-gray-400"
            >
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <path
                d="M14 3v5h5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <Typography
            variant="body-03-normal-regular"
            color={selectedId === 'blank'
              ? 'text-primary-600'
              : 'text-gray-600'}
            tag="span"
          >
            빈 양식
          </Typography>
        </div>

        <!-- 구분선 + 공개 양식 -->
        {#if templates.length > 0}
          <div class="h-[212px] w-px shrink-0 self-start bg-gray-200"></div>
          {#each templates as template (template.id)}
            <FormGalleryCard
              {template}
              selected={selectedId === template.id}
              onclick={() => selectTemplate(template)}
            />
          {/each}
        {/if}
      </div>

      <!-- 양식 이름 -->
      <div class="mt-6">
        <label for="new-form-name" class="field-label mb-2">
          양식 이름 <span class="field-required">*</span>
        </label>
        <input
          id="new-form-name"
          type="text"
          bind:value={formName}
          placeholder="양식 이름을 입력하세요"
          class="field-input w-full"
        />
      </div>

      <!-- 양식 설명 (AI 초안 생성 — 빈 양식 전용) -->
      <div class="mt-5">
        <div class="mb-1.5 flex items-center justify-between">
          <label for="new-form-desc" class="field-label mb-2">
            <AgentOn24 />
            양식 설명
          </label>

          <!-- 상태별 안내 라벨 + 스위치 (빈 양식에서만 사용 가능) -->
          <div class="flex items-center gap-2">
            <Typography
              variant="body-02-medium"
              color={aiEnabled ? 'text-primary-500' : 'text-gray-700'}
            >
              {aiEnabled ? 'AI로 초안을 생성해요' : '직접 작성할게요'}
            </Typography>
            <span class={!isBlank ? 'opacity-50' : ''}>
              <Switch
                bind:checked={aiEnabled}
                onclick={onAiToggle}
                ariaLabel="AI 초안 생성"
              />
            </span>
          </div>
        </div>

        <textarea
          id="new-form-desc"
          bind:value={description}
          disabled={!aiEnabled}
          rows="4"
          placeholder="만들고 싶은 양식을 설명해 주세요. 예: 방문 상담 신청서 — 신청자 정보, 상담 유형 선택, 동의·서명"
          class="text-body-02-reading-regular w-full resize-none rounded-lg border outline-none transition-colors {aiEnabled
            ? 'border-gray-200 bg-white focus:border-border-active'
            : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 placeholder:text-placeholder'} px-3 py-3.5"
        ></textarea>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- 취소는 항상 유지, 생성 버튼만 모핑 -->
    <button
      type="button"
      onclick={closeModal}
      disabled={submitting}
      class="flex-center h-11 rounded-lg border border-gray-200 px-6 transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      <Typography variant="body-01-normal-medium" color="text-gray-700"
        >취소</Typography
      >
    </button>

    {#if submitting}
      <!-- 생성 중: 생성 버튼 → 그라데이션 pill (에이전트 아이콘 + 스위프) -->
      <div class="ai-pill flex-center h-12 gap-2 rounded-lg px-6">
        <AgentOn24 />
        <Typography variant="body-01-medium" color="text-white">
          {aiEnabled ? 'AI가 만드는 중…' : '생성 중…'}
        </Typography>
        <span class="ml-1 h-1.5 w-10 overflow-hidden rounded-full bg-white/30">
          <span class="ai-pill-sweep block h-full w-2/5 rounded-full bg-white"
          ></span>
        </span>
      </div>
    {:else}
      <button
        type="button"
        onclick={handleCreate}
        disabled={!canCreate}
        class="flex-center h-11 rounded-lg px-6 transition-colors {canCreate
          ? 'bg-primary-500 hover:bg-primary-600'
          : 'bg-gray-200'}"
      >
        <Typography
          variant="body-01-normal-medium"
          color={canCreate ? 'text-white' : 'text-gray-400'}
        >
          생성
        </Typography>
      </button>
    {/if}
  {/snippet}
</BaseModal>
