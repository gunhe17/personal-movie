<script lang="ts">
  import ProfileSection from './ProfileSection.svelte'
  import type {
    ClientDetailVM,
    RelationInfo
  } from '$lib/features/clients/detail'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'

  interface Props {
    closePanel: () => void
    panelId?: string
    client: ClientDetailVM
    clientId: string
    relationList: RelationInfo[]
    isSecretMode: boolean
    onEditClick: () => void
    onRelationClick: (relation: RelationInfo) => void
  }

  let {
    closePanel,
    client,
    clientId,
    relationList,
    isSecretMode,
    onEditClick,
    onRelationClick
  }: Props = $props()
</script>

<div class="flex flex-col h-full">
  <!-- 패널 헤더 — 높이 62 고정 (Web_Design.md §Components>panel-header) -->
  <div
    class="flex h-[62px] shrink-0 items-center justify-between border-b border-gray-200 px-6"
  >
    <Typography variant="title-01-normal-semibold" color="text-gray-900">
      내담자 정보
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

  <!-- 프로필 콘텐츠 — 잘리는 위/아래 끝은 ScrollFadeArea가 그라데이션으로 마스크 -->
  <ScrollFadeArea class="p-5" bounceArrow deps={[client, relationList]}>
    <ProfileSection
      {client}
      {clientId}
      {relationList}
      {isSecretMode}
      {onEditClick}
      {onRelationClick}
      bare
    />
  </ScrollFadeArea>
</div>
