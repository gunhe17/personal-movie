<script lang="ts">
  import type { EditableField } from './types'

  // 값 요소 미리보기 — 레이블 없이 입력 표현만 (레이블은 별도 요소)
  let { field }: { field: EditableField } = $props()

  const INPUT_LIKE = new Set(['text', 'email', 'phone', 'number'])
  const DATE_LIKE = new Set(['date', 'time', 'datetime'])

  const placeholderText = $derived(
    field.type === 'number' ? '0' : '내용을 입력하세요'
  )
</script>

<div class="h-full">
  {#if INPUT_LIKE.has(field.type)}
    <div
      class="flex h-full items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-400"
    >
      {placeholderText}
    </div>
  {:else if field.type === 'textarea'}
    <div
      class="flex h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-body-02-normal-regular text-gray-400"
    >
      {placeholderText}
    </div>
  {:else if DATE_LIKE.has(field.type)}
    <div
      class="flex h-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-400"
    >
      <span>{field.type === 'time' ? '00:00' : 'YYYY-MM-DD'}</span>
      <svg
        class="h-4 w-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  {:else if field.type === 'select'}
    <div
      class="flex h-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-400"
    >
      <span>{field.options[0]?.label || '선택하세요'}</span>
      <svg
        class="h-4 w-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  {:else if field.type === 'radio' || field.type === 'checkbox_group'}
    <div
      class="flex h-full flex-col justify-center gap-1.5 overflow-hidden px-1"
    >
      {#if field.options.length === 0}
        <span class="text-body-03-normal-regular text-gray-300"
          >선택지를 추가하세요</span
        >
      {/if}
      {#each field.options as opt, i (i)}
        <span
          class="flex items-center gap-2 text-body-02-normal-regular text-gray-500"
        >
          <span
            class="h-4 w-4 shrink-0 border border-gray-300 {field.type ===
            'radio'
              ? 'rounded-full'
              : 'rounded'}"
          ></span>
          {opt.label || `선택지 ${i + 1}`}{#if opt.allowText}<span
              class="text-gray-400">( )</span
            >{/if}
        </span>
      {/each}
    </div>
  {:else if field.type === 'signature'}
    <div
      class="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-body-03-normal-regular text-gray-400"
    >
      서명
    </div>
  {:else if field.type === 'file' || field.type === 'image'}
    <div
      class="flex h-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-body-03-normal-regular text-gray-400"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      {field.type === 'image' ? '이미지 업로드' : '파일 업로드'}
    </div>
  {:else if field.type === 'heading'}
    <!-- 장식: 입력이 아니라 양식에 고정으로 박히는 제목 문구 (입력박스와 다른 스타일) -->
    <div class="flex h-full items-center">
      <span class="truncate-safe text-body-01-normal-semibold text-gray-800"
        >{field.label || '제목'}</span
      >
    </div>
  {:else if field.type === 'divider'}
    <!-- 장식: 구분선 -->
    <div class="flex h-full items-center">
      <span class="h-px w-full bg-gray-300"></span>
    </div>
  {:else}
    <div
      class="flex h-full items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-body-02-normal-regular text-gray-400"
    >
      {placeholderText}
    </div>
  {/if}
</div>
