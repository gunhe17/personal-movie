<script lang="ts">
  import MemberProfileCard from './MemberProfileCard.svelte'
  import type { MemberDetailResponse } from '$lib/hooks/actions/member.action'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    closePanel: () => void
    panelId?: string
    member: MemberDetailResponse
    onModify?: () => void
    onAvatarChange?: (file: File) => void | Promise<void>
  }

  let { closePanel, member, onModify, onAvatarChange }: Props = $props()
</script>

<div class="flex flex-col h-full">
  <!-- 헤더 -->
  <div
    class="flex items-center justify-between px-5 py-4 border-b border-gray-200"
  >
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      구성원 정보
    </Typography>
    <Tooltip text="닫기">
      <button
        onclick={closePanel}
        class="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="패널 닫기"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 5L5 15M5 5l10 10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </Tooltip>
  </div>

  <!-- 프로필 콘텐츠 -->
  <div class="flex-1 overflow-y-auto p-5">
    <MemberProfileCard {member} {onModify} {onAvatarChange} bare />
  </div>
</div>
