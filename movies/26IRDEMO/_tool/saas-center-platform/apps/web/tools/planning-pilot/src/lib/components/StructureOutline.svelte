<script lang="ts">
  import { untrack } from 'svelte'
  import type { Plan, Selection } from '$lib/types'
  import type { ContentReview } from '$lib/content-review'
  import {
    reviewItems,
    reviewStatus,
    reviewStatusLabels
  } from '$lib/content-review'
  import {
    featureStructure,
    scenarioDetails,
    structureLocation,
    featureLabel
  } from '$lib/structure-outline'
  import { scopeLabels } from '$lib/types'
  import '$lib/structure-outline.css'
  let {
    plan,
    selection,
    reviews,
    selectedKey,
    navigation,
    inspectorId,
    disabled = false,
    onSelect,
    onBrowse,
    onPrepare
  }: {
    plan: Plan
    selection: Selection
    reviews: ContentReview[]
    selectedKey: string
    navigation: { key: string } | null
    inspectorId: string
    disabled?: boolean
    onSelect: (key: string) => void
    onBrowse: () => void
    onPrepare: () => void
  } = $props()
  let featureId = $state(''),
    scenarioId = $state(''),
    exceptionId = $state('')
  let showExceptions = $state(false),
    showCases = $state(false)
  const items = $derived(reviewItems(plan, selection))
  const feature = $derived(plan.features.find((f) => f.id === featureId))
  const branch = $derived(feature ? featureStructure(plan, feature.id) : null)
  const scenario = $derived(plan.scenarios?.find((s) => s.id === scenarioId))
  const detail = $derived(scenario ? scenarioDetails(plan, scenario) : null)
  const orphanRequirements = $derived(
    (plan.audit?.requirements ?? []).filter((r) => !r.featureIds.length)
  )
  const orphanScenarios = $derived(
    (plan.scenarios ?? []).filter(
      (s) =>
        !plan.features.some((f) => {
          const group = featureStructure(plan, f.id)
          return (
            group.normals.some(
              (n) => n.id === (s.branch?.scenarioId ?? s.id)
            ) || group.standalone.some((n) => n.id === s.id)
          )
        })
    )
  )
  function statusFor(key: string) {
    const item = items.find((i) => i.key === key)
    return item ? reviewStatus(item, reviews) : 'new'
  }
  $effect(() => {
    const location = structureLocation(
      plan,
      navigation?.key ?? '',
      untrack(() => featureId)
    )
    if (location) {
      featureId = location.featureId
      scenarioId = location.scenarioId
      exceptionId = location.exceptionId
      showExceptions = !!location.exceptionId
      showCases = navigation?.key.startsWith('case/') ?? false
    }
  })
  function browseFeature(id: string) {
    featureId = id
    scenarioId = ''
    exceptionId = ''
    showExceptions = false
    showCases = false
    onBrowse()
  }
  function browseScenario(id: string) {
    scenarioId = id
    exceptionId = ''
    showExceptions = false
    showCases = false
    onBrowse()
  }
  function overview() {
    featureId = ''
    scenarioId = ''
    exceptionId = ''
    onBrowse()
  }
</script>

