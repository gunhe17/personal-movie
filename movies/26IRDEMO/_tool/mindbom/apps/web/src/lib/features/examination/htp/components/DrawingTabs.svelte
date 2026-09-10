<script lang="ts">
  import type { DrawingData } from '../types'
  import { CATEGORY_CONFIG } from '../constants'
  import type { HTPCategory } from '../types'
  import ScrollStrip from '$components/ui/ScrollStrip.svelte'

  interface Props {
    drawings: DrawingData[]
    activeIndex: number
    onTabChange: (index: number) => void
  }

  let { drawings, activeIndex, onTabChange }: Props = $props()

  function getStatusInfo(drawing: DrawingData) {
    const hasImage = !!drawing.imageUrl
    return { text: hasImage ? '완료' : '확인 전', isComplete: hasImage }
  }
</script>

<ScrollStrip
  activeKey={activeIndex}
  gapClass="gap-3"
  class="shrink-0 border-b border-gray-200 bg-white px-6 py-3"
>
  {#each drawings as drawing, index (drawing.id)}
    {@const isActive = index === activeIndex}
    {@const status = getStatusInfo(drawing)}
    {@const borderStyle = status.isComplete
      ? 'border-blue-500 bg-blue-50'
      : 'border-gray-200 bg-white'}
    <!-- ring 색은 팔레트 토큰으로 — blue-500은 Tailwind 기본값이라 우리 파랑과 미묘히 다르다 -->
    {@const activeStyle = isActive
      ? 'ring-2 ring-primary-500 ring-offset-2'
      : ''}
    <!--
      폭을 고정한다 — 라벨 길이가 달라("집" vs "남자사람") 탭마다 폭이 갈리면
      눈금이 안 맞아 보인다. 가장 긴 '남자사람'이 한 줄로 들어가는 값.
    -->
    <button
      onclick={() => onTabChange(index)}
      data-strip-key={index}
      class="flex w-52 shrink-0 items-center gap-3 px-4 py-3 rounded-lg border {borderStyle} {activeStyle} cursor-pointer hover:shadow-sm transition-all"
    >
      <!-- Thumbnail -->
      <div
        class="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-300"
      >
        {#if drawing.imageUrl}
          <img
            src={drawing.imageUrl}
            alt={drawing.label}
            class="w-full h-full object-cover"
          />
        {:else}
          <span class="material-icons-round text-2xl {drawing.textClass}"
            >{drawing.icon}</span
          >
        {/if}
      </div>
      <!-- Label & Status -->
      <div class="min-w-0 text-left">
        <div class="flex items-center gap-1">
          <!-- '남자사람'이 두 줄로 갈리지 않게 — 폭이 모자라면 넘치지 말고 줄인다 -->
          <span class="truncate whitespace-nowrap font-medium text-gray-800"
            >{drawing.label}</span
          >
        </div>
        <div
          class="text-label-01-normal-regular {status.isComplete
            ? 'text-blue-500'
            : 'text-gray-400'}"
        >
          {status.text}
        </div>
      </div>
    </button>
  {/each}
</ScrollStrip>
