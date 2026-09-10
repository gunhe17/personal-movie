<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'

  import { ONTOLOGIES, ORG_TYPES, type OrgType } from './definitions'
  import { MOCK_CLIENTS, type MockClient } from './mock-clients'
  import {
    resolve,
    resolveWithSuffix,
    fieldLabel,
    groupByAxis
  } from './resolve'

  /* ── 상태: 기관 타입과 선택된 대상자뿐 ── */
  let orgType = $state<OrgType>('counseling_center')
  let selectedId = $state<string | null>(null)
  let showDefinition = $state(false)

  /* ── 정의 패널 — 전체 정의를 섹션별로 본다 ── */
  type DefSectionKey =
    | 'all'
    | 'labels'
    | 'capabilities'
    | 'client'
    | 'member'
    | 'center'
    | 'relations'
  let defSection = $state<DefSectionKey>('all')

  const DEF_SECTIONS: { key: DefSectionKey; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'labels', label: '라벨' },
    { key: 'capabilities', label: '기능' },
    { key: 'client', label: '대상자' },
    { key: 'member', label: '구성원' },
    { key: 'center', label: '기관' },
    { key: 'relations', label: '관계' }
  ]

  /* ── 파생: 화면이 읽는 건 전부 여기서 나온다 ── */
  const ont = $derived(ONTOLOGIES[orgType])

  /**
   * 선택된 섹션의 값 + 배선 상태.
   * 정의는 있으나 아직 화면에 안 붙은 블록(구성원·기관)을 구분해 표시한다 —
   * "정의가 곧 구현"이라는 오해를 막기 위해.
   */
  const activeSection = $derived.by(
    (): {
      value: unknown
      status: string
      wired: boolean
    } => {
      switch (defSection) {
        case 'labels':
          return {
            value: { labels: ont.labels, status_labels: ont.status_labels },
            status: '이 화면에 배선됨 — 목록 헤더·상태 배지·빈 문구',
            wired: true
          }
        case 'capabilities':
          return {
            value: ont.capabilities,
            status:
              '이 페이지 안에서만 유효 — 실제 사이드바 배선은 아직 없다',
            wired: false
          }
        case 'client':
          return {
            value: ont.entities.client,
            status: '이 화면에 배선됨 — 목록·상세 전부',
            wired: true
          }
        case 'member':
          return {
            value: ont.entities.member,
            status: '미배선 — 정의 형식만 확정 (작업 단위 C)',
            wired: false
          }
        case 'center':
          return {
            value: ont.entities.center,
            status: '미배선 — 정의 형식만 확정 (작업 단위 D)',
            wired: false
          }
        case 'relations':
          return {
            value: ont.relations,
            status: '이 화면에 배선됨 — 상세 보호자 블록',
            wired: true
          }
        default:
          return { value: ont, status: '', wired: true }
      }
    }
  )
  const groups = $derived(groupByAxis(MOCK_CLIENTS, ont))
  const selected = $derived(
    MOCK_CLIENTS.find((c) => c.id === selectedId) ?? null
  )

  /* 상태 배지 색 — 코드로 판정하고 라벨만 온톨로지에서 (§12-7) */
  const STATUS_COLOR = {
    active: 'green',
    inactive: 'gray',
    archived: 'gray'
  } as const

  function pick(row: MockClient) {
    selectedId = selectedId === row.id ? null : row.id
  }

  /** 기관을 바꾸면 열려있던 상세는 닫는다 (축이 달라져 맥락이 끊기므로) */
  function switchOrg(next: OrgType) {
    orgType = next
    selectedId = null
  }
</script>

