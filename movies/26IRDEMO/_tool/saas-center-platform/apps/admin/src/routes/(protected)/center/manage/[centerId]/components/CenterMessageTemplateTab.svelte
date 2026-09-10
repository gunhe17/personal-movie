<script lang="ts">
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getCenterTemplates,
    getCenterTemplate,
    type MessageTemplateResponse
  } from '$hooks/actions/messageTemplate.action'
  import Typography from '$components/Typography.svelte'
  import { TEMPLATE_TYPE_LABELS, ACTIVE_TEMPLATE_TYPES, getVariableLabelMap } from '$lib/features/message-template/constants'
  import { mapToTemplateVM, renderContentWithHighlight, type MessageTemplateVM } from '$lib/features/message-template/view-model'

  interface Props {
    centerId: string
  }

  let { centerId }: Props = $props()

  const templatesQuery = $derived(
    queryBuilder(getCenterTemplates, () => ({ centerId }))
  )

  let allItems = $derived(
    templatesQuery?.data?.items
      ?.map(mapToTemplateVM)
      .filter((item) => (ACTIVE_TEMPLATE_TYPES as readonly string[]).includes(item.templateType)) ?? []
  )

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
      selectedDetail = await getCenterTemplate().request({
        centerId,
        templateId: item.id
      })
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
</script>

<div class="flex gap-4" style="min-height: 400px;">
  <!-- 좌측 리스트 -->
  <div class="w-64 shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white">
    <div class="px-4 pt-4 pb-2">
      <Typography variant="body-02-medium" color="text-gray-500">양식 목록</Typography>
    </div>

    {#each Object.entries(groupedItems()) as [type, items]}
      <button
        class="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
        onclick={() => toggleType(type)}
      >
        <span class="text-xs font-medium text-gray-500">{TEMPLATE_TYPE_LABELS[type] ?? type}</span>
        <svg class="h-3.5 w-3.5 text-gray-400 transition-transform {expandedTypes.has(type) ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if expandedTypes.has(type)}
        {#each items as item}
          <button
            class="flex w-full items-center px-4 py-2.5 pl-5 text-left transition-colors
              {selectedItem?.id === item.id
                ? 'bg-primary-50 border-l-[3px] border-primary-500'
                : 'hover:bg-gray-50 border-l-[3px] border-transparent'}"
            onclick={() => selectTemplate(item)}
          >
            <div class="flex-1 min-w-0">
              <span class="truncate text-sm {selectedItem?.id === item.id ? 'text-primary-600 font-medium' : 'text-gray-700'}">
                {item.name}
              </span>
              {#if item.isDefault}
                <span class="ml-1.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600">기본</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
      <hr class="border-gray-50 mx-3" />
    {:else}
      <div class="flex items-center justify-center py-12 text-sm text-gray-400">
        등록된 양식이 없습니다.
      </div>
    {/each}
  </div>

  <!-- 우측 상세 -->
  <div class="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-5">
    {#if selectedDetail && selectedItem}
      <div class="mb-4">
        <h3 class="text-base font-semibold text-gray-900">{selectedDetail.name}</h3>
        <div class="mt-1.5 flex items-center gap-2">
          <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {TEMPLATE_TYPE_LABELS[selectedDetail.template_type] ?? selectedDetail.template_type}
          </span>
          {#if selectedDetail.is_default}
            <span class="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">기본</span>
          {/if}
          {#if !selectedDetail.center_id}
            <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">시스템 제공</span>
          {/if}
        </div>
      </div>

      <hr class="border-gray-100 mb-4" />

      <!-- 발송 미리보기 -->
      <div class="mb-5">
        <h4 class="mb-2 text-sm font-medium text-gray-700">발송 미리보기</h4>
        <p class="mb-3 text-xs text-gray-500">파란색 항목은 발송 시 자동으로 채워집니다.</p>
        <div class="mx-auto max-w-xs">
          <div class="rounded-xl bg-gray-100 p-4">
            <div class="rounded-lg bg-white p-3 shadow-sm">
              <p class="mb-1 text-[10px] font-semibold text-gray-400">[Web발신]</p>
              <p class="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{@html contentHtml}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 자동 입력 항목 -->
      {#if selectedDetail.variables.length > 0}
        <hr class="border-gray-100 mb-4" />
        <div>
          <h4 class="mb-2 text-sm font-medium text-gray-700">자동 입력 항목</h4>
          <div class="flex flex-wrap gap-2">
            {#each selectedDetail.variables as v}
              <div class="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                <span class="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-mono text-blue-600">{v.key}</span>
                <span class="text-xs text-gray-700">{v.label}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    {:else if loadingDetail}
      <div class="flex items-center justify-center py-12 text-sm text-gray-400">불러오는 중...</div>
    {:else}
      <div class="flex items-center justify-center py-12 text-sm text-gray-400">
        왼쪽에서 양식을 선택해 주세요.
      </div>
    {/if}
  </div>
</div>
