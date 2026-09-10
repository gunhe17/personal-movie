<script lang="ts">
  // 검사 구매 페이지
  const assessmentPackages = [
    {
      name: '로르샤흐 검사',
      description: '투사적 성격 검사',
      price: 50000,
      count: 10
    },
    {
      name: 'MMPI 검사',
      description: '다면적 인성 검사',
      price: 30000,
      count: 10
    },
    {
      name: 'HTP 검사',
      description: '집-나무-사람 그림 검사',
      price: 40000,
      count: 10
    }
  ]
</script>

<div class="p-8">
  <div class="mb-4">
    <h1 class="text-headline-01-normal-semibold text-gray-800">검사 구매</h1>
    <p class="text-body-01-normal-regular mt-2 text-gray-600">
      필요한 검사 패키지를 구매할 수 있습니다
    </p>
  </div>

  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {#each assessmentPackages as pkg}
      <div
        class="rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
      >
        <div class="mb-4">
          <h3 class="text-headline-03-semibold text-gray-900">{pkg.name}</h3>
          <p class="text-body-02-normal-regular mt-1 text-gray-600">
            {pkg.description}
          </p>
        </div>

        <div class="mb-4 border-t border-gray-100 pt-4">
          <div class="flex items-baseline gap-1">
            <span class="text-headline-02-bold text-gray-900"
              >{pkg.price.toLocaleString()}원</span
            >
            <span class="text-body-02-normal-regular text-gray-500"
              >/ {pkg.count}회</span
            >
          </div>
          <p class="text-caption-regular mt-1 text-gray-500">
            건당 {(pkg.price / pkg.count).toLocaleString()}원
          </p>
        </div>

        <button
          class="w-full rounded-lg bg-gradient-to-r from-[#4C87F6] to-[#12C2B8] py-3 text-white transition-opacity hover:opacity-90"
        >
          구매
        </button>
      </div>
    {/each}
  </div>

  <div class="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4">
    <div class="flex gap-3">
      <svg
        class="h-5 w-5 flex-shrink-0 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div>
        <p class="text-body-02-normal-medium text-blue-900">구매 안내</p>
        <p class="text-caption-regular mt-1 text-blue-700">
          패키지 구매 후 사용 기한은 구매일로부터 1년입니다
        </p>
      </div>
    </div>
  </div>
</div>
