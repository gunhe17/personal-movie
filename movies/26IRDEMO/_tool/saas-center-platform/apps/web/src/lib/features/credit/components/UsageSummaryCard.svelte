<script lang="ts">
  import type { UsagePageVM } from '../view-model'

  interface Props {
    vm: UsagePageVM
  }

  let { vm }: Props = $props()
</script>

<div class="rounded-lg border border-gray-200 bg-white">
  <div class="px-6 pt-6 pb-2">
    <h2 class="text-title-01-normal-semibold text-gray-800">이번 달 요약</h2>
  </div>
  <div class="px-3 pb-3">
    <!-- AI 호출 수 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50"
        >
          <svg
            class="h-5 w-5 text-violet-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">AI 사용</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            이번 기간 총 사용 횟수
          </p>
        </div>
      </div>
      <p class="pl-4 shrink-0">
        <span class="text-title-01-normal-semibold tabular-nums text-gray-900"
          >{vm.totalCalls.toLocaleString()}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">회</span>
      </p>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 사용한 크레딧 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50"
        >
          <svg
            class="h-5 w-5 text-sky-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">사용한 크레딧</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            이번 기간 누적 크레딧
          </p>
        </div>
      </div>
      <p class="pl-4 shrink-0">
        <span class="text-title-01-normal-semibold tabular-nums text-gray-900"
          >{vm.creditUsed.toLocaleString()}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">크레딧</span>
      </p>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 활성 사용자 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50"
        >
          <svg
            class="h-5 w-5 text-emerald-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">활성 사용자</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            AI를 사용한 직원 수
          </p>
        </div>
      </div>
      <p class="pl-4 shrink-0">
        <span class="text-title-01-normal-semibold tabular-nums text-gray-900"
          >{vm.activeMembers}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">명</span>
      </p>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 가장 많이 쓴 기능 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50"
        >
          <svg
            class="h-5 w-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">Top 기능</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            가장 많이 사용한 기능
          </p>
        </div>
      </div>
      <p class="pl-4 shrink-0 text-body-01-normal-semibold text-gray-900">
        {vm.topPurposeLabel ?? '-'}
      </p>
    </div>
  </div>
</div>
