<script lang="ts">
  import { page } from '$app/state'
  import axios from 'axios'
  import defaultLogo from '$lib/assets/DefaultLogoBlue.svg'

  interface ReportDownload {
    assessment_name: string
    download_url: string
    expires_in: number
  }

  interface PendingAssessment {
    assessment_name: string
    status: string
  }

  // URL에서 send_result_id 추출
  const sendResultId = $derived(
    page.url.searchParams.get('send_result_id') ?? ''
  )

  // 상태
  let code = $state('')
  let loading = $state(false)
  let error = $state('')
  let reports = $state<ReportDownload[]>([])
  let pending = $state<PendingAssessment[]>([])
  let verified = $state(false)

  // 인증번호 입력 처리 (숫자 4자리만)
  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement
    input.value = input.value.replace(/\D/g, '').slice(0, 4)
    code = input.value
  }

  // 인증 요청
  async function handleVerify() {
    if (code.length !== 4) {
      error = '인증번호 4자리를 입력해주세요.'
      return
    }
    if (!sendResultId) {
      error = '유효하지 않은 접근입니다.'
      return
    }

    loading = true
    error = ''

    try {
      const res = await axios.post(
        `/api/proxy/assessment-results/${sendResultId}/verify`,
        { verification_code: code }
      )

      const data = res.data
      // 백엔드 응답: { reports: [...], pending: [...] } 또는 ApiResponse 래핑
      const reportList = data?.reports ?? data?.data?.reports ?? []
      const pendingList = data?.pending ?? data?.data?.pending ?? []
      reports = reportList
      pending = pendingList
      verified = true
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        err?.response?.data?.meta?.message ??
        err?.response?.data?.message ??
        '인증에 실패했습니다.'
      error = detail
    } finally {
      loading = false
    }
  }

  // 키보드 Enter 처리
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  // 다운로드
  function handleDownload(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.pdf`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
</script>

<svelte:head>
  <title>검사 결과 확인 | 마인드스코프</title>
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12"
>
  <div class="w-full max-w-md">
    <!-- 로고 -->
    <div class="mb-8 flex items-center justify-center">
      <img src={defaultLogo} alt="Logo" class="h-9 w-9 object-cover" />
      <span class="ml-2 text-2xl font-bold text-gray-900">마인드스코프</span>
    </div>

    {#if !sendResultId}
      <!-- 잘못된 접근 -->
      <div
        class="rounded-lg border border-gray-200 bg-white p-8 shadow-md text-center"
      >
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50"
        >
          <svg
            class="h-7 w-7 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-gray-900">유효하지 않은 접근</h2>
        <p class="mt-2 text-sm text-gray-500">
          올바른 링크를 통해 접속해주세요.
        </p>
      </div>
    {:else if verified}
      <!-- 인증 성공 → 보고서 목록 -->
      <div class="rounded-lg border border-gray-200 bg-white p-8 shadow-md">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50"
          >
            <svg
              class="h-7 w-7 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-900">인증 완료</h2>
          <p class="mt-1 text-sm text-gray-500">
            아래에서 검사 결과 보고서를 다운로드하세요.
          </p>
        </div>

        {#if reports.length === 0 && pending.length === 0}
          <p class="text-center text-sm text-gray-400">
            다운로드 가능한 보고서가 없습니다.
          </p>
        {:else}
          {#if reports.length > 0}
            <div class="space-y-3">
              {#each reports as report}
                <button
                  onclick={() =>
                    handleDownload(report.download_url, report.assessment_name)}
                  class="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50"
                  >
                    <svg
                      class="h-5 w-5 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900 truncate-safe">
                      {report.assessment_name}
                    </p>
                    <p class="text-xs text-gray-400">PDF 보고서</p>
                  </div>
                  <svg
                    class="h-5 w-5 shrink-0 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
              {/each}
            </div>

            <p class="mt-4 text-center text-xs text-gray-400">
              다운로드 링크는 1시간 동안 유효합니다.
            </p>
          {/if}

          {#if pending.length > 0}
            {#if reports.length > 0}
              <div class="my-4 border-t border-gray-100"></div>
            {/if}
            <div class="space-y-3">
              <p class="text-sm font-medium text-gray-500">진행 중인 검사</p>
              {#each pending as item}
                <div
                  class="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100"
                  >
                    <svg
                      class="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-500 truncate-safe">
                      {item.assessment_name}
                    </p>
                    <p class="text-xs text-gray-400">
                      검사 제출 후 결과 확인 가능합니다
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <!-- 인증번호 입력 폼 -->
      <div class="rounded-lg border border-gray-200 bg-white p-8 shadow-md">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50"
          >
            <svg
              class="h-7 w-7 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-900">검사 결과 확인</h2>
          <p class="mt-1 text-sm text-gray-500">
            문자로 받으신 인증번호 4자리를 입력해주세요.
          </p>
        </div>

        <div>
          <label
            for="verification-code"
            class="mb-1.5 block text-sm font-medium text-gray-700"
          >
            인증번호
          </label>
          <input
            id="verification-code"
            type="text"
            inputmode="numeric"
            maxlength="4"
            autocomplete="one-time-code"
            placeholder="0000"
            value={code}
            oninput={handleInput}
            onkeydown={handleKeyDown}
            class="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-gray-900 placeholder-gray-300 outline-none transition focus:border-blue-400 focus:ring-blue-400"
          />
        </div>

        {#if error}
          <p class="mt-3 text-center text-sm text-red-500">{error}</p>
        {/if}

        <button
          onclick={handleVerify}
          disabled={loading || code.length !== 4}
          class="mt-5 flex w-full justify-center rounded-lg py-3 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-offset-2 disabled:cursor-not-allowed {loading ||
          code.length !== 4
            ? 'bg-gray-300'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}"
        >
          {#if loading}
            <svg
              class="mr-2 h-5 w-5 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            확인 중...
          {:else}
            확인
          {/if}
        </button>
      </div>
    {/if}

    <!-- 푸터 -->
    <div class="mt-8 text-center text-xs text-gray-400">
      <p>&copy; 2026 mindscope. All rights reserved.</p>
      <div class="mt-2 flex items-center justify-center gap-2">
        <a href="/terms" class="hover:text-gray-600">이용약관</a>
        <span aria-hidden="true">|</span>
        <a href="/privacy" class="hover:text-gray-600">개인정보처리방침</a>
      </div>
    </div>
  </div>
</div>
