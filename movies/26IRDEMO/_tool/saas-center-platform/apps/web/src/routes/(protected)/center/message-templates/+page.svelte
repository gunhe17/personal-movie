<script lang="ts">
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getMessageTemplates,
    getMessageTemplate,
    getDefaultTemplate,
    type MessageTemplateResponse
  } from '$lib/hooks/actions/messageTemplate.action'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { buildTemplateListInput } from '$lib/features/center/message-template/query-builders'
  import {
    mapToTemplateVM,
    renderContentWithHighlight,
    contentToDisplay,
    displayToContent,
    type MessageTemplateVM
  } from '$lib/features/center/message-template/view-model'
  import { createMessageTemplateService } from '$lib/features/center/message-template/message-template-service'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import {
    getVariableLabelMap,
    ACTIVE_TEMPLATE_TYPES,
    TEMPLATE_VARIABLES
  } from '$lib/features/center/message-template/constants'
  import Typography from '@common/components/Typography.svelte'
  import { patchMessageTemplate } from '$lib/hooks/actions/messageTemplate.action'
  import { snackbarStore } from '$lib/stores/snackbar'
  import LinkDefaultTemplate from '$lib/features/center/message-template/components/LinkDefaultTemplate.svelte'
  import { linkTemplateError } from '$lib/features/center/message-template/validation'

  const linkDefault = $derived(
    browser && $centerId
      ? queryBuilder(getDefaultTemplate, () => ({
          centerId: $centerId!,
          template_type: 'assessment_send_link'
        }))
      : null
  )

  const queryClient = useQueryClient()

  function refreshSelectedDetail() {
    if (selectedItem) {
      selectTemplate(selectedItem)
    }
  }

  const service = createMessageTemplateService({
    queryClient,
    onMutationSuccess: refreshSelectedDetail
  })

  const templates = $derived(
    browser && $centerId
      ? queryBuilder(getMessageTemplates, () =>
          buildTemplateListInput($centerId!)
        )
      : null
  )

  let allItems = $derived(
    templates?.data?.items
      ?.map(mapToTemplateVM)
      .filter((item) =>
        (ACTIVE_TEMPLATE_TYPES as readonly string[]).includes(item.templateType)
      ) ?? []
  )

  // 선택된 양식
  let selectedItem = $state<MessageTemplateVM | null>(null)
  let selectedDetail = $state<MessageTemplateResponse | null>(null)
  let loadingDetail = $state(false)

  async function selectTemplate(item: MessageTemplateVM) {
    selectedItem = item
    loadingDetail = true
    showMenu = false
    try {
      const detail = await getMessageTemplate().request({
        centerId: requireCenterId(),
        templateId: item.id
      })
      selectedDetail = detail
      selectedItem = mapToTemplateVM(detail)
      // 편집용 콘텐츠 초기화
      const labelMap = getVariableLabelMap(detail.template_type)
      editContent = contentToDisplay(detail.content, labelMap)
      isSaving = false
    } catch {
      selectedDetail = null
    } finally {
      loadingDetail = false
    }
  }

  $effect(() => {
    if (allItems.length > 0 && !selectedItem) {
      selectTemplate(allItems[0])
    }
  })

  // ========== 인라인 편집 ==========
  let editContent = $state('')
  let isSaving = $state(false)
  let textareaEl: HTMLTextAreaElement

  let currentLabelMap = $derived(
    selectedDetail ? getVariableLabelMap(selectedDetail.template_type) : {}
  )

  let currentVariables = $derived(
    selectedDetail
      ? (TEMPLATE_VARIABLES[selectedDetail.template_type] ?? [])
      : []
  )

  let previewHtml = $derived(
    selectedDetail
      ? renderContentWithHighlight(
          displayToContent(editContent, currentLabelMap),
          currentLabelMap
        )
      : ''
  )

  // 원본과 비교해서 변경 여부 확인
  let hasChanges = $derived(
    selectedDetail
      ? displayToContent(editContent, currentLabelMap) !==
          selectedDetail.content
      : false
  )

  function insertVariable(key: string, label: string) {
    const tag = `#{${label}}`
    if (textareaEl) {
      const start = textareaEl.selectionStart
      const end = textareaEl.selectionEnd
      editContent = editContent.slice(0, start) + tag + editContent.slice(end)
      requestAnimationFrame(() => {
        textareaEl.focus()
        const newPos = start + tag.length
        textareaEl.setSelectionRange(newPos, newPos)
      })
    } else {
      editContent += tag
    }
  }

  async function saveContent() {
    if (!selectedDetail || !hasChanges) return
    isSaving = true
    try {
      const rawContent = displayToContent(editContent, currentLabelMap)
      const validationError = linkTemplateError(
        selectedDetail.template_type,
        rawContent
      )
      if (validationError) {
        snackbarStore.error(validationError)
        return
      }
      await patchMessageTemplate().request({
        centerId: requireCenterId(),
        templateId: selectedDetail.id,
        content: rawContent
      })
      snackbarStore.success('양식이 저장되었습니다.')
      service.invalidateList()
      refreshSelectedDetail()
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
    } finally {
      isSaving = false
    }
  }

  // ========== 더보기 메뉴 ==========
  let showMenu = $state(false)
