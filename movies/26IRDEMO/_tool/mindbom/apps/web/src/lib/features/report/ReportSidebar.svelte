<script lang="ts">
  /**
   * 좌측 사이드바 — 탭(검사자료/교차분석) + 탭 내용 + 바닥의 내담자 요약.
   *
   * 자료를 본문에 넣는 일은 하지 않는다. 클릭을 위로 올려보내기만 하고
   * 삽입·제거는 route가 서비스에 시킨다 — 여기가 에디터를 만지기 시작하면
   * 그리는 것과 본문을 고치는 것의 경계가 무너진다.
   * (MaterialsPanel이 첨부 판정을 props로 받는 것과 같은 이유)
   */
  import ClientSummary from './ClientSummary.svelte'
  import MaterialsPanel from './MaterialsPanel.svelte'
  import LongitudinalPanel from './LongitudinalPanel.svelte'
  import SidebarTabs, { type SideTab } from './SidebarTabs.svelte'
  import type { ClientInfo, MaterialAsset, MaterialGroup } from './materials'

  interface Props {
    activeTab: SideTab
    onSelectTab: (tab: SideTab) => void

    groups: MaterialGroup[]
    assetsLoading: boolean
    /** 접힌 검사 id 집합 */
    collapsed: Set<string>
    isAttached: (id: string, src?: string) => boolean
    onToggleCollapse: (examId: string) => void
    onOpenResult: (g: MaterialGroup) => void
    onAssetClick: (g: MaterialGroup, a: MaterialAsset) => void
    onAssetDragStart?: (g: MaterialGroup, a: MaterialAsset) => void
    onAttachedClick: (a: MaterialAsset, e: MouseEvent) => void

    /** 자료 목록을 스크롤하면 떠 있던 말풍선을 닫는다 (fixed 좌표라 따라오지 않는다) */
    onScroll: () => void

    client: ClientInfo | null
    loaded: boolean
  }

  let {
    activeTab,
    onSelectTab,
    groups,
    assetsLoading,
    collapsed,
    isAttached,
    onToggleCollapse,
    onOpenResult,
    onAssetClick,
    onAssetDragStart,
    onAttachedClick,
    onScroll,
    client,
    loaded
  }: Props = $props()
</script>

<aside
  class="relative hidden h-full w-90 shrink-0 flex-col border-r border-chrome-line bg-chrome text-chrome-fg lg:flex"
>
  <SidebarTabs active={activeTab} onselect={onSelectTab} />

  <div
    onscroll={onScroll}
    class="scrollbar-custom scrollbar-sidebar flex-1 overflow-y-auto bg-chrome p-3"
  >
    {#if activeTab === 'materials'}
      <MaterialsPanel
        {groups}
        {assetsLoading}
        {collapsed}
        {isAttached}
        {onToggleCollapse}
        {onOpenResult}
        {onAssetClick}
        {onAssetDragStart}
        {onAttachedClick}
      />
    {:else}
      <LongitudinalPanel />
    {/if}
  </div>

  <ClientSummary {client} {loaded} />
</aside>
