<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import { modalStore } from '$lib/stores/modal'
  import Typography from '@common/components/Typography.svelte'
  import { linkTemplateError } from '../validation'
  import { snackbarStore } from '$lib/stores/snackbar'
  import {
    TEMPLATE_VARIABLES,
    getVariableLabelMap,
    ACTIVE_TEMPLATE_TYPE_OPTIONS
  } from '../constants'
  import {
    renderContentWithHighlight,
    contentToDisplay,
    displayToContent
  } from '../view-model'

  interface Props {
    modalId?: string
    mode: 'create' | 'edit'
    initialData?: {
      id?: string
      template_type: string
      name: string
      content: string
      is_default: boolean
    }
    onConfirm: (data: any) => Promise<void>
  }

  let { modalId, mode, initialData, onConfirm }: Props = $props()

  let templateType = $state(
    initialData?.template_type ?? 'assessment_result_send'
  )
  let name = $state(initialData?.name ?? '')
  let isDefault = $state(initialData?.is_default ?? false)
  let isSubmitting = $state(false)

  let variables = $derived(TEMPLATE_VARIABLES[templateType] ?? [])
  let labelMap = $derived(getVariableLabelMap(templateType))

  // 사용자에게는 한글 태그로 보여주고, 저장 시 영어 변수로 변환
  let displayContent = $state(
    initialData?.content
      ? contentToDisplay(
          initialData.content,
          getVariableLabelMap(
            initialData.template_type ?? 'assessment_result_send'
          )
        )
      : ''
  )
  let previewHtml = $derived(
    renderContentWithHighlight(
      displayToContent(displayContent, labelMap),
      labelMap
    )
  )

  let textareaEl: HTMLTextAreaElement
  const validationError = $derived(
    linkTemplateError(templateType, displayToContent(displayContent, labelMap))
  )

  function insertVariable(key: string, label: string) {
    const tag = `#{${label}}`
    if (textareaEl) {
      const start = textareaEl.selectionStart
      const end = textareaEl.selectionEnd
      displayContent =
        displayContent.slice(0, start) + tag + displayContent.slice(end)
      // 커서를 삽입된 태그 뒤로 이동
      requestAnimationFrame(() => {
        textareaEl.focus()
        const newPos = start + tag.length
        textareaEl.setSelectionRange(newPos, newPos)
      })
    } else {
      displayContent += tag
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !displayContent.trim() || validationError) return
    isSubmitting = true
    // 한글 태그 → 영어 변수로 변환하여 저장
    const rawContent = displayToContent(displayContent.trim(), labelMap)
    try {
      if (mode === 'create') {
        await onConfirm({
          template_type: templateType,
          name: name.trim(),
          content: rawContent,
          is_default: isDefault
        })
      } else {
        await onConfirm({
          name: name.trim(),
          content: rawContent
        })
      }
      modalStore.close(modalId)
    } catch {
      snackbarStore.error(
        '양식을 저장하지 못했습니다. 권한과 입력 내용을 확인해주세요.'
      )
    } finally {
      isSubmitting = false
    }
  }

  function handleClose() {
    modalStore.close(modalId)
  }
</script>

<BaseModal
  {modalId}
  closeModal={handleClose}
  showCloseButton
  size="wide"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet header()}
    <div>
      <Typography variant="title-02-semibold" color="text-gray-900">
        {mode === 'create' ? '새 문자 양식 만들기' : '문자 양식 수정'}
      </Typography>
      <Typography
        variant="body-03-medium"
        color="text-gray-500"
        className="mt-1"
      >
        {mode === 'create'
          ? '발송할 문자 메시지의 양식을 작성합니다. 자동 입력 버튼을 눌러 항목을 추가할 수 있습니다.'
          : '양식 내용을 수정합니다.'}
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="flex gap-8">
      <!-- 왼쪽: 작성 영역 -->
      <div class="flex-1 space-y-6">
        <div>
          <label
            for="message-template-type"
            class="mb-2 block text-sm font-medium text-gray-700"
            >양식 유형</label
          >
          <select
            id="message-template-type"
            bind:value={templateType}
            disabled={mode === 'edit'}
            class="field-input w-full"
          >
            {#each ACTIVE_TEMPLATE_TYPE_OPTIONS as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if validationError}<p
              role="alert"
              class="mt-2 text-sm text-amber-700"
            >
              {validationError}
            </p>{/if}
        </div>
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            양식 이름
          </Typography>
          <input
            type="text"
            bind:value={name}
            placeholder="예: 우리 센터 결과 안내 양식"
            class="field-input w-full"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <Typography variant="body-01-reading-regular" color="text-gray-600">
              메시지 내용
            </Typography>
          </div>

          <!-- 자동 입력 버튼 -->
          <div class="mb-2">
            <Typography
              variant="body-03-medium"
              color="text-gray-500"
              className="mb-1.5"
            >
              자동 입력 항목 — 버튼을 누르면 해당 위치에 추가됩니다.
            </Typography>
            <div class="flex flex-wrap gap-1.5">
              {#each variables as v}
                <button
                  type="button"
                  class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                  onclick={() => insertVariable(v.key, v.label)}
                >
                  + {v.label}
                </button>
              {/each}
            </div>
          </div>

          <textarea
            bind:this={textareaEl}
            bind:value={displayContent}
            rows={10}
            placeholder="여기에 메시지 내용을 작성하세요."
            class="w-full rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-800 outline-none leading-relaxed px-3 py-3.5"
          ></textarea>
        </div>

        {#if mode === 'create'}
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={isDefault}
              class="h-4 w-4 rounded border-gray-300 text-primary-500"
            />
            <Typography variant="body-01-reading-regular" color="text-gray-700">
              기본 양식으로 사용
            </Typography>
          </label>
        {/if}
      </div>

      <!-- 오른쪽: 미리보기 -->
      <div class="w-72 shrink-0">
        <Typography
          variant="body-01-reading-regular"
          color="text-gray-600"
          className="mb-1.5"
        >
          발송 미리보기
        </Typography>
        <Typography
          variant="body-03-medium"
          color="text-gray-500"
          className="mb-3"
        >
          실제 발송 시 이렇게 보입니다.
        </Typography>
        <div class="rounded-lg bg-gray-100 p-4">
          <div class="rounded-lg bg-white p-4 shadow-sm">
            <p class="mb-1 text-body-03-normal-medium text-gray-400">
              [Web발신]
            </p>
            <p
              class="whitespace-pre-wrap text-xs leading-relaxed text-gray-700"
            >
              {#if displayContent.trim()}
                {@html previewHtml}
              {:else}
                <span class="text-gray-400"
                  >내용을 입력하면 미리보기가 표시됩니다.</span
                >
              {/if}
            </p>
          </div>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
        onclick={handleClose}
      >
        취소
      </button>
      <button
        type="button"
        class="h-11 w-[120px] rounded-lg bg-blue-500 px-5 text-body-01-normal-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={isSubmitting ||
          !name.trim() ||
          !displayContent.trim() ||
          !!validationError}
        onclick={handleSubmit}
      >
        {isSubmitting
          ? '저장 중...'
          : mode === 'create'
            ? '양식 만들기'
            : '저장'}
      </button>
    </div>
  {/snippet}
</BaseModal>
