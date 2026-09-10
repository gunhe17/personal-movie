<style>
  .org-dropdown-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .org-dropdown-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dropdown-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  .org-dropdown-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import { tick } from 'svelte'
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getInstitutionList } from '$lib/hooks/actions/institution.action'
  import { portal } from '$lib/utils/positionPortal'
  import { modalStore } from '$lib/stores/modal'
  import type { Organization } from '../types/organization'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    placeholder?: string
    onOrganizationSelect: (organization: Organization) => void
    onRegisterSubmit?: (data: {
      name: string
      address: string
      phone: string
    }) => void
    selectedOrganization?: Organization | null
    onClear?: () => void
    searchQuery?: string
    isOpen?: boolean
    onRegisterFormChange?: (isOpen: boolean) => void
    isEditMode?: boolean
    editData?: { name: string; address: string; phone: string } | null
    onEditCancel?: () => void
    onClose?: () => void
    containerElement?: HTMLElement | null
  }

  let {
    placeholder = '기관명을 검색하거나 등록하세요 (선택)',
    onOrganizationSelect,
    onRegisterSubmit,
    selectedOrganization = null,
    onClear
  }: Props = $props()

  let searchQuery = $state('')
  let isOpen = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  let wrapperEl = $state<HTMLDivElement | null>(null)

  const institutionsQuery = $derived(
    queryBuilder(
      getInstitutionList,
      () => ({
        keyword: searchQuery.trim() || undefined,
        page: 1,
        size: 20
      }),
      { enabled: isOpen }
    )
  )

  const displayOrganizations = $derived(
    (institutionsQuery.data?.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      address: '',
      phone: ''
    }))
  )

  function handleFocus() {
    isOpen = true
  }

  function handleClose() {
    isOpen = false
  }

  async function handleSelect(org: Organization) {
    isOpen = false
    searchQuery = ''
    await tick()
    onOrganizationSelect(org)
  }

  async function openRegisterModal() {
    handleClose()
    const { default: OrganizationRegisterModal } = await import(
      './modal/OrganizationRegisterModal.svelte'
    )
    modalStore.open({
      component: OrganizationRegisterModal,
      props: {
        onConfirm: (data: { name: string; address: string; phone: string }) => {
          onRegisterSubmit?.(data)
        }
      },
      options: { size: 'fit' }
    })
  }
</script>

<div class="relative mt-2" bind:this={wrapperEl}>
  {#if selectedOrganization}
    <!-- 선택된 기관 -->
    <div
      class="text-title-02-normal-regular h-13 w-full rounded-lg border border-gray-200 px-4 flex items-center justify-between"
    >
      <span class="text-gray-800">{selectedOrganization.name}</span>
      <Tooltip text="선택 해제">
        <button
          type="button"
          onclick={onClear}
          class="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600"
          aria-label="선택 해제"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M9 3L3 9M3 3l6 6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </Tooltip>
    </div>
  {:else}
    <!-- 검색 인풋 -->
    <input
      type="text"
      bind:this={inputEl}
      bind:value={searchQuery}
      onfocus={handleFocus}
      {placeholder}
      class="field-input w-full"
    />
  {/if}
</div>

<!-- 드롭다운 (portal) -->
{#if isOpen && wrapperEl}
  <div
    use:portal={{ anchor: wrapperEl, offset: 8, callback: handleClose }}
    class="dropdown-panel max-h-none overflow-hidden fixed z-20000 min-w-120"
    transition:slide={{ duration: 300, easing: quintOut }}
  >
    {#if displayOrganizations.length > 0}
      <!-- 검색 결과 -->
      <div
        class="org-dropdown-scroll dropdown-list max-h-50 grow overflow-y-auto"
      >
        {#each displayOrganizations as org}
          <button
            type="button"
            onclick={() => handleSelect(org)}
            class="dropdown-item h-auto justify-start gap-2 py-2"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-blue-300"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 9.5L12 3L21 9.5V21H15V15H9V21H3V9.5Z" />
              </svg>
            </div>
            <Typography
              variant="body-01-semibold"
              color="text-gray-800"
              className="shrink-0 truncate-safe"
            >
              {org.name}
            </Typography>
          </button>
        {/each}
      </div>
      <div
        class="flex shrink-0 items-center justify-center gap-2 border-t border-border-subtle py-4"
      >
        <Typography variant="body-02-normal-regular" color="text-body-default"
          >찾는 단체(기관)가 없나요?</Typography
        >
        <button
          type="button"
          onclick={openRegisterModal}
          class="flex items-center gap-2 text-action-primary hover:underline"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current"
            >새 기관 등록</Typography
          >
        </button>
      </div>
    {:else if searchQuery.trim() !== ''}
      <!-- 검색 결과 없음 -->
      <div class="flex flex-col items-center justify-center gap-4 p-8">
        <Typography variant="body-02-normal-regular" color="text-body-default"
          >검색 결과가 없어요</Typography
        >
        <button
          type="button"
          onclick={openRegisterModal}
          class="flex items-center gap-2 text-action-primary hover:underline"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current"
            >새 기관 등록</Typography
          >
        </button>
      </div>
    {:else}
      <!-- 초기 상태 -->
      <div class="flex flex-col items-center justify-center gap-4 p-8">
        <Typography variant="body-02-normal-regular" color="text-body-default"
          >기관명을 입력해주세요</Typography
        >
        <button
          type="button"
          onclick={openRegisterModal}
          class="flex items-center gap-2 text-action-primary hover:underline"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current"
            >새 기관 등록</Typography
          >
        </button>
      </div>
    {/if}

    <!-- 하단 확인 버튼 바 -->
    <div
      class="flex min-h-15 shrink-0 items-end justify-end border-t border-border-subtle p-3"
    >
      <button
        type="button"
        onclick={handleClose}
        class="rounded-lg bg-primary-500 px-4 py-2 duration-200 w-14 h-8"
      >
        <Typography variant="body-03-medium" color="text-white">확인</Typography
        >
      </button>
    </div>
  </div>
{/if}
