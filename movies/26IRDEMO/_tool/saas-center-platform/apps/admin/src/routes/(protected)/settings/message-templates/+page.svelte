<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getSystemTemplates,
    getSystemTemplate,
    postSystemTemplate,
    putSystemTemplate,
    deleteSystemTemplate,
    type MessageTemplateResponse,
    type MessageTemplateSummary
  } from '$hooks/actions/messageTemplate.action'
  import { snackbarStore } from '$stores/snackbar'
  import Typography from '$components/Typography.svelte'
  import { TEMPLATE_TYPE_LABELS, TEMPLATE_TYPE_OPTIONS, ACTIVE_TEMPLATE_TYPES, getVariableLabelMap } from '$lib/features/message-template/constants'
  import { mapToTemplateVM, renderContentWithHighlight, type MessageTemplateVM } from '$lib/features/message-template/view-model'

  const queryClient = useQueryClient()

  const templatesQuery = $derived(queryBuilder(getSystemTemplates, () => ({})))
  let allItems = $derived(
    templatesQuery?.data?.items
      ?.map(mapToTemplateVM)
      .filter((item) => (ACTIVE_TEMPLATE_TYPES as readonly string[]).includes(item.templateType)) ?? []
  )

  // 타입별 그룹핑
  let groupedItems = $derived(() => {
    const groups: Record<string, MessageTemplateVM[]> = {}
    for (const item of allItems) {
      if (!groups[item.templateType]) groups[item.templateType] = []
      groups[item.templateType].push(item)
    }
    return groups
  })

  let expandedTypes = $state<Set<string>>(new Set())

  $effect(() => {
    const types = Object.keys(groupedItems())
    if (types.length > 0 && expandedTypes.size === 0) {
      expandedTypes = new Set(types)
    }
  })

  function toggleType(type: string) {
    const next = new Set(expandedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    expandedTypes = next
  }

  let selectedItem = $state<MessageTemplateVM | null>(null)
  let selectedDetail = $state<MessageTemplateResponse | null>(null)
  let loadingDetail = $state(false)

  async function selectTemplate(item: MessageTemplateVM) {
    selectedItem = item
    loadingDetail = true
    try {
      selectedDetail = await getSystemTemplate().request({ templateId: item.id })
    } catch {
      selectedDetail = null
    } finally {
      loadingDetail = false
    }
  }

  $effect(() => {
    if (allItems.length > 0 && !selectedItem) selectTemplate(allItems[0])
  })

  let contentHtml = $derived(
    selectedDetail
      ? renderContentWithHighlight(selectedDetail.content, getVariableLabelMap(selectedDetail.template_type))
      : ''
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['getSystemTemplates'], exact: false })

  // 생성/수정 폼
  let showForm = $state(false)
  let formMode = $state<'create' | 'edit'>('create')
  let formData = $state({ id: '', template_type: 'assessment_result_send', name: '', content: '', is_default: false })

  function openCreate() {
    formMode = 'create'
    formData = { id: '', template_type: 'assessment_result_send', name: '', content: '', is_default: false }
    showForm = true
  }

  function openEdit() {
    if (!selectedDetail) return
    formMode = 'edit'
    formData = {
      id: selectedDetail.id,
      template_type: selectedDetail.template_type,
      name: selectedDetail.name,
      content: selectedDetail.content,
      is_default: selectedDetail.is_default
    }
    showForm = true
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.content.trim()) return
    try {
      if (formMode === 'create') {
        await postSystemTemplate().request({
          template_type: formData.template_type,
          name: formData.name,
          content: formData.content,
          is_default: formData.is_default
        })
        snackbarStore.success('시스템 양식이 생성되었습니다.')
      } else {
        await putSystemTemplate().request({
          templateId: formData.id,
          name: formData.name,
          content: formData.content
        })
        snackbarStore.success('시스템 양식이 수정되었습니다.')
      }
      showForm = false
      invalidate()
      // 수정 후 다시 선택
      if (selectedItem) {
        setTimeout(() => selectTemplate(selectedItem!), 300)
      }
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
    }
  }

  async function handleDelete() {
    if (!selectedItem) return
    if (!confirm('이 양식을 삭제하시겠습니까?')) return
    try {
      await deleteSystemTemplate().request({ templateId: selectedItem.id })
      snackbarStore.success('삭제되었습니다.')
      selectedItem = null
      selectedDetail = null
      invalidate()
    } catch {
      snackbarStore.error('삭제에 실패했습니다.')
    }
  }
</script>

