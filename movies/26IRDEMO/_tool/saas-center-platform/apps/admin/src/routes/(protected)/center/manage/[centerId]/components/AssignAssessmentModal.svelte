<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Checkbox from '$components/Checkbox.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
  import {
    getUnassignedAssessments,
    postAssignAssessment,
    type UnassignedAssessment
  } from '$hooks/actions/center-assessment.action'
  import { TYPE_LABELS } from '$lib/features/assessment/constants'

  interface Props {
    modalId?: string
    closeModal?: () => void
    centerId: string
    onAssigned?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    centerId,
    onAssigned = () => {}
  }: Props = $props()

  let search = $state('')
  let items = $state<UnassignedAssessment[]>([])
  let selected = $state<Set<string>>(new Set())
  let isLoading = $state(true)
  let isSubmitting = $state(false)

  const filteredItems = $derived(
    search.trim()
      ? items.filter((a) => {
          const term = search.toLowerCase()
          return (
            a.kor_name.toLowerCase().includes(term) ||
            a.eng_name.toLowerCase().includes(term) ||
            a.code.toLowerCase().includes(term)
          )
        })
      : items
  )

  const selectedCount = $derived(selected.size)

  // 초기 로드
  $effect(() => {
    loadUnassigned()
  })

  async function loadUnassigned() {
    isLoading = true
    try {
      items = await getUnassignedAssessments().request({ centerId })
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isLoading = false
    }
  }

  function toggleItem(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selected = next
  }

  async function handleAssign() {
    if (selectedCount === 0 || isSubmitting) return
    isSubmitting = true

    try {
      for (const assessmentId of selected) {
        await postAssignAssessment().request({
          centerId,
          assessment_id: assessmentId
        })
      }
      showSuccessSnackbar(`${selectedCount}개 검사가 할당되었습니다.`)
      onAssigned()
      closeModal()
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  bodyClass="p-6"
  footerClass="py-4 px-6"
  headerClass="px-6 py-4"
>
  {#snippet header()}
    <Typography variant="headline-02-semibold" color="text-gray-800">
      검사 할당
    </Typography>
  {/snippet}

  {#snippet body()}
    <!-- 검색 -->
    <div
      class="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        bind:value={search}
        placeholder="검사명 또는 코드 검색"
        class="flex-1 text-sm outline-none"
      />
    </div>

    <!-- 목록 -->
    {#if isLoading}
      <div class="flex items-center justify-center py-16">
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          불러오는 중...
        </Typography>
      </div>
    {:else if filteredItems.length === 0}
      <div class="py-16 text-center">
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          {items.length === 0
            ? '할당 가능한 검사가 없습니다'
            : '검색 결과가 없습니다'}
        </Typography>
      </div>
    {:else}
      <div class="max-h-80 overflow-y-auto space-y-1">
        {#each filteredItems as item (item.id)}
          <button
            type="button"
            onclick={() => toggleItem(item.id)}
            class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors {selected.has(
              item.id
            )
              ? 'border-primary-300 bg-primary-50'
              : 'border-gray-100 hover:bg-gray-50'}"
          >
            <Checkbox
              id={`assign-${item.id}`}
              checked={selected.has(item.id)}
              onchange={() => toggleItem(item.id)}
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
                >
                  {item.code}
                </span>
                <span class="text-sm font-medium text-gray-900 truncate">
                  {item.kor_name}
                </span>
              </div>
            </div>
            <span class="shrink-0 text-xs text-gray-400">
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button color="light" content="취소" onclick={closeModal} />
    <Button
      color="primary"
      content={selectedCount > 0 ? `할당 (${selectedCount}개)` : '할당'}
      disabled={selectedCount === 0 || isSubmitting}
      onclick={handleAssign}
    />
  {/snippet}
</BaseModal>
