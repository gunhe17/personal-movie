<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import Typography from '@common/components/Typography.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Email40 from '$lib/assets/Email40.svelte'
  import Phone40 from '$lib/assets/Phone40.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import { createSupportHooks } from '$lib/features/support/hooks.svelte'
  import {
    SLIDE_DURATION,
    FADE_DURATION,
    FAQ_TABS,
    INQUIRY_STATUS_LABEL,
    INQUIRY_STATUS_COLOR
  } from '$lib/features/support/constants'

  const h = createSupportHooks()

  // Pagination 컴포넌트(Svelte 4)와 바인딩하기 위한 래퍼
  let inquiryPageBind = $state(h.myInquiryPage)
  $effect(() => {
    h.setMyInquiryPage(inquiryPageBind)
  })

  const faqTabs = FAQ_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label
  }))

  /* 아코디언 카드 — 문의 내역·FAQ가 같은 컴포넌트이므로 규격을 한 곳에서 소유한다.
     클릭 가능한 리스트 카드 단일 규격(radius 16 · 1px 보더 · hover primary-400 + card-hover) */
  const CARD_BASE =
    'overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-200'
  const CARD_STATE = (expanded: boolean) =>
    expanded
      ? 'border-primary-400 shadow-card-hover'
      : 'border-border-subtle hover:border-primary-400 hover:shadow-card-hover'
</script>

<!-- 하단 32 — 스크롤이 생기는 페이지는 셸 pb-8이 마지막 요소까지 닿지 않아
     루트가 직접 갖는다(선례: settings/subscription · settings/billing) -->
