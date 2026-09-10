<script lang="ts">
  import Switch from './Switch.svelte'
  import AvatarImage from '$lib/assets/roomAvatar.png'
  import Typography from '@common/components/Typography.svelte'
  import { modalStore } from '../stores/modal'
  import RoomRegisterModal from './modal/RoomRegisterModal.svelte'
  import { mutationBuilder } from '$root/src/lib/hooks/queries/builder'
  import {
    deleteRoom,
    patchToggleRoom
  } from '$root/src/lib/hooks/actions/room.action'
  import { centerId } from '$root/src/lib/stores/center.store'
  import { portal } from '../utils/positionPortal'
  import { snackbarStore } from '../stores/snackbar'
  import ConfirmModal from './modal/ConfirmModal.svelte'

  interface Props {
    name: string
    memo: string
    id: string
    thumbnail_url: string
    is_active: boolean
    description: string
    /** 오늘 예약 건수 (schedule 집계) */
    todayCount?: number
    /** 이번 주 예약 건수 (schedule 집계) */
    weekCount?: number
    /** 선택됨 (하단 활용현황 대상) */
    selected?: boolean
    /** 카드 선택 콜백 */
    onSelect?: () => void
  }

  let {
    name,
    memo,
    id,
    thumbnail_url,
    is_active,
    description,
    todayCount = 0,
    weekCount = 0,
    selected = false,
    onSelect
  }: Props = $props()

  // 토글 optimistic update용 로컬 상태 (prop 직접 변경 불가)
  // is_active prop이 바뀌면 로컬 상태도 동기화
  // svelte-ignore state_referenced_locally
  let active = $state(is_active)
  $effect(() => {
    active = is_active
  })

  let open = $state(false)
  let container = $state<HTMLButtonElement>()

  const toggleMutation = mutationBuilder(patchToggleRoom, ['getRoomList'])
  const deleteMutation = mutationBuilder(deleteRoom, ['getRoomList'])

  const handleToggleAvailable = () => {
    const newVal = !active
    // optimistic update
    active = newVal
    toggleMutation.mutate({
      center_id: $centerId,
      room_id: id,
      is_active: newVal
    })
  }

  const handleModifyRoom = () => {
    modalStore.open({
      component: RoomRegisterModal,
      props: { name, description, id, memo, thumbnail_url: thumbnail_url },
      options: {
        customWidth: 540
      }
    })
  }

  const handleDeleteRoom = () => {
    deleteMutation.mutate({
      center_id: $centerId,
      room_id: id
    }),
      {
        onSuccess() {
          snackbarStore.success('상담실이 삭제되었습니다.')
        },
        onError() {
          snackbarStore.error('상담실 삭제에 실패했습니다.')
        }
      }
  }

  const openDeleteConfirmModal = () => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: `[${name}]을(를) 삭제할까요?`,
        message: '삭제된 상담실은 복구할 수 없어요',
        type: 'warning',
        confirmText: '삭제할게요',
        cancelText: '아니요',
        onConfirm: handleDeleteRoom
      },
      // 소형 다이얼로그 규격 폭 420 (§popup)
      options: { customWidth: 420 }
    })
  }
</script>

<div
  role="button"
  tabindex="0"
  aria-pressed={selected}
  onclick={() => onSelect?.()}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.()
    }
  }}
  class="relative flex h-44 w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:shadow-md {selected
    ? 'border-primary-400 ring-2 ring-primary-200'
    : active
      ? 'border-gray-200'
      : 'border-gray-100'}"
>
  <!-- 이미지 영역 -->
  <div class="relative w-full flex-1 min-h-0 bg-gray-50">
    <img
      src={thumbnail_url || AvatarImage}
      alt={name}
      draggable="false"
      class="h-full w-full object-cover transition-all duration-200 {active
        ? ''
        : 'grayscale opacity-60'}"
    />
    <button
      bind:this={container}
      class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/30 text-gray-500 backdrop-blur-sm transition-colors duration-200 hover:bg-white/80 hover:text-gray-700"
      aria-label="더보기"
      onclick={(e) => {
        e.stopPropagation()
        open = !open
      }}
    >
      ⋮
    </button>
  </div>

  <!-- 정보 영역 (검사관리 카드와 동일 구조: 이름·설명 세로 스택 좌 · 토글 세로중앙 우) -->
  <div class="flex shrink-0 items-center justify-between gap-2 p-4">
    <div class="flex min-w-0 flex-col gap-3">
      <Typography variant="title-02-semibold" className="truncate-safe">
        {name}
      </Typography>
      <Typography
        variant="body-02-regular"
        color={description ? 'text-gray-500' : 'text-gray-400'}
        className="truncate-safe"
      >
        {description || '설명이 없어요'}
      </Typography>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Typography
        variant="body-03-medium"
        color={active ? 'text-primary-500' : 'text-gray-400'}
        className="select-none duration-200"
      >
        {active ? '사용가능' : '사용불가'}
      </Typography>
      <Switch checked={active} onclick={handleToggleAvailable} />
    </div>
  </div>

  {#if open}
    <div
      use:portal={{
        anchor: container,
        offset: 4,
        isFitWidth: false,
        callback: () => (open = false)
      }}
      class="dropdown-panel z-20"
    >
      <button
        onclick={(e) => {
          e.stopPropagation()
          handleModifyRoom()
        }}
        class="dropdown-item"
      >
        수정
      </button>
      <button
        onclick={(e) => {
          e.stopPropagation()
          openDeleteConfirmModal()
        }}
        class="dropdown-item is-danger"
      >
        삭제
      </button>
    </div>
  {/if}
</div>
