<script lang="ts">
  import { flip } from 'svelte/animate'
  import type { createDefinitionEditor } from './definition-editor.svelte'

  interface Props {
    editor: ReturnType<typeof createDefinitionEditor>
  }

  let { editor }: Props = $props()

  const isSCT = $derived(editor.definitionType === 'sentence_completion')
</script>

{#snippet moveButtons(i: number)}
  <div class="flex shrink-0 flex-col gap-1">
    <button
      type="button"
      class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
      onclick={() => editor.moveQuestion(i, -1)}
      disabled={i === 0}
      title="위로"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
      </svg>
    </button>
    <button
      type="button"
      class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
      onclick={() => editor.moveQuestion(i, 1)}
      disabled={i === editor.questions.length - 1}
      title="아래로"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <button
      type="button"
      class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
      onclick={() => editor.removeQuestion(i)}
      title="삭제"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
{/snippet}

<div class="space-y-6">
  <!-- 공통 선택지 (choice만) -->
  {#if !isSCT}
    <div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">공통 선택지</span>
        <button
          type="button"
          class="text-xs text-primary-600 hover:text-primary-700 font-medium"
          onclick={editor.addOption}
        >
          + 추가
        </button>
      </div>

      {#if editor.commonOptions.length > 0}
        <div class="space-y-2">
          {#each editor.commonOptions as _, i}
            <div class="flex items-center gap-2">
              <input
                type="number"
                class="w-16 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                bind:value={editor.commonOptions[i].value}
                min={1}
              />
              <input
                type="text"
                class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                bind:value={editor.commonOptions[i].label}
                placeholder="선택지 라벨"
              />
              <button
                type="button"
                class="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onclick={() => editor.removeOption(i)}
                title="선택지 삭제"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-gray-400">선택지를 추가해주세요</p>
      {/if}
    </div>
  {/if}

  <!-- 문항 목록 -->
  <div>
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-medium text-gray-700">
        문항 목록 ({editor.questions.length}문항)
      </span>
      <button
        type="button"
        class="text-xs text-primary-600 hover:text-primary-700 font-medium"
        onclick={editor.addQuestion}
      >
        + 추가
      </button>
    </div>

    {#if editor.questions.length > 0}
      <div class="space-y-3">
        {#each editor.questions as q, i (q._id)}
          <div class="flex gap-2 rounded-lg border border-gray-200 p-3" animate:flip={{ duration: 250 }}>
            <span class="shrink-0 pt-2 text-sm font-medium text-gray-500 w-8 text-right">
              {i + 1}.
            </span>

            {#if isSCT}
              <!-- SCT: stem_before + stem_after -->
              <div class="flex-1 space-y-2">
                <input
                  type="text"
                  class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  bind:value={editor.questions[i].stem_before}
                  placeholder="문장 줄기 (앞)"
                />
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    class="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    bind:value={editor.questions[i].stem_after}
                    placeholder="줄기 (뒤) — 비워두면 일반형"
                  />
                </div>
                <!-- 미리보기 -->
                <p class="text-xs text-gray-400 pl-1">
                  {editor.questions[i].stem_before || '...'} <span class="text-primary-500">___</span>
                  {#if editor.questions[i].stem_after}
                    {editor.questions[i].stem_after}
                  {/if}
                </p>
              </div>
            {:else}
              <!-- choice: 기존 text 입력 -->
              <textarea
                class="flex-1 resize-none rounded-md border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500 focus:rounded-md"
                rows={2}
                bind:value={editor.questions[i].text}
                placeholder="문항 내용을 입력하세요"
              ></textarea>
            {/if}

            {@render moveButtons(i)}
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-sm text-gray-400">문항을 추가해주세요</p>
    {/if}
  </div>
</div>
