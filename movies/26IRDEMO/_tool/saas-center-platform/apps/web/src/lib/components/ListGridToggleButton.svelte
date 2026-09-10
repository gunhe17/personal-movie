<script lang="ts">
  interface Props {
    viewType: 'list' | 'grid'
    onViewChange?: (view: 'list' | 'grid') => void
  }

  let { viewType = $bindable(), onViewChange }: Props = $props()

  function setView(next: 'list' | 'grid') {
    viewType = next
    onViewChange?.(next)
  }

  const isGrid = $derived(viewType === 'grid')

  // 선택 표시(흰 알약)를 버튼마다 그리면 전환이 끊겨 보인다 — 하나를 공유해 좌우로 민다.
  // 두 버튼은 레이블 길이가 달라("리스트"/"카드") 폭도 함께 보간해야 해서 실측한다.
  let listW = $state(0)
  let gridW = $state(0)
  const GAP = 4 // 컨테이너 gap-1
  const measured = $derived(listW > 0 && gridW > 0)
  const indicatorStyle = $derived(
    `width: ${isGrid ? gridW : listW}px; transform: translateX(${isGrid ? listW + GAP : 0}px);`
  )
</script>

<div
  class="relative flex h-11 w-fit items-center gap-1 rounded-lg bg-gray-100 p-1"
>
  <!-- 공유 인디케이터 — 측정 전에는 전환을 걸지 않는다(0 → 실측폭이 애니메이션으로 보인다) -->
  {#if measured}
    <div
      aria-hidden="true"
      class="pointer-events-none absolute top-1 left-1 h-9 rounded-md border border-gray-200 bg-white shadow transition-[width,transform] duration-300 ease-out motion-reduce:transition-none"
      style={indicatorStyle}
    ></div>
  {/if}

  <button
    bind:offsetWidth={listW}
    onclick={() => setView('list')}
    class="relative z-10 flex h-9 items-center gap-2 rounded-md border border-transparent px-3"
  >
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <path
        d="M21 9L7 9"
        stroke={viewType === 'list' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.5"
        stroke-linecap="round"
        class="transition-colors duration-300"
      />
      <path
        d="M21 14L7 14"
        stroke={viewType === 'list' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.5"
        stroke-linecap="round"
        class="transition-colors duration-300"
      />
      <path
        d="M21 19L7 19"
        stroke={viewType === 'list' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.5"
        stroke-linecap="round"
        class="transition-colors duration-300"
      />
    </svg>
    <span
      class="text-body-02-normal-medium transition-colors duration-300 {viewType ===
      'list'
        ? 'text-gray-700'
        : 'text-gray-400'}"
    >
      리스트
    </span>
  </button>
  <button
    bind:offsetWidth={gridW}
    onclick={() => setView('grid')}
    class="relative z-10 flex h-9 items-center gap-2 rounded-md border border-transparent px-3"
  >
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <rect
        x="4.75"
        y="6.75"
        width="18.5"
        height="14.5"
        rx="1.58333"
        stroke={viewType === 'grid' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.5"
        class="transition-colors duration-300"
      />
      <path
        d="M10 7V21"
        stroke={viewType === 'grid' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.75"
        class="transition-colors duration-300"
      />
      <path
        d="M18 7V21"
        stroke={viewType === 'grid' ? '#6D7882' : '#B1B8BE'}
        stroke-width="1.75"
        class="transition-colors duration-300"
      />
    </svg>
    <span
      class="text-body-02-normal-medium transition-colors duration-300 {viewType ===
      'grid'
        ? 'text-gray-700'
        : 'text-gray-400'}"
    >
      카드
    </span>
  </button>
</div>
