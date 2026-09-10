<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { SelectedOrganizationCard } from '$lib/components/assessment/receive'
  import type {
    GroupClientActions,
    GroupClientState
  } from '../../features/clients/register/hooks.svelte'
  import OrganizationSearchDropdown from './OrganizationSearchDropdown.svelte'

  interface Props {
    view: GroupClientState
    actions: GroupClientActions
  }

  let { view, actions }: Props = $props()

  let groupDropdownRef: HTMLDivElement | null = $state(null)

  function handleGroupInputBlur(event: FocusEvent) {
    if (view.isGroupRegisterFormOpen) return
    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && groupDropdownRef?.contains(relatedTarget)) return
    setTimeout(() => {
      if (!view.isGroupRegisterFormOpen) {
        actions.setIsGroupDropdownOpen(false)
      }
    }, 200)
  }
</script>

{#if view.selectedOrganization && !view.isOrganizationEditMode}
  <SelectedOrganizationCard
    organization={view.selectedOrganization}
    onEdit={actions.handleEditOrganization}
    onDelete={actions.handleDeleteOrganization}
  />
{:else if view.isOrganizationEditMode}
  <div class="mb-8" bind:this={groupDropdownRef}>
    <OrganizationSearchDropdown
      searchQuery=""
      onOrganizationSelect={actions.handleOrganizationSelect}
      onRegisterSubmit={actions.handleGroupRegisterSubmit}
      isOpen={view.isGroupDropdownOpen}
      onRegisterFormChange={actions.handleGroupRegisterFormChange}
      isEditMode={true}
      editData={view.organizationEditData}
      onEditCancel={actions.handleOrganizationEditCancel}
    />
  </div>
{:else}
  <div class="mb-8">
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      className="mb-2"
    >
      단체(기관)명 <span class="field-required">*</span>
    </Typography>
    <div class="relative" bind:this={groupDropdownRef}>
      <input
        type="text"
        value={view.groupSearchQuery}
        oninput={(e) => {
          actions.setGroupSearchQuery(e.currentTarget.value)
          actions.handleGroupInputChange()
        }}
        onfocus={actions.handleGroupInputFocus}
        onblur={handleGroupInputBlur}
        placeholder="기관명을 검색해주세요"
        class="text-body-01-normal-regular placeholder:text-placeholder h-11 w-full rounded-lg border border-gray-200 px-3 focus:border-border-active focus:outline-none"
      />
      <OrganizationSearchDropdown
        searchQuery={view.groupSearchQuery}
        onOrganizationSelect={actions.handleOrganizationSelect}
        onRegisterSubmit={actions.handleGroupRegisterSubmit}
        isOpen={view.isGroupDropdownOpen}
        onRegisterFormChange={actions.handleGroupRegisterFormChange}
        onClose={() => actions.setIsGroupDropdownOpen(false)}
        containerElement={groupDropdownRef}
      />
    </div>
  </div>
{/if}
