<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type {
    AssessmentItem,
    AssessmentVisual
  } from '$lib/features/assessment/status-detail/types'
  import AssessmentGridCard from './AssessmentGridCard.svelte'

  let {
    assessments,
    setName = '',
    visualMap = {},
    onSelect
  } = $props<{
    assessments: AssessmentItem[]
    setName?: string
    visualMap?: Record<string, AssessmentVisual>
    onSelect: (assessment: AssessmentItem) => void
  }>()

  const setItems = $derived(
    assessments.filter((a: AssessmentItem) => a.belongsToSet)
  )
  const extraItems = $derived(
    assessments.filter((a: AssessmentItem) => !a.belongsToSet)
  )
  // 세트명이 있고 세트 검사가 하나라도 있을 때만 그룹 분리
  const hasSetGroup = $derived(!!setName && setItems.length > 0)
</script>

{#snippet groupHeader(title: string, count: number)}
  <div class="mb-3 flex items-center gap-2">
    <Typography variant="body-01-semibold" tag="span" color="text-gray-800">
      {title}
    </Typography>
    <Typography variant="body-01-medium" tag="span" color="text-primary-400">
      {count}
    </Typography>
  </div>
{/snippet}

{#snippet cardGrid(items: AssessmentItem[])}
  <!-- 한 줄 3개 고정 (검사 관리는 5개지만 여기는 패널 폭이 좁다). gap 16은 동일 -->
  <div class="grid grid-cols-3 gap-4">
    {#each items as assessment (assessment.id)}
      <AssessmentGridCard
        {assessment}
        visual={visualMap[assessment.assessmentId]}
        {onSelect}
      />
    {/each}
  </div>
{/snippet}

<div class="flex flex-col gap-8">
  {#if hasSetGroup}
    <section>
      {@render groupHeader(setName, setItems.length)}
      {@render cardGrid(setItems)}
    </section>
    {#if extraItems.length > 0}
      <section>
        {@render groupHeader('추가 검사', extraItems.length)}
        {@render cardGrid(extraItems)}
      </section>
    {/if}
  {:else}
    <!-- 세트 구분이 없으면 단일 그룹.
         세트명을 대신할 머리가 없으므로 전체 카운트를 얹는다 —
         상담 상세 우측 패널('총 N개의 회기가 있어요')과 동일 규격:
         body-01-normal-medium · text-body-default. 아래 간격은 16 —
         카드가 그리드로 넓게 펼쳐져 12로는 카운트가 첫 행에 붙어 보인다 -->
    <section>
      <Typography
        variant="body-01-normal-medium"
        color="text-body-default"
        className="mb-4 block"
      >
        총 {assessments.length}개의 검사가 있어요
      </Typography>
      {@render cardGrid(assessments)}
    </section>
  {/if}
</div>
