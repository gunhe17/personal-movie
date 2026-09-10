<!--
  CredentialAttachmentField
  Credentials 모달 3종이 공유하는 증빙 파일 입력 UI.

  동작:
  - 기존 첨부가 있고 새 파일도 안 골랐고 제거 플래그도 false → 기존 파일 정보 + [제거]
  - 제거 플래그가 true → 빨간 경고 + [되돌리기]
  - 새 파일이 선택됨 → 신규 파일 정보 + [취소]
  - 그 외 (첨부 없음) → 파일 선택 영역
-->
<script lang="ts">
  import { snackbarStore } from '$lib/stores/snackbar'
  import {
    ATTACHMENT_ALLOWED_EXTENSIONS,
    ATTACHMENT_ALLOWED_TYPES,
    ATTACHMENT_MAX_SIZE
  } from '$lib/features/credentials'
  import type { CredentialAttachment } from '$lib/hooks/actions/credential.action'

  interface Props {
    /** 새로 선택된 파일 (양방향 바인딩) */
    file: File | null
    /** 기존 첨부 제거 예약 플래그 (양방향 바인딩) */
    removeExisting: boolean
    /** 기존 첨부 (수정 모달 진입 시 주입) */
    existingAttachment?: CredentialAttachment | null
    /** 안내 문구 (kind별로 살짝 다르게) */
    helperText?: string
  }

  let {
    file = $bindable(),
    removeExisting = $bindable(),
    existingAttachment = null,
    helperText = 'PDF, JPG, PNG · 10MB 이하. 검증 시 관리자가 확인해요.'
  }: Props = $props()

  const fileInputId = `attach-${Math.random().toString(36).slice(2, 8)}`

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const selected = input.files?.[0] ?? null
    if (!selected) return

    if (!ATTACHMENT_ALLOWED_TYPES.includes(selected.type)) {
      snackbarStore.error('PDF, JPG, PNG 파일만 업로드할 수 있어요.')
      input.value = ''
      return
    }
    if (selected.size > ATTACHMENT_MAX_SIZE) {
      snackbarStore.error('파일 크기는 10MB 이하여야 해요.')
      input.value = ''
      return
    }

    file = selected
    removeExisting = false
  }

  function clearSelected() {
    file = null
    const input = document.getElementById(
      fileInputId
    ) as HTMLInputElement | null
    if (input) input.value = ''
  }

  function markRemoval() {
    removeExisting = true
    clearSelected()
  }

  function undoRemoval() {
    removeExisting = false
  }

  const showExistingAttachment = $derived(
    !!existingAttachment && !removeExisting && !file
  )
  const showRemovalNotice = $derived(!!existingAttachment && removeExisting)
  const showSelectedFile = $derived(!!file)
  const showFilePicker = $derived(!showExistingAttachment && !showSelectedFile)
</script>

<div>
  <p class="mb-2 text-xs text-gray-500">{helperText}</p>

  {#if showExistingAttachment && existingAttachment}
    <div
      class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg
          class="h-4 w-4 text-gray-400 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-sm text-gray-700 truncate-safe"
          >{existingAttachment.filename}</span
        >
      </div>
      <button
        type="button"
        class="text-xs text-status-danger hover:underline shrink-0 ml-2"
        onclick={markRemoval}
      >
        제거
      </button>
    </div>
  {/if}

  {#if showRemovalNotice}
    <div
      class="rounded-lg border border-dashed border-red-200 bg-status-danger-bg px-3 py-2 text-xs text-red-600 flex items-center justify-between"
    >
      <span>저장 시 기존 첨부가 삭제돼요.</span>
      <button
        type="button"
        class="text-xs text-gray-600 hover:underline"
        onclick={undoRemoval}>되돌리기</button
      >
    </div>
  {/if}

  {#if showSelectedFile && file}
    <div
      class="{existingAttachment
        ? 'mt-2'
        : ''} flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg
          class="h-4 w-4 text-primary-500 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-sm text-primary-700 truncate-safe">{file.name}</span>
      </div>
      <button
        type="button"
        class="text-xs text-gray-600 hover:underline shrink-0 ml-2"
        onclick={clearSelected}
      >
        취소
      </button>
    </div>
  {/if}

  {#if showFilePicker}
    <label
      for={fileInputId}
      class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50"
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
          clip-rule="evenodd"
        />
      </svg>
      파일 선택
    </label>
    <input
      id={fileInputId}
      type="file"
      accept={ATTACHMENT_ALLOWED_EXTENSIONS.join(',')}
      class="hidden"
      onchange={handleFileChange}
    />
  {/if}
</div>
