<script lang="ts">
  let activeLayout = $state<'A' | 'B' | 'C'>('A')

  // Layout C 전용 탭
  let cTab = $state<'plans' | 'billing'>('plans')
</script>

<div class="mx-auto flex flex-col">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-headline-01-normal-semibold text-gray-900">
      구독 관리 — LAB v3
    </h1>
    <div class="flex gap-1 rounded-xl bg-gray-100 p-1">
      {#each ['A', 'B', 'C'] as tab}
        <button
          class="rounded-lg px-5 py-2 text-body-02-normal-medium transition-colors
            {activeLayout === tab
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}"
          onclick={() => (activeLayout = tab as 'A' | 'B' | 'C')}
        >
          {tab}
        </button>
      {/each}
    </div>
  </div>

  <p class="text-body-03-normal-regular text-gray-400 mb-6">
    {#if activeLayout === 'A'}
      A: 현재 플랜 Hero + 플랜 비교를 테이블 행으로 축소
    {:else if activeLayout === 'B'}
      B: 플랜 카드 안에 현재 상태를 통합 (비교와 상태가 하나로)
    {:else}
      C: 싱글 컬럼 카드 스택 + 기능 비교 테이블 (Linear/Vercel 패턴)
    {/if}
  </p>

  <!-- ════════════════════════════════════════════════════════ -->
  <!-- LAYOUT A: "현재 플랜 Hero + 테이블 플랜 비교"           -->
  <!-- 핵심: 현재 플랜을 시각적 주인공으로,                      -->
  <!--       다른 플랜은 테이블 행(카드 아님)으로 컴팩트하게     -->
  <!-- ════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'A'}
    <div class="space-y-4">
      <!-- Hero: 현재 플랜 (accent 배경) -->
      <div
        class="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/80 via-white to-white px-6 py-6"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100"
            >
              <svg
                class="h-5.5 w-5.5 text-primary-600"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-title-01-normal-semibold text-gray-900">
                  Pro 플랜
                </h2>
                <span
                  class="rounded-full bg-blue-100 px-2.5 py-0.5 text-label-02-normal-medium text-blue-700"
                  >체험판</span
                >
              </div>
              <p class="text-body-03-normal-regular text-gray-500 mt-0.5">
                2026.06.04 ~ 2027.06.04
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-body-01-normal-semibold text-blue-600">
              무료 체험 중
            </p>
            <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
              360일 남음
            </p>
          </div>
        </div>

        <!-- 크레딧 섹션 (Hero 카드 내부) -->
        <div class="rounded-xl bg-white/70 border border-gray-100 px-5 py-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-baseline gap-1.5">
              <span class="text-body-02-normal-medium text-gray-700"
                >AI 크레딧</span
              >
              <span
                class="text-headline-02-normal-bold tabular-nums text-gray-900"
                >14</span
              >
              <span class="text-body-03-normal-regular text-gray-400"
                >/ 2,500</span
              >
            </div>
            <a
              href="/settings/ai-usage"
              class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
              >상세 보기 &rarr;</a
            >
          </div>
          <div class="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
            <div
              class="h-full rounded-full bg-primary-500"
              style="width: 0.6%"
            ></div>
          </div>
          <div
            class="flex items-center justify-between text-body-03-normal-regular text-gray-400"
          >
            <span>일평균 <strong class="text-gray-600">2</strong> 크레딧</span>
            <span>2,486 남음 · 리셋까지 여유</span>
          </div>
        </div>
      </div>

      <!-- 플랜 비교: 테이블 스타일 -->
      <div class="rounded-2xl border border-gray-100 bg-white px-6 py-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-title-01-normal-semibold text-gray-900">플랜 비교</h2>
          <span class="text-label-02-normal-regular text-gray-400"
            >VAT 별도</span
          >
        </div>

        <div class="divide-y divide-gray-100">
          <!-- Free -->
          <div class="flex items-center py-3.5 gap-4">
            <div class="w-20 shrink-0">
              <span class="text-body-01-normal-semibold text-gray-900"
                >Free</span
              >
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-body-02-normal-regular text-gray-500">
                기본 상담 관리 · 내담자/일정/검사 · AI 미포함
              </p>
            </div>
            <div class="w-24 text-right shrink-0">
              <span class="text-body-01-normal-semibold text-gray-900"
                >무료</span
              >
            </div>
            <div class="w-32 shrink-0">
              <div
                class="w-full rounded-lg bg-gray-50 h-8 flex items-center justify-center text-body-03-normal-regular text-gray-400"
              >
                체험 종료 후 변경
              </div>
            </div>
          </div>

          <!-- Starter -->
          <div class="flex items-center py-3.5 gap-4">
            <div class="w-20 shrink-0">
              <span class="text-body-01-normal-semibold text-gray-900"
                >Starter</span
              >
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-body-02-normal-regular text-gray-500">
                AI 상담일지 · 업무 도우미 · 월 500 크레딧
              </p>
            </div>
            <div class="w-24 text-right shrink-0">
              <span
                class="text-body-01-normal-semibold tabular-nums text-gray-900"
                >₩29,000</span
              >
              <span class="text-body-03-normal-regular text-gray-400">/월</span>
            </div>
            <div class="w-32 shrink-0">
              <div
                class="w-full rounded-lg bg-gray-50 h-8 flex items-center justify-center text-body-03-normal-regular text-gray-400"
              >
                체험 종료 후 변경
              </div>
            </div>
          </div>

          <!-- Pro (현재) -->
          <div
            class="flex items-center py-3.5 gap-4 bg-primary-50/30 -mx-6 px-6 rounded-lg"
          >
            <div class="w-20 shrink-0">
              <div class="flex items-center gap-1.5">
                <span class="text-body-01-normal-semibold text-primary-700"
                  >Pro</span
                >
                <span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-body-02-normal-regular text-gray-500">
                올인원 AI · 필드노트 · 통합 청구 · 월 2,500 크레딧
              </p>
            </div>
            <div class="w-24 text-right shrink-0">
              <span
                class="text-body-01-normal-semibold tabular-nums text-gray-900"
                >₩59,000</span
              >
              <span class="text-body-03-normal-regular text-gray-400">/월</span>
            </div>
            <div class="w-32 shrink-0">
              <div
                class="w-full rounded-lg bg-blue-50 h-8 flex items-center justify-center text-body-03-normal-medium text-blue-500"
              >
                체험 중
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 하단: 결제 + 안내 -->
      <div class="grid grid-cols-5 gap-4">
        <div
          class="col-span-3 rounded-2xl border border-gray-100 bg-white px-6 py-5"
        >
          <h3 class="text-body-02-normal-semibold text-gray-900 mb-3">
            결제 이력
          </h3>
          {@render paymentEmpty()}
        </div>
        <div
          class="col-span-2 rounded-2xl border border-gray-100 bg-white px-6 py-5"
        >
          <h3 class="text-body-02-normal-semibold text-gray-900 mb-3">안내</h3>
          {@render infoList()}
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- LAYOUT B: "통합 플랜 카드"                               -->
    <!-- 핵심: 플랜 비교 카드 중 현재 플랜에                       -->
    <!--       상태/크레딧 정보를 직접 내장 → 별도 상태 섹션 불필요 -->
    <!-- ════════════════════════════════════════════════════════ -->
  {:else if activeLayout === 'B'}
    <div class="space-y-4">
      <!-- 플랜 카드 3장 (현재 플랜 카드가 상태 포함) -->
      <div class="grid grid-cols-3 gap-3">
        <!-- Free -->
        <div class="rounded-2xl border border-gray-200 bg-white flex flex-col">
          <div class="px-5 py-5 flex flex-col flex-1">
            <h3 class="text-body-01-normal-semibold text-gray-900 mb-0.5">
              Free
            </h3>
            <p class="text-body-03-normal-regular text-gray-400 mb-3">
              기본 상담 관리
            </p>
            <div class="mb-3">
              <span class="text-headline-02-normal-bold text-gray-900"
                >무료</span
              >
            </div>
            <ul class="space-y-1.5 mb-4 flex-1">
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-gray-300 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-500"
                  >내담자 · 일정 · 검사 관리</span
                >
              </li>
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-gray-300 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-400"
                  >AI 기능 미포함</span
                >
              </li>
            </ul>
            <div class="mt-auto pt-3 border-t border-gray-100">
              <div
                class="w-full rounded-lg bg-gray-50 h-9 flex items-center justify-center text-body-03-normal-regular text-gray-400"
              >
                체험 종료 후 변경 가능
              </div>
            </div>
          </div>
        </div>

        <!-- Starter -->
        <div class="rounded-2xl border border-gray-200 bg-white flex flex-col">
          <div class="px-5 py-5 flex flex-col flex-1">
            <h3 class="text-body-01-normal-semibold text-gray-900 mb-0.5">
              Starter
            </h3>
            <p class="text-body-03-normal-regular text-gray-400 mb-3">
              AI로 업무 시간 절약
            </p>
            <div class="mb-3">
              <span
                class="text-headline-02-normal-bold tabular-nums text-gray-900"
                >₩29,000</span
              >
              <span class="text-body-03-normal-regular text-gray-400">/월</span>
            </div>
            <ul class="space-y-1.5 mb-4 flex-1">
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-primary-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-500"
                  >AI 상담일지 · 업무 도우미</span
                >
              </li>
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-primary-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-500"
                  >월 500 크레딧</span
                >
              </li>
            </ul>
            <div class="mt-auto pt-3 border-t border-gray-100">
              <div
                class="w-full rounded-lg bg-gray-50 h-9 flex items-center justify-center text-body-03-normal-regular text-gray-400"
              >
                체험 종료 후 변경 가능
              </div>
            </div>
          </div>
        </div>

        <!-- Pro (현재 — 상태 정보 통합) -->
        <div
          class="rounded-2xl border-2 border-primary-300 bg-primary-50/30 flex flex-col"
        >
          <div class="px-5 py-5 flex flex-col flex-1">
            <div class="flex items-center justify-between mb-0.5">
              <h3 class="text-body-01-normal-semibold text-primary-700">Pro</h3>
              <span
                class="rounded-full bg-blue-100 px-2 py-0.5 text-label-02-normal-medium text-blue-700"
                >체험 중</span
              >
            </div>
            <p class="text-body-03-normal-regular text-gray-400 mb-3">
              팀을 위한 올인원 AI
            </p>
            <div class="mb-3">
              <span
                class="text-headline-02-normal-bold tabular-nums text-gray-900"
                >₩59,000</span
              >
              <span class="text-body-03-normal-regular text-gray-400">/월</span>
            </div>
            <ul class="space-y-1.5 mb-4">
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-primary-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-600"
                  >필드노트 · 통합 청구 · 대시보드</span
                >
              </li>
              <li class="flex items-start gap-1.5">
                <svg
                  class="h-4 w-4 text-primary-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  /></svg
                >
                <span class="text-body-03-normal-regular text-gray-600"
                  >월 2,500 크레딧</span
                >
              </li>
            </ul>

            <!-- 크레딧 (카드 내부에 통합) -->
            <div
              class="rounded-xl bg-white border border-primary-100 px-4 py-3 mb-3"
            >
              <div class="flex items-baseline justify-between mb-1.5">
                <div class="flex items-baseline gap-1">
                  <span
                    class="text-body-02-normal-semibold tabular-nums text-gray-900"
                    >14</span
                  >
                  <span class="text-body-03-normal-regular text-gray-400"
                    >/ 2,500 크레딧</span
                  >
                </div>
                <a
                  href="/settings/ai-usage"
                  class="text-label-02-normal-medium text-primary-500">상세</a
                >
              </div>
              <div class="h-1.5 rounded-full bg-primary-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary-500"
                  style="width: 0.6%"
                ></div>
              </div>
            </div>

            <!-- 기간/상태 -->
            <div
              class="flex items-center justify-between text-body-03-normal-regular text-gray-400 mb-3"
            >
              <span>2026.06.04 ~ 2027.06.04</span>
              <span class="text-body-03-normal-medium text-blue-600"
                >360일 남음</span
              >
            </div>

            <div class="mt-auto pt-3 border-t border-primary-100">
              <div
                class="w-full rounded-lg bg-blue-50 h-9 flex items-center justify-center text-body-03-normal-medium text-blue-500"
              >
                현재 체험 중인 플랜
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 하단: 결제 + 안내 -->
      <div class="grid grid-cols-3 gap-3">
        <div
          class="col-span-2 rounded-2xl border border-gray-100 bg-white px-5 py-5"
        >
          <h3 class="text-body-02-normal-semibold text-gray-900 mb-3">
            결제 이력
          </h3>
          {@render paymentEmpty()}
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-5 py-5">
          <h3 class="text-body-02-normal-semibold text-gray-900 mb-3">안내</h3>
          {@render infoList()}
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- LAYOUT C: 싱글 컬럼 카드 스택 + 탭 (리서치 기반 개선)   -->
    <!-- ════════════════════════════════════════════════════════ -->
  {:else}
    <div class="space-y-4">
      <!-- 현재 플랜 카드 (Linear 스타일: 한 카드에 플랜+상태+액션) -->
      <div class="rounded-2xl border border-gray-100 bg-white px-6 py-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50"
            >
              <svg
                class="h-5 w-5 text-primary-500"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-body-01-normal-semibold text-gray-900">
                  Pro 플랜
                </h2>
                <span
                  class="rounded-full bg-blue-50 px-2 py-0.5 text-label-02-normal-medium text-blue-600"
                  >체험판</span
                >
              </div>
              <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                ₩59,000/월 · 2026.06.04 ~ 2027.06.04
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <p class="text-body-02-normal-medium text-blue-600">
                무료 체험 중
              </p>
              <p class="text-body-03-normal-regular text-gray-400">
                360일 남음
              </p>
            </div>
            <button
              class="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-body-03-normal-medium text-gray-700 hover:bg-gray-50 transition"
            >
              플랜 변경
            </button>
          </div>
        </div>
      </div>

      <!-- 크레딧 사용량 카드 (독립 — AI 사용량 페이지 축소판) -->
      <div class="rounded-2xl border border-gray-100 bg-white px-6 py-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-body-01-normal-semibold text-gray-900">AI 크레딧</h2>
          <a
            href="/settings/ai-usage"
            class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
            >상세 보기 &rarr;</a
          >
        </div>
        <div class="flex items-end justify-between mb-1.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class="text-headline-02-normal-bold tabular-nums text-gray-900"
              >14</span
            >
            <span class="text-body-02-normal-regular text-gray-400"
              >/ 2,500 사용</span
            >
          </div>
          <span class="text-body-03-normal-regular text-gray-400"
            >2,486 남음</span
          >
        </div>
        <div class="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
          <div
            class="h-full rounded-full bg-primary-500"
            style="width: 0.6%"
          ></div>
        </div>
        <div
          class="flex items-center justify-between text-body-03-normal-regular text-gray-400"
        >
          <span>일평균 <strong class="text-gray-600">2</strong> 크레딧</span>
          <span>리셋까지 여유</span>
        </div>
      </div>

      <!-- 탭 (좌측 정렬) -->
      <div class="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          class="rounded-lg px-5 py-2 text-body-02-normal-medium transition-colors
            {cTab === 'plans'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}"
          onclick={() => (cTab = 'plans')}
        >
          플랜 비교
        </button>
        <button
          class="rounded-lg px-5 py-2 text-body-02-normal-medium transition-colors
            {cTab === 'billing'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}"
          onclick={() => (cTab = 'billing')}
        >
          결제 관리
        </button>
      </div>

      <!-- 탭: 플랜 비교 (기능 비교 테이블) -->
      {#if cTab === 'plans'}
        <div
          class="rounded-2xl border border-gray-100 bg-white overflow-hidden"
        >
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-100">
                <th
                  class="text-left px-6 py-3.5 text-body-02-normal-medium text-gray-500 font-normal w-[35%]"
                  >기능</th
                >
                <th
                  class="text-center px-4 py-3.5 text-body-02-normal-medium text-gray-900 font-normal"
                  >Free</th
                >
                <th
                  class="text-center px-4 py-3.5 text-body-02-normal-medium text-gray-900 font-normal"
                  >Starter</th
                >
                <th
                  class="text-center px-4 py-3.5 text-body-02-normal-medium text-primary-700 font-normal bg-primary-50/40"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    Pro
                    <span class="h-1.5 w-1.5 rounded-full bg-primary-500"
                    ></span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {@render featureRow(
                '내담자 · 일정 · 검사 관리',
                true,
                true,
                true
              )}
              {@render featureRow('상담 관리', true, true, true)}
              {@render featureRow('AI 상담일지', false, true, true)}
              {@render featureRow('AI 업무 도우미', false, true, true)}
              {@render featureRow('필드노트 (실시간 STT)', false, false, true)}
              {@render featureRow('통합 청구 · 바우처', false, false, true)}
              {@render featureRow('AI 실험실', false, false, true)}
              {@render creditRow('AI 크레딧', '-', '500/월', '2,500/월')}
              <tr class="border-t border-gray-200 bg-gray-50/50">
                <td class="px-6 py-4 text-body-02-normal-semibold text-gray-900"
                  >월 요금</td
                >
                <td
                  class="text-center px-4 py-4 text-body-02-normal-semibold text-gray-900"
                  >무료</td
                >
                <td class="text-center px-4 py-4">
                  <span
                    class="text-body-02-normal-semibold tabular-nums text-gray-900"
                    >₩29,000</span
                  >
                </td>
                <td class="text-center px-4 py-4 bg-primary-50/40">
                  <span
                    class="text-body-02-normal-semibold tabular-nums text-primary-700"
                    >₩59,000</span
                  >
                </td>
              </tr>
              <tr>
                <td class="px-6 py-3"></td>
                <td class="text-center px-4 py-3">
                  <div
                    class="inline-flex rounded-lg bg-gray-100 px-4 h-8 items-center text-body-03-normal-regular text-gray-400"
                  >
                    체험 종료 후 변경
                  </div>
                </td>
                <td class="text-center px-4 py-3">
                  <div
                    class="inline-flex rounded-lg bg-gray-100 px-4 h-8 items-center text-body-03-normal-regular text-gray-400"
                  >
                    체험 종료 후 변경
                  </div>
                </td>
                <td class="text-center px-4 py-3 bg-primary-50/40">
                  <div
                    class="inline-flex rounded-lg bg-blue-50 px-4 h-8 items-center text-body-03-normal-medium text-blue-500"
                  >
                    체험 중
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="px-6 py-3 border-t border-gray-100">
            <span class="text-label-02-normal-regular text-gray-400"
              >VAT 별도 · 체험 기간 중 플랜 변경 불가 · 체험 종료 후 원하는 플랜
              선택 가능</span
            >
          </div>
        </div>

        <!-- 탭: 결제 관리 -->
      {:else}
        <div
          class="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100"
        >
          <div class="px-6 py-5">
            <h3 class="text-body-01-normal-semibold text-gray-900 mb-3">
              구독 정보
            </h3>
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-body-02-normal-regular text-gray-400"
                  >현재 플랜</span
                >
                <div class="flex items-center gap-2">
                  <span class="text-body-02-normal-medium text-gray-900"
                    >Pro</span
                  >
                  <span
                    class="rounded-full bg-blue-50 px-2 py-0.5 text-label-02-normal-medium text-blue-600"
                    >체험판</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-body-02-normal-regular text-gray-400"
                  >구독 기간</span
                >
                <span
                  class="text-body-02-normal-medium tabular-nums text-gray-700"
                  >2026.06.04 ~ 2027.06.04</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-body-02-normal-regular text-gray-400"
                  >상태</span
                >
                <span class="text-body-02-normal-medium text-blue-600"
                  >무료 체험 중 · 360일 남음</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-body-02-normal-regular text-gray-400"
                  >크레딧 리셋</span
                >
                <span class="text-body-02-normal-medium text-gray-700"
                  >30일 주기 자동 갱신</span
                >
              </div>
            </div>
          </div>

          <div class="px-6 py-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-body-01-normal-semibold text-gray-900">
                결제 수단
              </h3>
              <button
                class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
                >변경</button
              >
            </div>
            <div class="flex items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-200"
              >
                <svg
                  class="h-4.5 w-4.5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                  />
                </svg>
              </div>
              <div>
                <p class="text-body-02-normal-medium text-gray-600">준비 중</p>
                <p class="text-body-03-normal-regular text-gray-400">
                  건별 결제로 진행
                </p>
              </div>
            </div>
          </div>

          <div class="px-6 py-5">
            <h3 class="text-body-01-normal-semibold text-gray-900 mb-3">
              결제 이력
            </h3>
            <p class="text-body-03-normal-regular text-gray-400 py-1">
              아직 결제 이력이 없습니다. 유료 플랜 결제 시 여기에 표시됩니다.
            </p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- ═══════════════════════════════════ -->
<!-- 공통 Snippets -->
<!-- ═══════════════════════════════════ -->

{#snippet planCardWithFeatures(
  name: string,
  tagline: string,
  price: string,
  suffix: string,
  isCurrent: boolean,
  features: string[],
  isTrial: boolean
)}
  <div
    class="rounded-xl flex flex-col {isCurrent
      ? 'border-2 border-primary-300 bg-primary-50/30'
      : 'border border-gray-200'}"
  >
    <div class="px-4 py-4 flex flex-col flex-1">
      <div class="flex items-center justify-between mb-0.5">
        <h3
          class="text-body-02-normal-semibold {isCurrent
            ? 'text-primary-700'
            : 'text-gray-900'}"
        >
          {name}
        </h3>
        {#if isCurrent && isTrial}
          <span
            class="rounded-full bg-blue-100 px-1.5 py-0.5 text-label-02-normal-medium text-blue-700"
            >체험 중</span
          >
        {/if}
      </div>
      <p class="text-body-03-normal-regular text-gray-400 mb-2">{tagline}</p>
      <div class="flex items-baseline gap-0.5 mb-3">
        <span class="text-title-01-normal-bold tabular-nums text-gray-900"
          >{price}</span
        >
        {#if suffix}
          <span class="text-body-03-normal-regular text-gray-400">{suffix}</span
          >
        {/if}
      </div>

      <ul class="space-y-1 mb-3 flex-1">
        {#each features as feat}
          <li class="flex items-start gap-1.5">
            <svg
              class="h-3.5 w-3.5 {isCurrent
                ? 'text-primary-500'
                : 'text-gray-300'} mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              /></svg
            >
            <span class="text-body-03-normal-regular text-gray-500">{feat}</span
            >
          </li>
        {/each}
      </ul>

      <div class="mt-auto pt-2.5 border-t border-gray-100">
        {#if isCurrent && isTrial}
          <div
            class="w-full rounded-lg bg-blue-50 h-8 flex items-center justify-center text-body-03-normal-medium text-blue-500"
          >
            체험 중인 플랜
          </div>
        {:else if isTrial}
          <div
            class="w-full rounded-lg bg-gray-50 h-8 flex items-center justify-center text-label-02-normal-regular text-gray-400"
          >
            체험 종료 후 변경 가능
          </div>
        {:else}
          <button
            class="w-full rounded-lg bg-gray-100 h-8 flex items-center justify-center text-body-03-normal-medium text-gray-500 hover:bg-gray-200 transition"
          >
            선택
          </button>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet paymentEmpty()}
  <div class="flex items-center gap-3 py-2">
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50"
    >
      <svg
        class="h-4.5 w-4.5 text-gray-300"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
        />
      </svg>
    </div>
    <div>
      <p class="text-body-03-normal-medium text-gray-500">
        결제 이력이 없습니다
      </p>
      <p class="text-label-02-normal-regular text-gray-400">
        유료 플랜 결제 시 여기에 표시됩니다
      </p>
    </div>
  </div>
{/snippet}

{#snippet featureRow(
  label: string,
  free: boolean,
  starter: boolean,
  pro: boolean
)}
  <tr>
    <td class="px-6 py-2.5 text-body-02-normal-regular text-gray-700"
      >{label}</td
    >
    <td class="text-center px-4 py-2.5">
      {#if free}
        <svg
          class="inline h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          /></svg
        >
      {:else}
        <span class="text-body-03-normal-regular text-gray-300">—</span>
      {/if}
    </td>
    <td class="text-center px-4 py-2.5">
      {#if starter}
        <svg
          class="inline h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          /></svg
        >
      {:else}
        <span class="text-body-03-normal-regular text-gray-300">—</span>
      {/if}
    </td>
    <td class="text-center px-4 py-2.5 bg-primary-50/40">
      {#if pro}
        <svg
          class="inline h-4 w-4 text-primary-500"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          /></svg
        >
      {:else}
        <span class="text-body-03-normal-regular text-gray-300">—</span>
      {/if}
    </td>
  </tr>
{/snippet}

{#snippet creditRow(label: string, free: string, starter: string, pro: string)}
  <tr>
    <td class="px-6 py-2.5 text-body-02-normal-regular text-gray-700"
      >{label}</td
    >
    <td
      class="text-center px-4 py-2.5 text-body-02-normal-regular text-gray-400"
      >{free}</td
    >
    <td
      class="text-center px-4 py-2.5 text-body-02-normal-medium tabular-nums text-gray-700"
      >{starter}</td
    >
    <td
      class="text-center px-4 py-2.5 text-body-02-normal-medium tabular-nums text-primary-700 bg-primary-50/40"
      >{pro}</td
    >
  </tr>
{/snippet}

{#snippet infoList()}
  <ul class="space-y-1.5">
    <li class="flex items-start gap-1.5">
      <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400"></span>
      <p class="text-body-03-normal-regular text-gray-500">
        체험 기간 중 플랜 변경 불가
      </p>
    </li>
    <li class="flex items-start gap-1.5">
      <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400"></span>
      <p class="text-body-03-normal-regular text-gray-500">
        체험 종료 후 플랜 선택 가능
      </p>
    </li>
    <li class="flex items-start gap-1.5">
      <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300"></span>
      <p class="text-body-03-normal-regular text-gray-500">
        크레딧 30일 주기 자동 갱신
      </p>
    </li>
  </ul>
{/snippet}
