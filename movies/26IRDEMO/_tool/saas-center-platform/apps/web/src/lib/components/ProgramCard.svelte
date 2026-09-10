<script lang="ts">
  import { onMount } from 'svelte'
  import AvatarImage from '$lib/assets/memberAvatar.png'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from './common/Tooltip.svelte'

  interface ManagerItem {
    id: string
    name: string
  }

  interface Props {
    title: string
    managers?: ManagerItem[]
    type: 'INDIVIDUAL' | 'GROUP'
    price: number
    duration_minutes: number
    onEdit?: () => void
    onDelete?: () => void
    showActions?: boolean
  }

  let {
    title,
    managers = [],
    type,
    price,
    duration_minutes,
    onEdit = () => {},
    onDelete = () => {},
    showActions = true
  }: Props = $props()

  let open = $state(false)
  let container = $state<HTMLDivElement>()

  const handleOutsideClick = (e: MouseEvent) => {
    if (container && !container.contains(e.target as Node)) {
      open = false
    }
  }

  onMount(() => {
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  })
</script>

<div
  bind:this={container}
  class="relative w-full rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4"
>
  <!-- 상단 -->
  <div class="flex items-start justify-between">
    <div class="flex gap-2 items-center">
      <div class="px-2 py-1.5 rounded-sm bg-gray-100">
        <Typography variant="body-03-normal-medium" color="text-gray-600">
          {type === 'INDIVIDUAL' ? '개별' : '그룹'}
        </Typography>
      </div>
      <Typography variant="title-02-semibold">
        {title}
      </Typography>
    </div>
    {#if showActions}
      <Tooltip text="더보기">
        <button
          class="text-gray-400 hover:text-gray-600"
          aria-label="더보기"
          onclick={(e) => {
            e.stopPropagation()
            open = !open
          }}
        >
          ⋮
        </button>
      </Tooltip>
    {/if}
    {#if showActions && open}
      <div
        class="
        absolute right-4 top-10 z-20
        w-32 rounded-lg border border-gray-200 bg-white shadow-lg
        text-sm
      "
      >
        <button
          class="w-full px-3 py-2 text-left hover:bg-gray-50"
          onclick={() => {
            open = false
            onEdit()
          }}
        >
          수정
        </button>
        <button
          class="w-full px-3 py-2 text-left text-status-danger hover:bg-status-danger-bg"
          onclick={() => {
            open = false
            onDelete()
          }}
        >
          삭제
        </button>
      </div>
    {/if}
  </div>
  <!-- 담당자 -->
  <div class="flex items-center gap-3">
    <Typography
      variant="body-02-normal-medium"
      color="text-gray-500"
      className="shrink-0"
    >
      담당자
    </Typography>

    {#if managers.length === 0}
      <Typography variant="body-02-normal-medium" color="text-gray-400">
        미지정
      </Typography>
    {:else}
      <div class="flex items-center gap-2 overflow-hidden">
        {#each managers.slice(0, 3) as manager}
          <div class="flex items-center gap-1">
            <img src={AvatarImage} alt="avatar" class="w-5 h-5 rounded-full" />
            <Typography
              variant="body-02-normal-medium"
              color="text-gray-900"
              className="whitespace-nowrap"
            >
              {manager.name}
            </Typography>
          </div>
        {/each}
        {#if managers.length > 3}
          <Typography variant="body-02-normal-medium" color="text-gray-500">
            +{managers.length - 3}
          </Typography>
        {/if}
      </div>
    {/if}
  </div>
  <!-- 하단 정보 — 금액·소요시간 가로 배치 -->
  <div class="flex items-stretch gap-4 rounded-lg bg-gray-50 px-3 py-3">
    <div class="flex flex-1 flex-col gap-3">
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        금액
      </Typography>
      <Typography variant="body-01-normal-semibold" color="text-gray-900">
        {price.toLocaleString()}원
      </Typography>
    </div>

    <div class="w-px self-stretch bg-gray-200"></div>

    <div class="flex flex-1 flex-col gap-3">
      <Typography variant="body-02-normal-regular" color="text-gray-700">
        소요시간
      </Typography>
      <Typography variant="body-01-normal-semibold" color="text-gray-900">
        {duration_minutes}분
      </Typography>
    </div>
  </div>
</div>