<section class="structure-outline" aria-label="기능별 기획 구조">
  <nav class="outline-breadcrumb" aria-label="현재 구조 위치">
    <button onclick={overview}>전체 기능</button>{#if feature}<span
        aria-hidden="true">›</span
      ><button onclick={() => browseFeature(feature.id)}
        >{featureLabel(plan, feature.id)}</button
      >{/if}{#if scenario}<span aria-hidden="true">›</span><span
        >{scenario.title}</span
      >{/if}
  </nav>
  {#if !feature}
    <div class="outline-intro">
      <span class="outline-kicker">1 · 기능 선택</span>
      <h2>어떤 부분을 살펴볼까요?</h2>
      <p>
        기능을 고르면 연결된 흐름을 보여줘요. 예외는 흐름 안에서 펼쳐 볼 수
        있어요.
      </p>
    </div>
    <div class="outline-features">
      {#each plan.features as entry, index}
        {@const group = featureStructure(plan, entry.id)}
        {@const choice =
          selection.items.find((i) => i.id === entry.id)?.choice ?? 'undecided'}
        <button
          class="outline-feature"
          {disabled}
          onclick={() => browseFeature(entry.id)}
          ><span class="outline-number"
            >{String(index + 1).padStart(2, '0')}</span
          >
          <h3>{featureLabel(plan, entry.id)}</h3>
          <p>{entry.title}</p>
          <div>
            <span>{scopeLabels[choice]}</span><span
              >{group.normals.length}개 흐름 →</span
            >
          </div></button
        >
      {/each}
    </div>
    {#if !plan.features.length}<div class="outline-empty">
        <p>아직 기능이 정리되지 않았어요.</p>
        <button {disabled} onclick={onPrepare}>기능 정리 요청</button>
      </div>{/if}
    <button
      class="outline-text-button"
      {disabled}
      class:inspecting={selectedKey === 'overview/' + plan.id}
      aria-pressed={selectedKey === 'overview/' + plan.id}
      aria-controls={inspectorId}
      onclick={() => onSelect('overview/' + plan.id)}>기획 개요 검토 ↗</button
    >
  {:else}
    {#if !scenario}<div class="outline-focus-header">
        <div>
          <span class="outline-kicker">2 · 흐름 선택</span>
          <h2>{featureLabel(plan, feature.id)}</h2>
          <p>{feature.title}</p>
        </div>
        <button
          {disabled}
          class:inspecting={selectedKey === 'feature/' + feature.id}
          aria-pressed={selectedKey === 'feature/' + feature.id}
          aria-controls={inspectorId}
          onclick={() => onSelect('feature/' + feature.id)}
          >기능 내용 검토 ↗</button
        >
      </div>{/if}
    {#if !scenario}
      <h3 class="outline-section-title">
        이 기능이 쓰이는 흐름 <span>{branch?.normals.length ?? 0}</span>
      </h3>
      <div class="outline-paths">
        {#each branch?.normals ?? [] as path}
          {@const counts = scenarioDetails(plan, path)}
          <button {disabled} onclick={() => browseScenario(path.id)}
            ><span class="outline-path-icon">→</span>
            <div>
              <strong>{path.title}</strong><small
                >{path.steps.length}단계 · 예외 경로 {counts.exceptions
                  .length}개</small
              >
            </div>
            <span>열기 ›</span></button
          >
        {/each}
      </div>
      {#if !branch?.normals.length}<p class="outline-empty">
          연결된 정상 흐름이 아직 없어요. 기획 보완이 필요해요.
        </p>{/if}
      {#if branch?.standalone.length}<details class="outline-fold">
          <summary>별도로 시작하는 예외 {branch.standalone.length}개</summary
          >{#each branch.standalone as path}<button
              class="outline-row"
              {disabled}
              onclick={() => browseScenario(path.id)}
              >{path.title}<span>열기 ›</span></button
            >{/each}
        </details>{/if}
      <details class="outline-fold">
        <summary
          >이 기능의 요구사항 {branch?.requirements.length ?? 0}개</summary
        >{#each branch?.requirements ?? [] as requirement}<button
            class="outline-row"
            {disabled}
            class:inspecting={selectedKey === 'requirement/' + requirement.id}
            aria-pressed={selectedKey === 'requirement/' + requirement.id}
            aria-controls={inspectorId}
            onclick={() => onSelect('requirement/' + requirement.id)}
            >{requirement.text}<span>검토 ↗</span></button
          >{:else}<p>연결된 요구사항이 아직 없어요.</p>{/each}
      </details>
    {:else}
      <div class="outline-scenario-heading">
        <div>
          <span class="outline-kind"
            >{scenario.kind === 'normal' ? '정상 흐름' : '별도 예외 흐름'}</span
          >
          <h3>{scenario.title}</h3>
        </div>
        <button
          {disabled}
          class:inspecting={selectedKey === 'scenario/' + scenario.id}
          aria-pressed={selectedKey === 'scenario/' + scenario.id}
          aria-controls={inspectorId}
          onclick={() => onSelect('scenario/' + scenario.id)}
          >흐름 내용 검토 ↗</button
        >
      </div>
      <section class="outline-flow-card" aria-label="진행 순서">
        <div class="outline-flow-label">
          <h4>진행 순서</h4>
          <span>{scenario.steps.length}단계</span>
        </div>
        <ol class="outline-steps">
          {#each scenario.steps as step, index}<li>
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
              </div>
            </li>{/each}
        </ol>
        <div class="outline-outcome">
          <span>도착 상태</span>
          <p>{scenario.outcome || '아직 정해지지 않았어요.'}</p>
        </div>
      </section>
      <details class="outline-fold" bind:open={showExceptions}>
        <summary
          >이 흐름에서 갈라지는 예외 <span
            >{detail?.exceptions.length ?? 0}개</span
          ></summary
        >
        {#each detail?.exceptions ?? [] as path}<div class="outline-exception">
            <button
              class="outline-row"
              {disabled}
              aria-expanded={exceptionId === path.id}
              onclick={() =>
                (exceptionId = exceptionId === path.id ? '' : path.id)}
              ><div>
                <strong>{path.title}</strong><small
                  >발생 지점: {scenario.steps.find(
                    (s) => s.id === path.branch?.stepId
                  )?.title ?? '미정'}</small
                >
              </div>
              <span>{exceptionId === path.id ? '−' : '+'}</span></button
            >
            {#if exceptionId === path.id}<div class="outline-exception-body">
                <p>{path.trigger}</p>
                <ol>
                  {#each path.steps as step}<li>{step.title}</li>{/each}
                </ol>
                <p><strong>복구·다음 행동</strong> {path.recovery || '미정'}</p>
                <button
                  {disabled}
                  class:inspecting={selectedKey === 'scenario/' + path.id}
                  aria-pressed={selectedKey === 'scenario/' + path.id}
                  aria-controls={inspectorId}
                  onclick={() => onSelect('scenario/' + path.id)}
                  >예외 내용 검토 ↗</button
                >
                <h4>상세 점검 사례</h4>
                {#each scenarioDetails(plan, path).cases as entry}<button
                    class="outline-case"
                    {disabled}
                    class:inspecting={selectedKey === 'case/' + entry.id}
                    aria-pressed={selectedKey === 'case/' + entry.id}
                    aria-controls={inspectorId}
                    onclick={() => onSelect('case/' + entry.id)}
                    ><span class="outline-case-title"
                      >{entry.title}<small
                        >{selectedKey === 'case/' + entry.id
                          ? '현재 검토 중'
                          : '상세 보기 →'}</small
                      ></span
                    ><span
                      class="review-badge"
                      data-status={statusFor('case/' + entry.id)}
                      >{reviewStatusLabels[statusFor('case/' + entry.id)]}</span
                    ></button
                  >{:else}<p>아직 작성된 상세 사례가 없어요.</p>{/each}
              </div>{/if}
          </div>{:else}<p>
            등록된 예외 경로가 없어요. 예외가 없다는 뜻은 아니에요.
          </p>{/each}
      </details>
      <details class="outline-fold" bind:open={showCases}>
        <summary
          >단계별 상세 점검 사례 <span>{detail?.cases.length ?? 0}개</span
          ></summary
        >
        <p class="outline-hint">사례를 선택하면 상세가 열려요.</p>
        {#each detail?.cases ?? [] as entry}<button
            class="outline-case"
            {disabled}
            class:inspecting={selectedKey === 'case/' + entry.id}
            aria-pressed={selectedKey === 'case/' + entry.id}
            aria-controls={inspectorId}
            onclick={() => onSelect('case/' + entry.id)}
            ><span class="outline-case-title"
              >{entry.title}<small
                >{selectedKey === 'case/' + entry.id
                  ? '현재 검토 중'
                  : '상세 보기 →'}</small
              ></span
            ><span
              class="review-badge"
              data-status={statusFor('case/' + entry.id)}
              >{reviewStatusLabels[statusFor('case/' + entry.id)]}</span
            ></button
          >{:else}<p>아직 작성된 상세 사례가 없어요.</p>{/each}
      </details>
      <p class="outline-footnote">
        이 기능이 참여하는 전체 흐름이에요. 단계별 담당 기능과 상태 변화는
        시나리오 탭에서 확인할 수 있어요.
      </p>
    {/if}
  {/if}
  {#if orphanRequirements.length || orphanScenarios.length}<details
      class="outline-fold outline-unlinked"
    >
      <summary
        >아직 연결되지 않은 항목 <span
          >{orphanRequirements.length + orphanScenarios.length}개</span
        ></summary
      >{#each orphanRequirements as requirement}<button
          class="outline-row"
          {disabled}
          class:inspecting={selectedKey === 'requirement/' + requirement.id}
          aria-pressed={selectedKey === 'requirement/' + requirement.id}
          aria-controls={inspectorId}
          onclick={() => onSelect('requirement/' + requirement.id)}
          ><div><small>요구사항</small>{requirement.text}</div>
          <span>검토 ↗</span></button
        >{/each}{#each orphanScenarios as path}<button
          class="outline-row"
          {disabled}
          class:inspecting={selectedKey === 'scenario/' + path.id}
          aria-pressed={selectedKey === 'scenario/' + path.id}
          aria-controls={inspectorId}
          onclick={() => onSelect('scenario/' + path.id)}
          ><div><small>흐름</small>{path.title}</div>
          <span>검토 ↗</span></button
        >{/each}
    </details>{/if}
</section>
