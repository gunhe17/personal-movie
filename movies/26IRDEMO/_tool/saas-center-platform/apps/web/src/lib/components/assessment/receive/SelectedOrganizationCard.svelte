<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import EditUnderlineIcon from '$lib/assets/EditUnderlineIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import GroupIcon from '$lib/assets/GroupIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import type { Organization } from '$lib/types/organization'

  interface Props {
    organization: Organization
    onEdit?: () => void
    onDelete?: () => void
  }

  let { organization, onEdit, onDelete }: Props = $props()
</script>

<div class="mb-6 rounded-lg bg-gray-50 p-4">
  <div class="flex items-start justify-between">
    <div class="flex gap-3">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1">
          <GroupIcon />
          <Typography variant="body-01-medium" color="text-gray-900">
            {organization.name}
          </Typography>
        </div>
        <div class="flex flex-col gap-2">
          <Typography variant="body-02-regular" color="text-gray-600">
            주소 : {organization.address || '-'}
          </Typography>
          <Typography variant="body-03-regular" color="text-gray-600">
            연락처 : {organization.phone || '-'}
          </Typography>
        </div>
      </div>
    </div>
    <div>
      {#if onEdit}
        <button
          type="button"
          onclick={onEdit}
          class="text-gray-400 hover:text-gray-600"
          aria-label="수정"
        >
          <EditUnderlineIcon />
        </button>
      {/if}
      {#if onDelete}
        <Tooltip text="삭제">
          <button
            type="button"
            onclick={onDelete}
            class="text-gray-400 hover:text-status-danger"
            aria-label="삭제"
          >
            <TrashIcon size={24} />
          </button>
        </Tooltip>
      {/if}
    </div>
  </div>
</div>
