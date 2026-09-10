<script lang="ts">
  import { fade } from 'svelte/transition'
  import ConceptA from './ConceptA.svelte'
  import ConceptB from './ConceptB.svelte'
  import ConceptC from './ConceptC.svelte'

  let active = $state<'A' | 'B' | 'C'>('A')

  const concepts = [
    { key: 'A' as const, label: 'A — 대시보드형', desc: 'KPI 카드 2개 → 추이 차트 → 2열 테이블' },
    { key: 'B' as const, label: 'B — 분석형',     desc: '4지표 수평 스트립 → 차트+비중 → 전체 테이블' },
    { key: 'C' as const, label: 'C — 운영형',     desc: '경고 배너 → 인라인 지표 → 차트+패널 → 2열 테이블' },
  ]
</script>

<div in:fade class="p-6">
  <!-- 시안 전환 탭 -->
  <div class="mb-6 flex items-center gap-3">
    <span class="text-label-01-normal-medium text-gray-400">디자인 시안</span>
    <div class="flex rounded-lg border border-gray-200 bg-white p-0.5">
      {#each concepts as c}
        <button
          class="rounded-md px-4 py-1.5 transition-all duration-150
            {active === c.key
              ? 'bg-primary-600 text-white shadow-sm text-body-03-normal-semibold'
              : 'text-body-03-normal-medium text-gray-500 hover:text-gray-700'}"
          onclick={() => (active = c.key)}
        >
          {c.label}
        </button>
      {/each}
    </div>
    <span class="text-label-01-normal-regular text-gray-400">
      {concepts.find((c) => c.key === active)?.desc}
    </span>
  </div>

  <!-- 시안 렌더 -->
  {#if active === 'A'}
    <ConceptA />
  {:else if active === 'B'}
    <ConceptB />
  {:else}
    <ConceptC />
  {/if}
</div>
