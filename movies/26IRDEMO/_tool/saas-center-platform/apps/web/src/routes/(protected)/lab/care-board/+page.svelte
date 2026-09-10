<script lang="ts">
  // ============================================================
  // 케어보드 — Lab (v3: 우측 도크 · 채팅형 스트림)
  // ============================================================
  //
  // 진입 버튼·도크 자체는 공용 컴포넌트가 소유한다
  // (정본: `lib/components/care-board/CareBoardDock.svelte` — 상담 상세에도 같은 걸 쓴다).
  // 이 랩이 남기는 건 그 컴포넌트만으로는 확인할 수 없는 **주변 동작** 두 가지다:
  //
  //   ① 셸 도크 흉내 — 도크가 먹은 폭을 뺀 **유효 폭**으로 좁은화면 판정을 다시 한다.
  //      앱의 responsive는 window.innerWidth만 보므로 셸이 줄어도 페이지는 자기가
  //      넓은 줄 알고 460 컬럼을 유지하다 우측이 짜부라진다. 정식 반영 시엔 이 계산이
  //      셸(+layout.svelte)과 responsive 스토어로 올라가야 하고, 그때부터는 페이지가
  //      손 안 대도 따라온다. (전역 파일은 아직 건드리지 않았다)
  //   ② 좁은화면 진입점 — `내담자 정보` 버튼이 여는 기존 panelStore 패널(우측 460 + 딤)이
  //      도크를 완전히 덮는다. 수용 가능한지 눈으로 판단하려고 그대로 재현해 둔다.
  //
  // 배치 계보: 탭 위 고정 영역(v1) → 우측 오버레이(v2) → 우측 도크(v3).
  //   덮기를 버린 이유 — 탭의 CTA(문서 `파일 추가`·바우처 등록)가 카드 우측 끝에
  //   justify-between으로 붙어 있어 400 오버레이가 정확히 그 자리를 가린다.
  //   클릭은 되는데 보이지 않는 상태라 조회형이어도 성립하지 않는다.

  import { fade, fly } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import CareBoardDock from '$lib/components/care-board/CareBoardDock.svelte'
  import { responsive, BREAKPOINTS } from '$lib/stores/responsive.svelte'

  let panelOpen = $state(false)

  // ── 유효 폭 판정 (셸 도크의 랩 흉내) ──
  // 1600에서 열면 1200 → xl(1280) 미만 → 좁은화면 레이아웃(프로필 접힘)
  // 1920에서 열면 1520 → 데스크탑 유지 → 프로필 그대로
  const DOCK_WIDTH = 400
  const effectiveWidth = $derived(
    responsive.width - (panelOpen ? DOCK_WIDTH : 0)
  )
  const isNarrow = $derived(effectiveWidth < BREAKPOINTS.xl)

  /** 좁은화면에서 프로필을 여는 임시 패널 (실제로는 panelStore + ProfileSectionPanel) */
  let profilePanelOpen = $state(false)

  // ── 하단 탭 (기존 내담자 상세 탭 — 자리만 재현) ──
  const TABS = [
    { value: 'history', label: '진행 현황' },
    { value: 'documents', label: '문서' },
    { value: 'vouchers', label: '바우처' }
  ]
  let activeTab = $state('history')

  const PROFILE_ROWS: [string, string][] = [
    ['보호자', '이수진 (모)'],
    ['연락처', '010-1234-5678'],
    ['주소', '서울 마포구 …'],
    ['등록일', '2026. 07. 10']
  ]
</script>

