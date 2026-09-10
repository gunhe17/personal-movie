<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import ClientSearchDropdown from '$lib/components/ClientSearchDropdown.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import type { CounselFormModel } from '$lib/features/schedule/counsel/hooks.svelte'
  import CloseGrayCircle16Icon from '$root/src/lib/assets/CloseGrayCircle16Icon.svelte'

  export type IndividualClientState = Pick<
    CounselFormModel,
    'searchQuery' | 'selectedClients' | 'isDropdownOpen' | 'isRegisterFormOpen'
  >

  export type IndividualClientActions = Pick<
    CounselFormModel,
    | 'setSearchQuery'
    | 'setIsDropdownOpen'
    | 'handleInputChange'
    | 'handleInputFocus'
    | 'handleClientSelect'
    | 'handleRemoveClient'
    | 'handleRegisterSubmit'
    | 'handleRegisterFormChange'
  >

  interface Props {
    view: IndividualClientState
    actions: IndividualClientActions
  }

  let { view, actions }: Props = $props()

  let dropdownRef: HTMLDivElement | null = $state(null)

  function handleInputBlur(event: FocusEvent) {
    if (view.isRegisterFormOpen) return
    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && dropdownRef?.contains(relatedTarget)) return
    setTimeout(() => {
      if (!view.isRegisterFormOpen) {
        actions.setIsDropdownOpen(false)
      }
    }, 200)
  }
</script>

<section class="mb-8">
  <Typography variant="title-01-normal-semibold" className="mb-3">
    내담자 <span class="field-required">*</span>
  </Typography>
  <!-- 검색 입력 -->
  <div class="relative" bind:this={dropdownRef}>
    <input
      type="text"
      value={view.searchQuery}
      oninput={(e) => {
        actions.setSearchQuery(e.currentTarget.value)
        actions.handleInputChange()
      }}
      onfocus={actions.handleInputFocus}
      onblur={handleInputBlur}
      placeholder="내담자 검색 또는 선택"
      class="text-body-01-normal-regular h-12 w-full rounded-lg border border-gray-200 px-3 pr-10 focus:border-border-active focus:outline-none"
    />
    <div
      class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
    >
      <SearchIcon size={20} />
    </div>
    <ClientSearchDropdown
      searchQuery={view.searchQuery}
      onClientSelect={actions.handleClientSelect}
      onRegisterSubmit={actions.handleRegisterSubmit}
      isOpen={view.isDropdownOpen}
      onRegisterFormChange={actions.handleRegisterFormChange}
      onClose={() => actions.setIsDropdownOpen(false)}
    />
  </div>
  <!-- 선택된 내담자 칩들 -->
  {#if view.selectedClients.length > 0}
    <div class="mt-3 flex flex-wrap gap-2">
      {#each view.selectedClients as client (client.uid)}
        <button
          type="button"
          onclick={() => actions.handleRemoveClient(client.uid)}
          class="flex items-center gap-1.5 h-9 border border-primary-400 rounded-lg bg-primary-50 px-2.5 transition-colors hover:bg-primary-100"
          aria-label="{client.name} 삭제"
        >
          <Typography variant="body-03-medium" color="text-primary-500">
            {client.name}
          </Typography>
          <CloseGrayCircle16Icon />
        </button>
      {/each}
    </div>
  {/if}
</section>
