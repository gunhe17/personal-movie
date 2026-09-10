<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import rorschachBg from '@assessment/rorschach/assets/rorschach_bg.png'
  import rorschachBg2 from '@assessment/rorschach/assets/rorschach_bg_2.png'

  const clientId = $derived(page.params.clientId)
  const rorschachBasePath = $derived(
    page.url.pathname.startsWith('/assessment-flow/rorschach')
      ? '/assessment-flow/rorschach'
      : '/assessment/rorschach'
  )

  function continueFromResults() {
    // 채점결과 위치에서 계속하기
    goto(`${rorschachBasePath}/${clientId}/scoring`)
  }

  function uploadAndAnalyze() {
    // 결과 보고서 위치에서 계속하기
    goto(`${rorschachBasePath}/${clientId}/analysis`)
  }

  function goBack() {
    goto(`${rorschachBasePath}/${clientId}`)
  }
</script>

<div class="min-h-screen flex">
  <!-- Left Side - Rorschach Logo -->
  <div
    class="w-1/2 flex flex-col items-center justify-center text-white relative overflow-hidden"
  >
    <!-- Background Gradient Layer (bottom) -->
    <div
      class="absolute inset-0"
      style="background-image: url({rorschachBg2}); background-size: cover; background-position: center;"
    ></div>

    <!-- Background Pattern Layer (top) -->
    <div
      class="absolute inset-0 opacity-20"
      style="background-image: url({rorschachBg}); background-repeat: repeat; background-size: 100px 100px;"
    ></div>

    <!-- Content Layer -->
    <div class="relative z-10">
      <div class="text-center">
        <!-- Rorschach Inkblot Icon -->
        <div class="mb-8">
          <svg
            class="w-32 h-32 mx-auto text-white"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path
              d="M100 20 C120 20, 140 40, 140 60 C140 80, 120 100, 100 100 C80 100, 60 80, 60 60 C60 40, 80 20, 100 20 Z M100 100 C120 100, 140 120, 140 140 C140 160, 120 180, 100 180 C80 180, 60 160, 60 140 C60 120, 80 100, 100 100 Z M80 60 C85 55, 95 55, 100 60 C105 55, 115 55, 120 60 C115 65, 105 65, 100 70 C95 65, 85 65, 80 60 Z"
            />
          </svg>
        </div>

        <h1 class="text-4xl font-bold mb-4">Rorschach(아이웅)</h1>
        <p class="text-lg opacity-90 leading-relaxed max-w-md">
          최종 내담자의 잉크 얼룩 그리고 문양 침한 가능만 답변되 하는<br />
          지이멘달치의 잉크 얼룩은 보인자에서, 피험자의 반응 측면, 반응의 내용,<br
          />
          그리고 피험자가 주목한 묘목 등을 종합적으로 기복제어<br />
          정신적 상태나 안색을 진단하는 검사입니다
        </p>
      </div>
    </div>
  </div>

  <!-- Right Side - Upload Options -->
  <div class="w-1/2 bg-gray-50 flex flex-col items-center justify-center px-12">
    <div class="max-w-md w-full">
      <h2 class="text-2xl font-bold text-gray-900 mb-2 text-center">
        어디까지<br />진행했나요?
      </h2>

      <!-- Option 1: Upload Test Results -->
      <button
        onclick={continueFromResults}
        class="w-full mb-6 p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all duration-200 group"
      >
        <div class="flex items-center">
          <div
            class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-green-200 transition-colors"
          >
            <svg
              class="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div class="text-left flex-1">
            <h3 class="font-semibold text-gray-900 mb-1">채점결과 있어요</h3>
            <p class="text-sm text-gray-500">
              채점표 부 설석결과를 업로드해주세요
            </p>
          </div>
          <svg
            class="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      <!-- Option 2: Upload Final Results -->
      <button
        onclick={uploadAndAnalyze}
        class="w-full mb-8 p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
      >
        <div class="flex items-center">
          <div
            class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors"
          >
            <svg
              class="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div class="text-left flex-1">
            <h3 class="font-semibold text-gray-900 mb-1">
              이미 결과 보고서가 있어요
            </h3>
            <p class="text-sm text-gray-500">결과 보고서를 업로드해주세요</p>
          </div>
          <svg
            class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      <!-- Navigation Buttons -->
      <div class="flex justify-center gap-4">
        <button
          onclick={goBack}
          class="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← 이전으로
        </button>
        <button
          onclick={() =>
            goto(
              rorschachBasePath.startsWith('/assessment-flow')
                ? '/assessment-flow/receive'
                : '/assessment'
            )}
          class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          싸취하게
        </button>
      </div>
    </div>
  </div>
</div>
