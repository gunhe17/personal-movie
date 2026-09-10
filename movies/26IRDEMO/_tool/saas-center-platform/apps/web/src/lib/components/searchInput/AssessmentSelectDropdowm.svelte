<style>
  /* 스크롤바 스타일링 */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { quintOut } from 'svelte/easing'
  import { twMerge } from 'tailwind-merge'
  import { slide } from 'svelte/transition'

  import {
    getAssessments,
    type Assessment,
    type GetAssessmentsQueryParams
  } from '../../hooks/actions/assessment.action'
  import { queryBuilder } from '../../hooks/queries/builder'

  import type { PaginationRes } from '../../types/apiResponse'

  import { portal } from '../../utils/positionPortal'

  import Checkbox from '../Checkbox.svelte'
  import Close13 from '../../assets/Close13.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    selectedAssessments: Assessment[]
    selectedAssessmentIds: string[]
  }

  let {
    selectedAssessments = $bindable(),
    selectedAssessmentIds = $bindable()
  }: Props = $props()

  const assessmentsQuery = queryBuilder<Assessment, PaginationRes<Assessment>>(
    getAssessments,
    () => {
      const params: GetAssessmentsQueryParams = {
        status: 'public'
      }
      return { queryParams: params }
    }
  )
  const assessments = $derived(assessmentsQuery)
  const isLoading = $derived(assessments.isLoading)
  const queryData = $derived(assessments.data)

  let triggerEl = $state<HTMLElement | null>(null)
  let dropdownEl = $state<HTMLElement | null>(null)
  let isDropdownOpen = $state<boolean>(false)
  let localSelected = $state<Assessment[]>([])
  let localselectedIds = $derived(localSelected.map((a) => a.uid))

  const toggle = () => {
    isDropdownOpen = !isDropdownOpen
  }

  const toggleSelectAssessment = (assessment: Assessment) => {
    if (localselectedIds.includes(assessment.uid)) {
      const idx = localSelected.findIndex((a) => a.uid === assessment.uid)
      localSelected.splice(idx, 1)
    } else {
      localSelected.push(assessment)
      localSelected = [...localSelected]
    }
  }

  const onConfirm = () => {
    selectedAssessments = [...localSelected]
    isDropdownOpen = false
  }

  const handleBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null
    if (dropdownEl && next && dropdownEl.contains(next)) return
    isDropdownOpen = false
  }

  const updateLocal = (node: HTMLElement) => {
    localSelected = [...selectedAssessments]
    return {
      destroy() {
        node.remove()
      }
    }
  }
</script>

<div class="relative">
  <button
    type="button"
    bind:this={triggerEl}
    onclick={toggle}
    onblur={handleBlur}
    class={twMerge(
      'dropdown-trigger w-full',
      isDropdownOpen && 'is-open',
      !selectedAssessments.length && 'is-placeholder'
    )}
  >
    <span class="flex min-w-0 flex-1 items-center gap-1">
      <span class="dropdown-trigger-label">
        {selectedAssessments.length
          ? selectedAssessments[0].eng_name
          : '검사를 선택해주세요'}
      </span>
      {#if selectedAssessments.length > 1}
        <span class="dropdown-trigger-suffix">
          외 {selectedAssessments.length - 1}개
        </span>
      {/if}
    </span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        isDropdownOpen && 'rotate-180'
      )}
    />
  </button>
  <div class="flex items-center gap-1 flex-wrap mt-2">
    {#each selectedAssessments as assessment}
      <div
        class="px-2.5 py-[6.5px] flex items-center gap-1 rounded-[100px] bg-gray-600"
      >
        <Typography variant="body-02-regular" color="text-white">
          {assessment.eng_name}
        </Typography>
        <button
          class="flex-center hover:scale-105 duration-200"
          onclick={() => {
            const idx = selectedAssessments.findIndex(
              (a) => a.uid === assessment.uid
            )
            selectedAssessments.splice(idx, 1)
          }}
        >
          <Close13 />
        </button>
      </div>
    {/each}
  </div>
  {#if isDropdownOpen}
    <div
      bind:this={dropdownEl}
      transition:slide={{ duration: 200, easing: quintOut }}
      use:updateLocal
      use:portal={{
        anchor: triggerEl,
        offset: 8,
        callback: () => {
          isDropdownOpen = false
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed"
    >
      {#if queryData?.data && !isLoading}
        <div class="flex flex-col">
          <div class="dropdown-list max-h-70 grow overflow-y-auto">
            {#each queryData?.data as assessment}
              {@const isIncluded = localselectedIds.includes(assessment.uid)}
              <button
                type="button"
                onclick={() => toggleSelectAssessment(assessment)}
                class={`dropdown-item ${isIncluded ? 'is-selected' : ''}`}
              >
                <span>{assessment.kor_name}</span>
                <Checkbox
                  id={assessment.eng_name}
                  onchange={() => toggleSelectAssessment(assessment)}
                  checked={isIncluded}
                />
              </button>
            {/each}
          </div>
          <!-- 다중선택 액션 바 — 접수일 필터와 동일 규격 -->
          <div class="dropdown-footer">
            <button
              type="button"
              class="dropdown-footer-apply"
              onclick={onConfirm}
            >
              적용
            </button>
          </div>
        </div>
      {:else}
        <div class="p-6 text-center">
          <Typography variant="body-02-medium" color="text-gray-400">
            선택할 항목이 없습니다
          </Typography>
        </div>
      {/if}
    </div>
  {/if}
</div>
