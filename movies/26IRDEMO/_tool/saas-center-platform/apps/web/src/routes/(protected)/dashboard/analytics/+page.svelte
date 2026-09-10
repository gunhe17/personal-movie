<script lang="ts">
  import { fade } from 'svelte/transition'
</script>

<div in:fade>
  <div class="mb-4">
    <h1 class="text-headline-01-normal-semibold text-gray-800">통계 분석</h1>
    <p class="text-title-02-normal-regular mt-2 text-gray-500">
      센터 운영 현황과 통계 데이터를 확인합니다.
    </p>
  </div>

  <div
    class="flex min-h-100 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm"
  >
    <div
      class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100"
    >
      <svg
        class="h-7 w-7 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 3v18h18M7 15l3-3 3 3 5-6"
        />
      </svg>
    </div>
    <h2 class="text-title-01-normal-semibold text-gray-800">
      통계 대시보드 준비 중
    </h2>
    <p class="text-body-01-reading-regular mt-2 max-w-md text-gray-500">
      내담자·상담·검사 지표와 월별 추이를 한눈에 볼 수 있는 통계 화면을 준비하고
      있습니다. 현재는 각 메뉴(내담자·상담·검사)에서 현황을 확인해 주세요.
    </p>
  </div>
</div>