{#snippet chevron(rotate = '')}
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class={rotate}>
    <path
      d="M7.5 4.5 13 10l-5.5 5.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#snippet profileBody()}
  <div class="flex items-center gap-4">
    <ClientAvatar
      name="김민준"
      gender="male"
      sizeClass="h-16 w-16"
      textClass="text-[24px]"
    />
    <div class="flex min-w-0 flex-col gap-2">
      <Typography variant="headline-01-normal-semibold" color="text-title-default"
        >김민준</Typography
      >
      <Typography variant="body-02-normal-regular" color="text-body-default">
        2015. 03. 12 · 남
      </Typography>
    </div>
  </div>

  <hr class="my-7 border-0 border-t border-border-default" />

  <div class="flex h-6 items-center">
    <Typography variant="title-01-normal-semibold" color="text-title-default"
      >기본 정보</Typography
    >
  </div>
  <div class="mt-4 grid grid-cols-[76px_1fr] items-center gap-x-6 gap-y-3">
    {#each PROFILE_ROWS as [label, value]}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-600"
        className="whitespace-nowrap">{label}</Typography
      >
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-900"
        className="truncate-safe">{value}</Typography
      >
    {/each}
  </div>
{/snippet}

<!-- 도크가 먹은 폭을 본문에서 뺀다 — 셸 main이 줄어드는 것과 같은 결과가 된다.
     360 = 도크 400 − 40. 셸 우측 패딩 80이 이미 있으므로 콘텐츠 ↔ 도크 간격이 40이 된다.
     콘텐츠↔GNB는 80, 콘텐츠↔도크는 40 — 영구 크롬과 열려 있는 도크를 다른 값으로 가른다
     (Web_Design.md §Spacing > 컨테이너 패딩). 닫히면 우측 마진은 80으로 돌아온다. -->
<div
  in:fade
  class="flex flex-col bg-gray-50 transition-[padding] duration-200 xl:h-full xl:min-h-0 {panelOpen
    ? 'pr-[360px]'
    : ''}"
>
  <nav class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="rounded-lg p-1"><ArrowBackIcon /></span>
      <Typography
        variant="body-02-normal-regular"
        tag="span"
        color="text-body-subtle">내담자</Typography
      >
      <Typography variant="body-02-normal-regular" tag="span" color="text-gray-300"
        >/</Typography
      >
      <Typography
        variant="body-02-normal-medium"
        tag="span"
        color="text-body-default">김민준</Typography
      >
    </div>
    <!-- 유효 폭이 좁아지면 프로필이 접히고, 기존 상세와 같은 진입 버튼이 선다 -->
    {#if isNarrow}
      <button
        type="button"
        onclick={() => (profilePanelOpen = true)}
        class="flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50"
      >
        <Typography variant="body-02-normal-medium" color="text-gray-700"
          >내담자 정보</Typography
        >
      </button>
    {/if}
  </nav>

  <!-- 도크가 열리면 좌측도 400 → 360으로 한 단계 줄인다 — 우측만 줄면 좌측 비중이
       27%→36%로 뛰어 상대적으로 넓어 보인다 -->
  <div
    class="grid gap-4 transition-[grid-template-columns] duration-200 xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)] {isNarrow
      ? 'grid-cols-1'
      : panelOpen
        ? 'grid-cols-1 xl:grid-cols-[360px_1fr]'
        : 'grid-cols-1 xl:grid-cols-[400px_1fr]'}"
  >
    <!-- 좌측 프로필 (맥락용 축약 재현) -->
    <section
      class:hidden={isNarrow}
      class="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 xl:min-h-0"
    >
      {@render profileBody()}
    </section>

    <!-- 우측 탭 패널 -->
    <section
      class="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 pt-3 xl:min-h-0"
    >
      <TabBar tabs={TABS} bind:activeTab tabClass="xl:w-[140px] xl:px-0" />
      <div class="flex flex-1 items-center justify-center pt-5">
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          기존 {TABS.find((t) => t.value === activeTab)?.label} 탭 콘텐츠 자리
        </Typography>
      </div>
    </section>
  </div>
</div>

<!-- 진입 버튼 + 도크는 공용 컴포넌트가 소유한다 — 랩과 실제 화면이 갈라지지 않도록
     여기서 다시 구현하지 않는다 -->
<CareBoardDock clientId="" clientName="김민준" bind:open={panelOpen} />

<!-- ─────────── 내담자 정보 패널 (좁은화면 진입점 · 실제로는 panelStore) ───────────
     기존 상세와 동일하게 딤 + 우측 460 패널이다. 케어보드 도크 위에 겹쳐 뜨는데,
     프로필을 확인하는 짧은 순간뿐이라 수용 가능한지 여기서 판단한다. -->
{#if profilePanelOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 bg-black/30"
    onclick={() => (profilePanelOpen = false)}
  ></div>
  <aside
    transition:fly={{ x: 460, duration: 250 }}
    class="fixed top-0 right-0 z-50 flex h-full w-[460px] flex-col bg-white"
  >
    <header
      class="flex h-[62px] shrink-0 items-center justify-between border-b border-border-default px-6"
    >
      <Typography variant="title-01-normal-semibold" color="text-title-default"
        >내담자 정보</Typography
      >
      <button
        type="button"
        aria-label="닫기"
        onclick={() => (profilePanelOpen = false)}
        class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        {@render chevron()}
      </button>
    </header>
    <div class="flex-1 overflow-y-auto p-6">
      {@render profileBody()}
    </div>
  </aside>
{/if}