<div in:fade class="pb-8">
  <!-- 타이틀 바로 아래가 콘텐츠 컨테이너(카드 그리드) → 간격 16(mb-4) -->
  <PageTitleSection title="고객센터" className="mb-4" />

  <!-- 연락처 패널 (이메일 / 전화 / 1:1 문의) -->
  <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <!-- 이메일 문의 -->
    <div class="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-card">
      <Email40 />
      <div class="flex flex-col gap-3">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >이메일 문의</Typography
        >
        <Typography variant="body-01-normal-regular" color="text-body-strong"
          >imomtae@insigher.co.kr</Typography
        >
      </div>
    </div>

    <!-- 전화 문의 -->
    <div class="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-card">
      <Phone40 />
      <div class="flex flex-col gap-3">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >전화 문의</Typography
        >
        <Typography variant="body-01-normal-regular" color="text-body-strong">
          1833-5411 (평일 09:00 - 18:00)
        </Typography>
      </div>
    </div>

    <!-- 1:1 문의 -->
    <div
      class="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-card"
    >
      <div class="flex flex-col gap-3">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >1:1 문의</Typography
        >
        <!-- 두 줄은 한 문장이 접힌 것 — 라벨↔본문(12)과 달리 줄 간격(4)을 유지한다 -->
        <div class="flex flex-col gap-1">
          <Typography variant="body-01-normal-regular" color="text-body-strong"
            >문의 내용을 남겨주시면</Typography
          >
          <Typography variant="body-01-normal-regular" color="text-body-strong"
            >확인 후 안내드릴게요</Typography
          >
        </div>
      </div>
      <!-- 보조 액션 → tertiary(gray solid) · Title 사이즈 44 -->
      <button
        type="button"
        onclick={h.service.openInquiryModal}
        class="h-11 shrink-0 rounded-lg bg-gray-100 px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
      >
        문의
      </button>
    </div>
  </div>

  <!-- 내 문의 내역 -->
  {#if h.myInquiries.length > 0}
    <div class="mb-8">
      <!-- 섹션 타이틀 L — 영역 높이 44 · 아래 섹션 콘텐츠와 gap 12(§Spacing) -->
      <div class="mb-3 flex h-11 items-center">
        <Typography variant="headline-02-normal-semibold" tag="h2">
          나의 문의 내역
        </Typography>
      </div>

      <div class="flex flex-col gap-4">
        {#each h.myInquiries as item (item.id)}
          {@const isExpanded = h.expandedMyInquiryId === item.id}
          <div class="{CARD_BASE} {CARD_STATE(isExpanded)}">
            <button
              type="button"
              class="group flex w-full items-center justify-between gap-4 p-5 text-left"
              onclick={() => h.toggleMyInquiry(item.id)}
              aria-expanded={isExpanded}
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <BadgeRectangle
                  label={INQUIRY_STATUS_LABEL[item.status] ?? item.status}
                  color={INQUIRY_STATUS_COLOR[item.status] ?? 'gray'}
                />
                <Typography
                  variant="title-01-normal-semibold"
                  tag="span"
                  color="text-body-strong"
                  className="truncate-safe"
                >
                  {item.subject}
                </Typography>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-default"
                >
                  {new Date(item.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </Typography>
                <span
                  class="flex size-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:bg-bg-base {isExpanded
                    ? 'rotate-180'
                    : ''}"
                  aria-hidden="true"
                >
                  <ArrowDownIcon20 />
                </span>
              </div>
            </button>
            {#if isExpanded}
              <div
                in:slide={{ duration: SLIDE_DURATION, easing: cubicOut }}
                out:slide={{ duration: SLIDE_DURATION, easing: cubicOut }}
              >
                <!-- 카드를 두 영역으로 자르지 않도록 좌우 16 들여쓴 구분선 -->
                <div class="mx-4 h-px bg-border-subtle"></div>
                <div
                  in:fade={{ duration: FADE_DURATION, delay: 60 }}
                  class="flex flex-col gap-4 px-5 py-6"
                >
                  <!-- 라벨 → 값 = 12(§Spacing ① 그룹 내부) -->
                  <div class="flex flex-col gap-3">
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-title-subtitle"
                    >
                      문의 내용
                    </Typography>
                    <p
                      class="text-body-01-reading-regular whitespace-pre-wrap text-gray-800"
                    >
                      {item.content}
                    </p>
                  </div>
                  {#if item.answer}
                    <!-- well — 카드(16) 안쪽이라 radius 8, 서브 블록 패딩 16 -->
                    <div
                      class="flex flex-col gap-2 rounded-lg bg-primary-50 p-4"
                    >
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-primary-700"
                      >
                        답변
                      </Typography>
                      <p
                        class="text-body-01-reading-regular whitespace-pre-wrap text-gray-800"
                      >
                        {item.answer}
                      </p>
                    </div>
                  {:else}
                    <div class="rounded-lg bg-bg-base p-4">
                      <Typography
                        variant="body-01-normal-regular"
                        color="text-caption-subtle"
                      >
                        아직 답변이 등록되지 않았습니다.
                      </Typography>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <Pagination
        totalItems={h.myInquiryTotal}
        itemsPerPage={h.myInquiryPageSize}
        bind:currentPage={inquiryPageBind}
      />
    </div>
  {/if}

  <!-- 자주 묻는 질문 -->
  <!-- 섹션 타이틀 L — 바로 아래가 탭바(자체 여백을 가진 행)라 8 -->
  <div class="mb-2 flex h-11 items-center">
    <Typography variant="headline-02-normal-semibold" tag="h2">
      자주 묻는 질문
    </Typography>
  </div>

  <!-- 카테고리 탭 — 공용 TabBar가 밑줄 탭 규격의 단일 소스 -->
  <TabBar
    tabs={faqTabs}
    activeTab={h.activeTab}
    onTabChange={(tab) =>
      h.setActiveTab(tab as (typeof FAQ_TABS)[number]['value'])}
  />

  <div class="mt-4 flex flex-col gap-4">
    {#each h.faqItems as item (item.id)}
      {@const isExpanded = h.expandedFaqId === item.id}
      <div class="{CARD_BASE} {CARD_STATE(isExpanded)}">
        <button
          type="button"
          class="group flex w-full items-center justify-between gap-4 p-5 text-left"
          onclick={() => h.toggleFaq(item.id)}
          aria-expanded={isExpanded}
        >
          <Typography
            variant="title-02-semibold"
            tag="span"
            color="text-body-strong"
          >
            Q. {item.question}
          </Typography>
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:bg-bg-base {isExpanded
              ? 'rotate-180'
              : ''}"
            aria-hidden="true"
          >
            <ArrowDownIcon20 />
          </span>
        </button>
        {#if isExpanded}
          <div
            in:slide={{ duration: SLIDE_DURATION, easing: cubicOut }}
            out:slide={{ duration: SLIDE_DURATION, easing: cubicOut }}
          >
            <!-- 카드를 두 영역으로 자르지 않도록 좌우 16 들여쓴 구분선 -->
            <div class="mx-4 h-px bg-border-subtle"></div>
            <div
              in:fade={{ duration: FADE_DURATION, delay: 60 }}
              out:fade={{ duration: FADE_DURATION }}
              class="px-5 py-6"
            >
              <p class="text-body-01-reading-regular text-gray-800">
                {item.answer}
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
