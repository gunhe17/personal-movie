<script lang="ts">
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { CounselFormModel } from '../../features/schedule/counsel/hooks.svelte'
  import EditUnderlineIcon from '../../assets/EditUnderlineIcon.svelte'
  import TrashIcon from '../../assets/TrashIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  type GroupClientState = Pick<
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

  type GroupClientActions = Pick<
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
</script>

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
    class="flex h-12 items-center gap-2 rounded-lg border border-dashed border-border-strong px-5 text-body-02-normal-regular text-action-primary transition-colors hover:bg-gray-100"
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