</script>

<div class="flex h-full flex-col">
  <!-- 타이틀은 /center/+layout.svelte가 소유 -->
  <!-- 본문 -->
  <div class="flex min-h-0 flex-1 pb-6">
    <div
      class="flex min-h-0 w-full flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      <!-- 좌측: 사이드바 — 폭 280(§Layout Patterns > 목록 레일 · 권한 설정·바우처와 동일).
           선택 표시는 레일을 가로로 꽉 채우지 않고 좌우 인셋 20 + radius 8 안에서 칠한다 -->
      <div
        class="shrink-0 border-b border-gray-200 md:border-b-0 md:border-r md:w-70 md:overflow-y-auto"
      >
        <!-- 새 양식 만들기 버튼 -->
        <div class="p-3 md:p-5">
          <PageActionButton
            label="템플릿 추가"
            onclick={() => service.openCreateModal()}
            class="w-full justify-center"
          />
        </div>

        <!-- 양식 목록: 모바일 가로 스크롤, md+ 세로 (항목 사이 8) -->
        <div
          class="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:gap-2 md:px-5 md:pb-5 md:overflow-x-visible"
        >
          {#each allItems as item}
            {@const active = selectedItem?.id === item.id}
            <button
              class="flex shrink-0 items-center gap-2 rounded-lg p-3 text-left transition-colors
              md:w-full md:justify-between
              {active
                ? 'bg-primary-50'
                : 'bg-gray-50 md:bg-transparent hover:bg-gray-50'}"
              onclick={() => selectTemplate(item)}
            >
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="text-body-01-normal-semibold truncate-safe whitespace-nowrap {active
                    ? 'text-primary-600'
                    : 'text-gray-800'}"
                >
                  {item.name}
                </span>
                {#if item.isDefault && !item.isSystem}
                  <BadgeRectangle label="대표" color="blue" size="sm" />
                {/if}
              </div>
              <svg
                class="hidden h-5 w-5 shrink-0 text-gray-300 md:block"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          {:else}
            <div
              class="flex flex-col items-center justify-center py-8 px-4 md:py-16"
            >
              <Typography variant="body-02-medium" color="text-gray-400">
                {templates?.isError
                  ? '양식 목록을 불러오지 못했습니다.'
                  : templates?.isPending
                    ? '양식을 불러오는 중입니다.'
                    : '등록된 양식이 없습니다.'}
              </Typography>
              {#if templates?.isError}
                <button
                  class="mt-2 text-sm text-primary-500 underline"
                  onclick={() => templates?.refetch()}
                  >목록 다시 불러오기</button
                >
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- 우측: 상세 -->
      <div class="flex-1 overflow-y-auto">
        <LinkDefaultTemplate
          data={linkDefault?.data}
          loading={linkDefault?.isPending ?? true}
          error={linkDefault?.isError ?? false}
          onRetry={() => {
            void linkDefault?.refetch()
          }}
          onSelect={() => {
            const template = linkDefault?.data?.template
            if (template) void selectTemplate(mapToTemplateVM(template))
          }}
          onCustomize={(content) =>
            service.openCreateModal({
              template_type: 'assessment_send_link',
              name: '바로링크 전송 (센터 기본)',
              content,
              is_default: true
            })}
        />
        {#if selectedDetail && selectedItem}
          <div>
            <!-- 타이틀 영역 (하단 라인으로 내용 영역과 구분) -->
            <div
              class="flex items-center justify-between border-b border-gray-100 px-6 py-4"
            >
              <div class="flex min-h-8 items-center gap-3">
                <Typography variant="title-01-semibold" color="text-gray-900">
                  {selectedDetail.name.replace(/\s*\(기본\)\s*$/, '')}
                </Typography>
                {#if selectedItem.isDefault && !selectedItem.isSystem}
                  <span
                    class="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600"
                    >대표</span
                  >
                {/if}
                {#if selectedDetail.name.includes('(기본)')}
                  <span
                    class="shrink-0 rounded bg-tag-gray-bg px-2 py-1.5 text-label-01-normal-medium text-tag-gray-fg"
                    >기본</span
                  >
                {/if}
              </div>

              {#if !selectedItem.isSystem}
                <div class="relative">
                  <Tooltip text="더보기">
                    <button
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                      onclick={() => (showMenu = !showMenu)}
                      aria-label="더보기"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <circle cx="10" cy="4" r="1.5" />
                        <circle cx="10" cy="10" r="1.5" />
                        <circle cx="10" cy="16" r="1.5" />
                      </svg>
                    </button>
                  </Tooltip>

                  {#if showMenu}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="fixed inset-0 z-10"
                      onclick={() => (showMenu = false)}
                      onkeydown={() => {}}
                    ></div>
                    <div
                      class="dropdown-panel absolute top-full right-0 z-20 mt-1"
                    >
                      {#if !selectedItem.isDefault}
                        <button
                          class="dropdown-item"
                          onclick={() => {
                            showMenu = false
                            service.handleSetDefault(selectedItem!.id)
                          }}
                        >
                          대표로 설정
                        </button>
                      {/if}
                      <button
                        class="dropdown-item"
                        onclick={() => {
                          showMenu = false
                          if (!selectedDetail) return
                          service.openEditModal({
                            id: selectedDetail.id,
                            template_type: selectedDetail.template_type,
                            name: selectedDetail.name,
                            content: selectedDetail.content,
                            is_default: selectedItem!.isDefault
                          })
                        }}
                      >
                        이름 변경
                      </button>
                      <button
                        class="dropdown-item is-danger"
                        onclick={() => {
                          showMenu = false
                          service.handleDelete(selectedItem!.id)
                          selectedItem = null
                          selectedDetail = null
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- 내용 영역 -->
            <div class="p-6 flex flex-col lg:flex-row gap-6">
              <!-- 내용 편집 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700">내용</span>
                  {#if !selectedItem.isSystem}
                    <div class="flex flex-wrap gap-1">
                      {#each currentVariables as v}
                        <button
                          type="button"
                          class="rounded border border-gray-200 bg-white px-2 py-0.5 text-label-02-normal-medium text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition"
                          onclick={() => insertVariable(v.key, v.label)}
                        >
                          + {v.label}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                {#if selectedItem.isSystem}
                  <!-- 시스템 양식은 읽기 전용 -->
                  <div
                    class="rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[320px]"
                  >
                    <p
                      class="whitespace-pre-wrap text-base leading-relaxed text-gray-700"
                    >
                      {@html previewHtml}
                    </p>
                  </div>
                {:else}
                  <textarea
                    bind:this={textareaEl}
                    bind:value={editContent}
                    rows={14}
                    class="w-full rounded-lg border border-gray-200 bg-white text-body-01-reading-regular text-gray-800 leading-relaxed outline-none resize-none px-3 py-3.5"
                  ></textarea>
                  <div class="flex items-center justify-between mt-2">
                    <span class="text-xs text-gray-400"
                      >{editContent.length}/2000</span
                    >
                    {#if hasChanges}
                      <button
                        class="h-8 w-16 rounded-lg bg-primary-500 text-xs font-medium text-white hover:bg-primary-600 transition disabled:opacity-50"
                        disabled={isSaving}
                        onclick={saveContent}
                      >
                        저장
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- 미리보기 -->
              <div class="w-full lg:w-96 lg:shrink-0">
                <span class="text-sm font-medium text-gray-700 mb-2 block"
                  >미리보기</span
                >
                <div class="rounded-xl bg-gray-100 p-4">
                  <div class="rounded-lg bg-white p-4 shadow-sm">
                    <p class="mb-1 text-base text-gray-700">[Web발신]</p>
                    <p
                      class="whitespace-pre-wrap text-base leading-relaxed text-gray-700"
                    >
                      {@html previewHtml}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {:else if loadingDetail}
          <div class="flex items-center justify-center py-20">
            <Typography variant="body-01-reading-regular" color="text-gray-400">
              불러오는 중...
            </Typography>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-20">
            <Typography variant="body-01-reading-regular" color="text-gray-400">
              왼쪽에서 양식을 선택해 주세요.
            </Typography>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