<div in:fade class="flex h-full flex-col">
  <!-- 헤더 -->
  <div class="mb-4 shrink-0">
    <Typography variant="headline-01-normal-bold" color="text-gray-900">
      온톨로지 프로토타입
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-1 block"
    >
      같은 데이터 · 같은 컴포넌트. 기관 칩만 바꾸면 화면이 달라진다 — 이 페이지
      코드에 <code class="rounded bg-gray-100 px-1">orgType === '...'</code> 비교는
      없다.
    </Typography>
  </div>

  <!-- 기관 칩 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    {#each ORG_TYPES as type (type)}
      {@const def = ONTOLOGIES[type]}
      {@const on = orgType === type}
      <button
        type="button"
        onclick={() => switchOrg(type)}
        aria-pressed={on}
        class="h-9 rounded-full border px-4 transition-colors {on
          ? 'border-primary-500 bg-primary-50 text-primary-600'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
      >
        <span class="text-body-02-normal-medium">{def.org_label}</span>
      </button>
    {/each}

    <div class="ml-auto flex items-center gap-2">
      <button
        type="button"
        onclick={() => (showDefinition = !showDefinition)}
        class="h-9 rounded-lg border border-gray-200 bg-white px-3 text-gray-600 transition-colors hover:bg-gray-50"
      >
        <span class="text-body-02-normal-medium">
          {showDefinition ? '정의 숨기기' : '정의 보기'}
        </span>
      </button>
    </div>
  </div>


  <!-- 본문 -->
  <div class="flex min-h-0 flex-1 gap-4">
    <!-- 좌: 목록 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="mb-2 flex shrink-0 items-baseline gap-2">
        <Typography variant="title-01-normal-semibold" color="text-gray-900">
          {ont.labels.client} 목록
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-500">
          총 {MOCK_CLIENTS.length}명
        </Typography>
        {#if ont.entities.client.primary_axis}
          <span
            class="ml-1 rounded bg-gray-100 px-2 py-0.5 text-label-02-normal-medium text-gray-500"
          >
            {ont.entities.client.primary_axis.label}
          </span>
        {/if}
      </div>

      <div
        class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white"
      >
        <!-- 컬럼 헤더 — 온톨로지 list_columns를 순회 (§12-2) -->
        <div
          class="sticky top-0 z-10 grid gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5"
          style="grid-template-columns: repeat({ont.entities.client.list_columns
            .length}, minmax(0, 1fr))"
        >
          {#each ont.entities.client.list_columns as col (col)}
            <span class="truncate text-label-01-normal-medium text-gray-600">
              {fieldLabel(col, ont)}
            </span>
          {/each}
        </div>

        {#each groups as group (group.key)}
          {#if ont.entities.client.primary_axis}
            <div class="border-b border-gray-100 bg-gray-50/60 px-4 py-1.5">
              <span class="text-label-02-normal-medium text-gray-500">
                {group.label} · {group.rows.length}명
              </span>
            </div>
          {/if}

          {#each group.rows as row (row.id)}
            <button
              type="button"
              onclick={() => pick(row)}
              class="grid w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 {selectedId ===
              row.id
                ? 'bg-primary-50'
                : 'hover:bg-gray-50'}"
              style="grid-template-columns: repeat({ont.entities.client
                .list_columns.length}, minmax(0, 1fr))"
            >
              {#each ont.entities.client.list_columns as col (col)}
                <span class="min-w-0 truncate">
                  {#if col === 'name'}
                    <span class="text-body-02-normal-medium text-gray-900"
                      >{row.name}</span
                    >
                    <span
                      class="ml-1 text-label-02-normal-regular text-gray-400"
                    >
                      ({row.code})
                    </span>
                  {:else if col === 'status'}
                    <BadgeRectangle
                      label={ont.status_labels[row.status]}
                      color={STATUS_COLOR[row.status]}
                      size="sm"
                    />
                  {:else if col === 'voucher'}
                    {#if row.voucher}
                      <span class="text-body-03-normal-regular text-gray-700">
                        잔여 {row.voucher.remaining}회
                      </span>
                    {:else}
                      <span class="text-body-03-normal-regular text-gray-400"
                        >-</span
                      >
                    {/if}
                  {:else}
                    <span class="text-body-03-normal-regular text-gray-700">
                      {resolveWithSuffix(row, col, ont)}
                    </span>
                  {/if}
                </span>
              {/each}
            </button>
          {/each}
        {/each}
      </div>
    </div>

    <!-- 우: 상세 -->
    <div class="flex w-95 shrink-0 flex-col">
      {#if selected}
        {@const row = selected}
        <div
          in:fly={{ x: 12, duration: 160 }}
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white p-5"
        >
          <!-- 아바타 · 이름 · subline -->
          <div class="flex flex-col items-center gap-3">
            <div
              class="flex h-20 w-20 items-center justify-center rounded-full {row.gender ===
              'MALE'
                ? 'bg-primary-50 text-primary-500'
                : 'bg-red-50 text-red-500'}"
            >
              <span class="text-headline-02-normal-bold"
                >{row.name.charAt(0)}</span
              >
            </div>
            <div class="flex flex-col items-center gap-1">
              <div class="flex items-baseline gap-1.5">
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-gray-900"
                >
                  {row.name}
                </Typography>
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                >
                  ({row.code})
                </Typography>
              </div>
              <!-- subline — 온톨로지가 지정한 필드 (§12-4) -->
              <div class="flex items-center gap-2">
                {#each ont.entities.client.subline as key, i (key)}
                  {#if i > 0}
                    <span class="h-3 w-px bg-gray-300"></span>
                  {/if}
                  <span class="text-body-02-normal-regular text-gray-600">
                    {resolveWithSuffix(row, key, ont)}
                  </span>
                {/each}
              </div>
            </div>
          </div>

          <!-- 기관 고유 정보 블록 — 학적/복무/진료 (§9-3) -->
          {#if ont.entities.client.info_block.fields.length > 0}
            <div class="mt-5 rounded-xl bg-gray-50 p-3">
              <span class="block text-label-01-normal-medium text-gray-500">
                {ont.entities.client.info_block.label}
              </span>
              <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
                {#each ont.entities.client.info_block.fields as key (key)}
                  <dt class="text-body-03-normal-regular text-gray-500">
                    {fieldLabel(key, ont)}
                  </dt>
                  <dd class="text-body-03-normal-regular text-gray-900">
                    {resolveWithSuffix(row, key, ont)}
                  </dd>
                {/each}
              </dl>
            </div>
          {/if}

          <!-- 연락 정보 -->
          <div class="mt-5 border-t border-gray-100 pt-5">
            <dl class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
              {#each ['phone', 'email', 'address'] as key (key)}
                <dt class="text-body-03-normal-regular text-gray-600">
                  {fieldLabel(key, ont)}
                </dt>
                <dd
                  class="min-w-0 break-all text-body-03-normal-regular text-gray-900"
                >
                  {resolve(row, key)}
                </dd>
              {/each}
            </dl>
          </div>

          <!-- 보호자 — capability 플래그 하나로 켜고 끈다 (§12-3) -->
          {#if ont.capabilities.guardian}
            <div class="mt-5 border-t border-gray-100 pt-5">
              <span class="block text-label-01-normal-medium text-gray-500">
                {ont.relations.guardian.label}
              </span>
              {#if row.guardians.length > 0}
                <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  {#each row.guardians as g (g.name)}
                    <span class="text-body-03-normal-regular text-gray-900">
                      {g.name}<span class="text-gray-500">({g.kind})</span>
                    </span>
                  {/each}
                </div>
              {:else}
                <span
                  class="mt-2 block text-body-03-normal-regular text-gray-400"
                >
                  등록된 {ont.relations.guardian.label}가 없어요.
                </span>
              {/if}
            </div>
          {/if}

          <!-- 바우처 — capability 플래그로 켜고 끈다 (§12-3) -->
          {#if ont.capabilities.voucher}
            <div class="mt-5 border-t border-gray-100 pt-5">
              <span class="block text-label-01-normal-medium text-gray-500">
                {ont.labels.voucher}
              </span>
              {#if row.voucher}
                <div
                  class="mt-2 flex items-center gap-2 rounded-xl bg-gray-50 p-3"
                >
                  <span
                    class="min-w-0 flex-1 truncate text-body-03-normal-medium text-gray-900"
                  >
                    {row.voucher.name}
                  </span>
                  <span
                    class="shrink-0 text-body-03-normal-regular text-gray-700"
                  >
                    {row.voucher.total - row.voucher.remaining}/{row.voucher
                      .total}
                  </span>
                </div>
              {:else}
                <span
                  class="mt-2 block text-body-03-normal-regular text-gray-400"
                >
                  연결된 {ont.labels.voucher}가 없어요.
                </span>
              {/if}
            </div>
          {/if}

          <!-- 진행현황 — 타일 수가 배열 길이에서 파생 (§11-2) -->
          <div class="mt-5 border-t border-gray-100 pt-5">
            <span class="block text-label-01-normal-medium text-gray-500"
              >진행 현황</span
            >
            <div
              class="mt-2 grid gap-2"
              style="grid-template-columns: repeat({ont.entities.client
                .progress_items.length}, minmax(0, 1fr))"
            >
              {#each ont.entities.client.progress_items as item (item.key)}
                <div class="rounded-xl bg-gray-50 p-3 text-center">
                  <span
                    class="block text-label-02-normal-regular text-gray-500"
                  >
                    {item.label}
                  </span>
                  <span
                    class="mt-0.5 block text-title-01-normal-semibold text-gray-900"
                  >
                    {row.progress[item.key] ?? 0}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <div
          class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white"
        >
          <Typography variant="body-02-normal-regular" color="text-gray-400">
            {ont.labels.client}를 선택하면 상세가 열려요.
          </Typography>
        </div>
      {/if}
    </div>

    <!-- 정의 패널 — 전체 정의를 섹션별로 -->
    {#if showDefinition}
      <div
        in:fly={{ x: 12, duration: 160 }}
        class="flex w-105 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-900"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-700 px-4 py-2.5"
        >
          <span class="text-label-01-normal-medium text-gray-300">
            온톨로지 정의 — {ont.org_label}
          </span>
          <span class="text-label-02-normal-regular text-gray-500">
            GET /ontology/{ont.org_type}
          </span>
        </div>

        <!-- 섹션 탭 -->
        <div class="flex shrink-0 gap-1 border-b border-gray-700 px-2 py-2">
          {#each DEF_SECTIONS as sec (sec.key)}
            {@const on = defSection === sec.key}
            <button
              type="button"
              onclick={() => (defSection = sec.key)}
              aria-pressed={on}
              class="rounded px-2 py-1 text-label-02-normal-medium transition-colors {on
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}"
            >
              {sec.label}
            </button>
          {/each}
        </div>

        <!-- 배선 상태 고지 — 정의는 있으나 화면에 안 붙은 블록 구분 -->
        {#if activeSection.status}
          <div
            class="shrink-0 border-b border-gray-700 bg-gray-800 px-4 py-2 text-label-02-normal-regular {activeSection.wired
              ? 'text-green-400'
              : 'text-amber-400'}"
          >
            {activeSection.status}
          </div>
        {/if}

        <pre
          class="min-h-0 flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-gray-300"><code
            >{JSON.stringify(activeSection.value, null, 2)}</code
          ></pre>
      </div>
    {/if}
  </div>
</div>
