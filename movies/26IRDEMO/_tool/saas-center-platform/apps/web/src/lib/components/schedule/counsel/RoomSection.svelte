<script lang="ts">
  import type { RoomItemType } from '$root/src/lib/hooks/actions/room.action'
  import { modalStore } from '$root/src/lib/stores/modal'
  import Typography from '@common/components/Typography.svelte'
  import RoomRegisterModal from '../../modal/RoomRegisterModal.svelte'
  import { MODAL_SIZES } from '$root/src/lib/features/schedule/counsel'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import { snackbarStore } from '$root/src/lib/stores/snackbar'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { CENTER_MANAGE_ROOM_RULE } from '$root/src/lib/features/center/permissions'

  interface Props {
    isRequired?: boolean
    roomList: RoomItemType[]
    selectedRoom: RoomItemType | null
    onSelectRoom: (room: RoomItemType) => void
    title?: string
    showTitle?: boolean
    showAddButton?: boolean
    isLoading?: boolean
  }

  let {
    isRequired = false,
    roomList,
    selectedRoom,
    onSelectRoom,
    title = '장소',
    showTitle = true,
    showAddButton = true,
    isLoading = false
  }: Props = $props()

  const openRoomRegisterModal = () => {
    modalStore.open({
      component: RoomRegisterModal,
      props: {
        onSuccessAfterCreate: (created: any) => {
          snackbarStore.success('상담실 생성을 완료했어요')
          if (created?.id) {
            onSelectRoom({
              id: created.id,
              name: created.name,
              is_active: created.is_active ?? true
            } as RoomItemType)
          }
        }
      },
      options: MODAL_SIZES.roomRegister
    })
  }
</script>

<div>
  {#if showTitle}
    <Typography variant="body-02-medium" className="mb-3">
      {title}
      {#if isRequired}
        <span class="field-required">*</span>
      {/if}
    </Typography>
  {/if}
  {#if isLoading}
    <div class="flex flex-wrap gap-2">
      {#each Array(3) as _}
        <div class="h-12 w-24 rounded-lg bg-gray-100 animate-pulse"></div>
      {/each}
    </div>
  {:else if roomList.length}
    <div class="flex flex-wrap gap-2">
      {#each roomList as room}
        {@const isSel = selectedRoom?.id === room.id}
        <button
          type="button"
          onclick={() => onSelectRoom(room)}
          class="flex h-12 items-center overflow-hidden rounded-lg border px-4 text-sm transition-colors {isSel
            ? 'border-primary-400 bg-primary-50 text-primary-600'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
        >
          {room.name}
        </button>
      {/each}
      {#if showAddButton}
        <PermissionGuard rule={CENTER_MANAGE_ROOM_RULE}>
          <button
            type="button"
            onclick={openRoomRegisterModal}
            class="flex items-center gap-2 rounded-lg border border-dashed border-border-strong h-12 px-5 text-body-02-normal-regular text-action-primary transition-colors hover:bg-gray-50"
          >
            <PlusIcon20 />
            추가
          </button>
        </PermissionGuard>
      {/if}
    </div>
  {:else}
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-2"
      >
        등록된 상담실이 없어요. 먼저 상담실을 추가해주세요.
      </Typography>
      <PermissionGuard rule={CENTER_MANAGE_ROOM_RULE}>
        <button
          type="button"
          onclick={openRoomRegisterModal}
          class="flex items-center gap-2 text-body-02-normal-medium text-action-primary hover:text-action-primary-hover"
        >
          <PlusIcon20 />
          상담실 추가
        </button>
      </PermissionGuard>
    </div>
  {/if}
</div>
