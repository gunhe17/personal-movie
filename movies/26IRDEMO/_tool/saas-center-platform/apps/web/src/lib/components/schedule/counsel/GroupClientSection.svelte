<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import OrganizationSearchDropdown from '$lib/components/OrganizationSearchDropdown.svelte'
  import { SelectedOrganizationCard } from '$lib/components/assessment/receive'
  import EditUnderlineIcon from '$lib/assets/EditUnderlineIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import type { CounselFormModel } from '$lib/features/schedule/counsel/hooks.svelte'

  export type GroupClientState = Pick<
    CounselFormModel,
    | 'groupSearchQuery'
    | 'selectedOrganization'
    | 'isOrganizationEditMode'
    | 'isGroupDropdownOpen'
    | 'isGroupRegisterFormOpen'
    | 'groupMembers'
  > & {
    organizationEditData?: {
      name: string
      address: string
      phone: string
    } | null
  }

  export type GroupClientActions = Pick<
    CounselFormModel,
    | 'setGroupSearchQuery'
    | 'setIsGroupDropdownOpen'
    | 'handleGroupInputChange'
    | 'handleGroupInputFocus'
    | 'handleOrganizationSelect'
    | 'handleGroupRegisterSubmit'
    | 'handleGroupRegisterFormChange'
    | 'handleEditOrganization'
    | 'handleDeleteOrganization'
    | 'handleOrganizationEditCancel'
    | 'clearGroupMembers'
  > & {
    onExcelUploadClick: () => void
    onEditGroupMembers: () => void
  }

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
    <Typography variant="body-01-medium" color="text-gray-700" className="mb-2">
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
        class="text-body-02-normal-regular h-13 w-full rounded-lg border border-gray-200 px-3 focus:border-border-active focus:outline-none"
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

<!-- 내담자 목록 -->
<div class="mb-8">
  <div class="mb-3 flex items-center justify-between">
    <Typography variant="body-01-medium" color="text-gray-700">
      내담자 목록 <span class="field-required">*</span>
    </Typography>
  </div>

  <button
    type="button"
    onclick={actions.onExcelUploadClick}
    class="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
  >
    <PlusIcon20 />
    내담자 일괄 추가
  </button>

  {#if view.groupMembers.length > 0}
    <div class="mt-4">
      <div
        class="flex h-12 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4"
      >
        <Typography variant="body-01-medium" color="text-gray-700">
          {view.groupMembers[0].name}{view.groupMembers.length > 1
            ? ` 외 ${view.groupMembers.length - 1}명`
            : ''}
        </Typography>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={actions.onEditGroupMembers}
            class="p-1 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="수정"
          >
            <EditUnderlineIcon />
          </button>

          <Tooltip text="삭제">
            <button
              type="button"
              onclick={actions.clearGroupMembers}
              class="p-1 text-gray-400 transition-colors hover:text-status-danger"
              aria-label="삭제"
            >
              <TrashIcon />
            </button>
          </Tooltip>
        </div>
      </div>
      <Typography
        variant="body-02-regular"
        color="text-primary-500"
        className="mt-2"
      >
        검사 접수 시 신규 내담자는 내담자 목록에 등록됩니다.
      </Typography>
    </div>
  {/if}
</div>
