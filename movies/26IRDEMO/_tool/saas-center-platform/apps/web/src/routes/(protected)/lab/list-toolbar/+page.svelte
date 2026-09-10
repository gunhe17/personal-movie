<script lang="ts">
  import { fade } from 'svelte/transition'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import Typography from '@common/components/Typography.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import Select from '$lib/components/Select.svelte'
  import ListGridToggleButton from '$lib/components/ListGridToggleButton.svelte'

  // ── 목업 상태 (시안 비교용) ──
  let search = $state('')
  let sort = $state('desc')
  const total = 128
  const sortOptions = [
    { value: 'desc', title: '최신순' },
    { value: 'asc', title: '오래된순' }
  ]
  let viewCur = $state<'list' | 'grid'>('list')
  let viewA = $state<'list' | 'grid'>('list')
  let viewB = $state<'list' | 'grid'>('list')
  let viewC = $state<'list' | 'grid'>('list')
</script>

<!-- 공용 조각 (실제 컴포넌트 스타일 그대로) -->
{#snippet searchBox(width: string)}
  <div
    class="flex h-11 {width} items-center gap-2 rounded-lg border border-gray-200 bg-white px-4"
  >
    <SearchIcon />
    <input
      type="text"
      bind:value={search}
      placeholder="내담자 이름을 입력해주세요"
      class="text-body-01-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
    />
  </div>
{/snippet}

{#snippet sortSelect()}
  <Select
    class="rounded-lg border border-gray-200 bg-white"
    options={sortOptions}
    selected={sort}
    on:change={(e) => (sort = e.detail.value)}
  />
{/snippet}

{#snippet resetBtn()}
  <FilterResetButton />
{/snippet}

{#snippet countLabel()}
  <Typography variant="body-01-normal-regular" color="text-gray-700">
    총 {total}건
  </Typography>
{/snippet}

{#snippet divider()}
  <div class="h-6 w-px shrink-0 bg-gray-200"></div>
{/snippet}

{#snippet listPlaceholder()}
  <div
    class="mt-3 flex h-20 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 text-label-01-normal-regular text-gray-300"
  >
    리스트 / 카드 영역
  </div>
{/snippet}

<div
  in:fade
  class="flex h-full w-full flex-col overflow-y-auto bg-gray-50 pb-12"
>
  <!-- 헤더 -->
  <div class="mb-6 shrink-0">
    <Typography variant="headline-01-normal-semibold" color="text-gray-900">
      리스트 상단 툴바 — Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-2 block"
    >
      "검색 필터"와 "총 N건 + 리스트/카드 토글"이 2행으로 분리돼 애매하다는
      피드백을 반영한 시안이에요. 한 행으로 합치되 그룹(필터 묶음 ↔ 결과 메타
      묶음)을 명확히 구분했습니다. 정식 반영 전 비교용.
    </Typography>
  </div>

  <div class="flex flex-col gap-5">
    <!-- 현재 (2행) -->
    <section class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="mb-4 text-label-01-normal-medium text-gray-400">
        현재 · 2행 분리 (기준: 청구 내역)
      </p>
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        {@render searchBox('w-75')}
        <div class="flex items-center gap-3">
          {@render resetBtn()}
          {@render divider()}
          {@render sortSelect()}
        </div>
      </div>
      <div class="flex h-11 items-center justify-between">
        {@render countLabel()}
        <ListGridToggleButton
          viewType={viewCur}
          onViewChange={(v) => (viewCur = v)}
        />
      </div>
      {@render listPlaceholder()}
    </section>

    <!-- 안 A -->
    <section class="rounded-2xl border border-primary-200 bg-white p-6">
      <p class="mb-1 text-label-01-normal-medium text-primary-500">
        안 A · 필터(좌) ⟷ 결과 메타(우)
      </p>
      <p class="mb-4 text-label-02-normal-regular text-gray-400">
        입력 컨트롤(검색·정렬·초기화)은 왼쪽에 묶고, 결과 정보(총 N건·뷰 토글)는
        오른쪽에 묶어 justify-between. 가장 일반적이고 안정적.
      </p>
      <div class="flex h-11 items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-2">
          {@render searchBox('w-75')}
          {@render sortSelect()}
          {@render resetBtn()}
        </div>
        <div class="flex shrink-0 items-center gap-3">
          {@render countLabel()}
          {@render divider()}
          <ListGridToggleButton
            viewType={viewA}
            onViewChange={(v) => (viewA = v)}
          />
        </div>
      </div>
      {@render listPlaceholder()}
    </section>

    <!-- 안 B -->
    <section class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="mb-1 text-label-01-normal-medium text-gray-500">
        안 B · 총 N건(좌) ⟷ 컨트롤 전체(우)
      </p>
      <p class="mb-4 text-label-02-normal-regular text-gray-400">
        결과 개수를 리스트의 라벨처럼 맨 왼쪽에, 모든 조작(검색·정렬·초기화·뷰
        토글)은 오른쪽에 모음. 개수를 먼저 읽히게 하고 싶을 때.
      </p>
      <div class="flex h-11 items-center justify-between gap-4">
        {@render countLabel()}
        <div class="flex min-w-0 items-center gap-2">
          {@render searchBox('w-75')}
          {@render sortSelect()}
          {@render resetBtn()}
          {@render divider()}
          <ListGridToggleButton
            viewType={viewB}
            onViewChange={(v) => (viewB = v)}
          />
        </div>
      </div>
      {@render listPlaceholder()}
    </section>

    <!-- 안 C -->
    <section class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="mb-1 text-label-01-normal-medium text-gray-500">
        안 C · 총 N건 · 검색(가변폭) · 컨트롤
      </p>
      <p class="mb-4 text-label-02-normal-regular text-gray-400">
        개수 → 검색창이 남는 폭을 모두 채움(flex-1) → 정렬·초기화·뷰 토글. 넓은
        화면에서 검색 영역을 시원하게 쓰고 싶을 때.
      </p>
      <div class="flex h-11 items-center gap-3">
        <div class="shrink-0">{@render countLabel()}</div>
        {@render divider()}
        <div class="min-w-0 flex-1">{@render searchBox('w-full')}</div>
        {@render sortSelect()}
        {@render resetBtn()}
        {@render divider()}
        <ListGridToggleButton
          viewType={viewC}
          onViewChange={(v) => (viewC = v)}
        />
      </div>
      {@render listPlaceholder()}
    </section>
  </div>
</div>