<div class="flex h-full flex-col">
  <!-- 헤더 -->
  <div class="flex items-center justify-between px-6 py-5 border-b border-gray-200">
    <div>
      <Typography variant="title-02-semibold">시스템 기본 문자 양식</Typography>
      <p class="mt-1 text-sm text-gray-500">센터에 커스텀 양식이 없을 때 사용되는 시스템 기본 양식입니다.</p>
    </div>
    <button
      class="h-10 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
      onclick={openCreate}
    >
      새 양식 만들기
    </button>
  </div>

  <!-- 본문 -->
  <div class="flex flex-1 min-h-0 overflow-hidden">
    <!-- 좌측 리스트 -->
    <div class="w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
      {#each Object.entries(groupedItems()) as [type, items]}
        <button
          class="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-gray-100"
          onclick={() => toggleType(type)}
        >
          <span class="text-xs font-semibold text-gray-500">{TEMPLATE_TYPE_LABELS[type] ?? type}</span>
          <svg class="h-4 w-4 text-gray-400 transition-transform {expandedTypes.has(type) ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if expandedTypes.has(type)}
          {#each items as item}
            <button
              class="flex w-full items-center gap-2 px-5 py-3 pl-6 text-left transition-colors
                {selectedItem?.id === item.id
                  ? 'bg-primary-50 border-l-[3px] border-primary-500'
                  : 'hover:bg-gray-100 border-l-[3px] border-transparent'}"
              onclick={() => selectTemplate(item)}
            >
              <div class="flex-1 min-w-0">
                <span class="truncate text-sm {selectedItem?.id === item.id ? 'text-primary-600 font-medium' : 'text-gray-800'}">
                  {item.name}
                </span>
                {#if item.isDefault}
                  <div class="mt-0.5">
                    <span class="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">기본</span>
                  </div>
                {/if}
              </div>
            </button>
          {/each}
        {/if}
        <hr class="border-gray-100 mx-4" />
      {:else}
        <div class="flex items-center justify-center py-16 text-sm text-gray-400">
          등록된 양식이 없습니다.
        </div>
      {/each}
    </div>

    <!-- 우측 상세 -->
    <div class="flex-1 overflow-y-auto">
      {#if selectedDetail && selectedItem}
        <div class="p-6">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">{selectedDetail.name}</h2>
              <div class="mt-2 flex items-center gap-2">
                <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {TEMPLATE_TYPE_LABELS[selectedDetail.template_type] ?? selectedDetail.template_type}
                </span>
                {#if selectedItem.isDefault}
                  <span class="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">기본 양식</span>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-600 hover:bg-gray-50"
                onclick={openEdit}
              >수정</button>
              <button
                class="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm text-red-500 hover:bg-red-50"
                onclick={handleDelete}
              >삭제</button>
            </div>
          </div>

          <hr class="border-gray-100 mb-6" />

          <!-- 발송 미리보기 -->
          <div class="mb-8">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">발송 미리보기</h3>
            <p class="mb-4 text-xs text-gray-500">실제 발송 시 아래와 같은 형태로 전송됩니다. 파란색 항목은 자동으로 채워집니다.</p>
            <div class="mx-auto max-w-sm">
              <div class="rounded-2xl bg-gray-100 p-5">
                <div class="rounded-xl bg-white p-4 shadow-sm">
                  <p class="mb-1 text-[11px] font-semibold text-gray-400">[Web발신]</p>
                  <p class="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{@html contentHtml}</p>
                </div>
              </div>
            </div>
          </div>

          <hr class="border-gray-100 mb-6" />

          <!-- 양식 원문 -->
          <div class="mb-6">
            <h3 class="mb-2 text-sm font-semibold text-gray-900">양식 원문</h3>
            <p class="mb-4 text-xs text-gray-500">파란색으로 표시된 항목은 발송 시 실제 정보로 자동 변환됩니다.</p>
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{@html contentHtml}</p>
            </div>
          </div>

          <!-- 자동 입력 항목 -->
          {#if selectedDetail.variables.length > 0}
            <div>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">자동 입력 항목</h3>
              <p class="mb-4 text-xs text-gray-500">발송 시 자동으로 채워지는 정보입니다.</p>
              <div class="grid grid-cols-2 gap-3">
                {#each selectedDetail.variables as v}
                  <div class="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3">
                    <span class="rounded-md bg-blue-50 px-2 py-1 text-xs font-mono text-blue-600">{v.key}</span>
                    <span class="text-sm text-gray-700">{v.label}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else if loadingDetail}
        <div class="flex items-center justify-center py-20 text-sm text-gray-400">불러오는 중...</div>
      {:else}
        <div class="flex items-center justify-center py-20 text-sm text-gray-400">왼쪽에서 양식을 선택해 주세요.</div>
      {/if}
    </div>
  </div>
</div>

<!-- 생성/수정 폼 모달 -->
{#if showForm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="w-[720px] max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-xl">
      <div class="px-8 pt-8 pb-4 border-b border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900">
          {formMode === 'create' ? '새 시스템 양식 만들기' : '시스템 양식 수정'}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {formMode === 'create'
            ? '센터에 커스텀 양식이 없을 때 사용되는 기본 양식을 만듭니다.'
            : '양식 내용을 수정합니다.'}
        </p>
      </div>

      <div class="px-8 py-6 space-y-5">
        {#if formMode === 'create'}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">발송 유형</label>
            <select
              bind:value={formData.template_type}
              class="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-primary-500"
            >
              {#each TEMPLATE_TYPE_OPTIONS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">양식 이름</label>
          <input
            type="text"
            bind:value={formData.name}
            placeholder="예: 검사 결과 전송 (기본)"
            class="w-full h-11 rounded-lg border border-gray-200 px-4 text-sm outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">메시지 내용</label>
          <textarea
            bind:value={formData.content}
            rows={10}
            placeholder="여기에 메시지 내용을 작성하세요."
            class="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary-500 leading-relaxed"
          ></textarea>
        </div>

        {#if formMode === 'create'}
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" bind:checked={formData.is_default} class="h-4 w-4 rounded border-gray-300" />
            <span class="text-sm text-gray-700">기본 양식으로 사용</span>
          </label>
        {/if}
      </div>

      <div class="flex justify-end gap-3 px-8 py-5 border-t border-gray-100">
        <button
          class="h-10 rounded-lg border border-gray-200 bg-white px-5 text-sm text-gray-600 hover:bg-gray-50"
          onclick={() => (showForm = false)}
        >취소</button>
        <button
          class="h-10 rounded-lg bg-primary-500 px-5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          disabled={!formData.name.trim() || !formData.content.trim()}
          onclick={handleSubmit}
        >{formMode === 'create' ? '양식 만들기' : '저장하기'}</button>
      </div>
    </div>
  </div>
{/if}
