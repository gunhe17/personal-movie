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
  import Typography from '@common/components/Typography.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  export interface Grant {
    id: string
    name: string
    organization: string // 지원기관
    startDate: string // 시작일
    endDate: string // 종료일
    status: 'active' | 'inactive' | 'pending' // 진행상태
  }

  interface Props {
    searchQuery: string
    grants: Grant[]
    onGrantSelect: (grant: Grant) => void
    onRegisterClick: () => void
    isOpen: boolean
  }

  let { searchQuery, grants, onGrantSelect, onRegisterClick, isOpen }: Props =
    $props()

  // 검색어에 따라 필터링 (검색어가 없으면 모든 지원사업 표시)
  let displayGrants = $derived(
    searchQuery.length === 0
      ? grants
      : grants.filter(
          (grant) =>
            grant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            grant.organization.toLowerCase().includes(searchQuery.toLowerCase())
        )
  )

  // 상태에 따른 뱃지 색상
  const getStatusColor = (status: Grant['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'inactive':
        return 'bg-gray-100 text-gray-600'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusText = (status: Grant['status']) => {
    switch (status) {
      case 'active':
        return '진행중'
      case 'inactive':
        return '종료'
      case 'pending':
        return '예정'
      default:
        return '-'
    }
  }
</script>

{#if isOpen}
  <div
    transition:slide={{ duration: 300, easing: quintOut }}
    class="dropdown-panel max-h-none overflow-hidden absolute top-full right-0 left-0 z-50 mt-1"
  >
    <!-- 검색 결과 리스트 (최대 4개 표시, 스크롤) -->
    {#if displayGrants.length > 0}
      <div class="dropdown-list max-h-70 overflow-y-auto">
        {#each displayGrants as grant}
          <button
            onclick={() => onGrantSelect(grant)}
            class="dropdown-item h-auto gap-3 py-3"
          >
            <!-- 상태 아이콘 -->
            <div class="shrink-0">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="6"
                  width="18"
                  height="15"
                  rx="2"
                  stroke={grant.status === 'active' ? '#10B981' : '#9CA3AF'}
                  stroke-width="2"
                />
                <path
                  d="M3 10H21"
                  stroke={grant.status === 'active' ? '#10B981' : '#9CA3AF'}
                  stroke-width="2"
                />
                <circle
                  cx="7"
                  cy="8"
                  r="1"
                  fill={grant.status === 'active' ? '#10B981' : '#9CA3AF'}
                />
                <circle
                  cx="10"
                  cy="8"
                  r="1"
                  fill={grant.status === 'active' ? '#10B981' : '#9CA3AF'}
                />
              </svg>
            </div>

            <!-- 지원사업 정보 -->
            <div class="flex flex-1 flex-col items-start gap-1">
              <div class="flex items-center gap-2">
                <Typography variant="body-01-semibold" color="text-gray-800"
                  >{grant.name}</Typography
                >
                <span
                  class="rounded-full px-2 py-0.5 text-xs {getStatusColor(
                    grant.status
                  )}"
                >
                  {getStatusText(grant.status)}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-default">{grant.organization}</Typography
                >
                <Typography variant="body-02-medium" color="text-gray-400"
                  >•</Typography
                >
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-default"
                  >{grant.startDate} ~ {grant.endDate}</Typography
                >
              </div>
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="flex items-center justify-center p-8">
        <Typography variant="body-02-medium" color="text-gray-400"
          >검색 결과가 없어요</Typography
        >
      </div>
    {/if}

    <!-- 지원사업 등록 버튼 -->
    <div class="border-t border-border-subtle p-2">
      <button
        onclick={onRegisterClick}
        class="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-action-primary transition-colors hover:bg-primary-50"
      >
        <PlusIcon20 />
        <Typography variant="body-02-normal-medium" color="text-current"
          >지원사업 등록</Typography
        >
      </button>
    </div>
  </div>
{/if}
