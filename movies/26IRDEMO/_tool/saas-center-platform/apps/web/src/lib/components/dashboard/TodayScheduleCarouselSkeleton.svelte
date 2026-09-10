<script lang="ts">
  /**
   * 오늘 일정 캐러셀 로딩 스켈레톤.
   *
   * 치수는 실제 캐러셀(TodayScheduleCarousel)·카드(DashboardScheduleCard)를 그대로 따른다 —
   * 데이터가 도착할 때 화면이 튀지 않아야 하므로, 저쪽 값이 바뀌면 여기도 같이 고친다.
   *   카드 380 · padding 20 · 상세 보기 버튼 40  → 카드 높이 245
   *   무대 높이 = 카드 245 + 아치 낙차 32 = 277
   */

  /** 실제 캐러셀의 OFFSET[1] / SCALE[1] / ARC_Y[1] — 좌우 이웃 카드 배치 */
  const NEIGHBORS = [-1, 0, 1]
</script>

<div class="flex flex-col gap-5" aria-hidden="true">
  <!-- 타임라인 스크러버 -->
  <div class="relative -top-2 mx-auto w-full max-w-[380px] pt-6">
    <div class="flex items-center justify-between">
      <span class="skeleton h-[13px] w-10"></span>
      <span class="skeleton h-[13px] w-10"></span>
    </div>
    <div class="skeleton mt-2 h-2.5 w-full rounded-full"></div>
  </div>

  <!-- 카드 무대 -->
  <div class="relative h-[277px]">
    {#each NEIGHBORS as d (d)}
      <div
        class="absolute bottom-8 left-1/2 origin-bottom"
        style="translate: calc(-50% + {d * 353}px) {d === 0
          ? 0
          : 12}px; scale: {d === 0 ? 1 : 0.78}; opacity: {d === 0 ? 1 : 0.8}"
      >
        <div
          class="flex w-[380px] flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
        >
          <div class="flex flex-col gap-1">
            <!-- 시각 + 상태 배지 -->
            <div class="flex items-start justify-between gap-3">
              <span class="skeleton h-4 w-12"></span>
              <span class="skeleton h-8 w-[63px] rounded-full"></span>
            </div>

            <div class="flex flex-col gap-4">
              <!-- 이름 + 생년월일·성별 -->
              <div class="flex flex-col gap-3">
                <span class="skeleton h-[18px] w-28"></span>
                <span class="skeleton h-[15px] w-36"></span>
              </div>
              <!-- 상담실 · 프로그램 -->
              <div class="flex flex-col gap-2">
                <span class="skeleton h-5 w-40"></span>
                <span class="skeleton h-5 w-32"></span>
              </div>
            </div>
          </div>

          <!-- 상세 보기 버튼 -->
          <span class="skeleton h-10 w-full"></span>
        </div>
      </div>
    {/each}
  </div>
</div>
