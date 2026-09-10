<script lang="ts">
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { auth } from '$lib/stores/auth'
  import { useLoginForm } from '$lib/features/login/hooks.svelte'
  import RedirectOverlay from '$lib/components/RedirectOverlay.svelte'
  import Typography from '@common/components/Typography.svelte'
  import MonitorIcon from '$root/src/lib/assets/MonitorIcon.svelte'
  import MindScopeLogo from '$root/src/lib/assets/MindScopeLogo.svelte'

  const form = useLoginForm()
  const redirectTo = $derived(page.url.searchParams.get('redirectTo') || '')
  const isInvitationFlow = $derived(redirectTo.startsWith('/accept-invitation'))
  const isLoginFormValid = $derived(
    Boolean(form.email?.trim()) && Boolean(form.password?.trim())
  )
  const hasInitialUser = $derived(!!page.data?.user && $auth?.isAuthenticated)

  const signupHref = $derived(
    redirectTo
      ? '/signup?redirectTo=' + encodeURIComponent(redirectTo)
      : '/signup'
  )

  // 캐러셀 데이터
  const carouselItems = [
    {
      title: '내담자 통합 관리',
      description: '내담자 정보, 상담 이력, 검사 결과를 한눈에 관리하세요.'
    },
    {
      title: '심리검사 시스템',
      description: '다양한 심리검사 실시 및 자동 채점을 지원합니다.'
    },
    {
      title: '스마트 예약 관리',
      description: '상담 일정 자동화 및 알림 시스템으로 효율적으로 관리하세요.'
    }
  ]

  let currentSlide = $state(0)
  let fadeIn = $state(true)

  $effect(() => {
    if (!browser) return
    const interval = setInterval(() => {
      fadeIn = false
      setTimeout(() => {
        currentSlide = (currentSlide + 1) % carouselItems.length
        fadeIn = true
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  })
</script>

<div class="flex min-h-screen">
  <!-- 왼쪽: 로그인 폼 -->
  <div
    class="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-20 bg-[#f8f8f8]"
  >
    <div class="w-full max-w-136">
      {#if hasInitialUser}
        <RedirectOverlay to="/welcome" message="센터 목록을 불러오는 중..." />
      {:else}
        <!-- 로그인 폼 -->
        {#if isInvitationFlow}
          <a
            href={redirectTo || '/login'}
            class="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            초대 페이지로 돌아가기
          </a>
        {/if}

        <div
          class="bg-white rounded-lg shadow-md p-8 w-full border border-gray-200"
        >
          <!-- 카드 내 로고 -->
          <div class="flex items-center mb-6">
            <!-- <img src={} alt="Logo" class="h-8 w-8 object-cover" /> -->
            <MindScopeLogo />
          </div>

          <Typography
            variant="headline-02-normal-semibold"
            color="text-gray-900"
          >
            로그인
          </Typography>
          {#if isInvitationFlow}
            <p class="mt-2 text-sm text-gray-600">
              로그인 후 센터 초대가 자동으로 수락됩니다.
            </p>
          {/if}

          <form
            class="mt-6 flex flex-col gap-5"
            onsubmit={(e) => {
              e.preventDefault()
              form.handleLogin()
            }}
          >
            <div>
              <label
                for="email"
                class="text-body-02-normal-medium block text-sm font-medium text-gray-700 mb-2"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                bind:value={form.email}
                onkeypress={form.handleKeyPress}
                class="w-full h-12 rounded-lg border bg-white px-3 py-2.5 text-body-01-normal-regular text-gray-900 placeholder-gray-400 outline-none {form.error
                  ? 'border-status-danger focus:border-status-danger'
                  : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400'}"
                placeholder="이메일을 입력해주세요"
              />
              {#if form.error}
                <p class="mt-1.5 text-sm text-status-danger">
                  이메일을 다시 확인해주세요
                </p>
              {/if}
            </div>

            <div>
              <label
                for="password"
                class="text-body-02-normal-medium block text-sm font-medium text-gray-900 mb-1.5"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                bind:value={form.password}
                onkeypress={form.handleKeyPress}
                class="w-full h-12 rounded-lg border bg-white px-3 py-2.5 text-body-01-normal-regular text-gray-900 placeholder-gray-400 outline-none {form.error
                  ? 'border-status-danger focus:border-status-danger'
                  : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400'}"
                placeholder="비밀번호를 입력해주세요"
              />
              {#if form.error}
                <p class="mt-1.5 text-sm text-status-danger">
                  비밀번호를 다시 확인해주세요
                </p>
              {/if}
            </div>

            <!-- 아이디 찾기 | 비밀번호 찾기 (미구현 — 백엔드 API 완성 후 활성화) -->
            <!-- <div
              class="my-1 flex justify-center gap-2 text-body-02-reading-regular text-gray-500"
            >
              <a href="/find-id" class="hover:text-gray-700">아이디 찾기</a>
              <span class="text-gray-300">|</span>
              <a href="/find-password" class="hover:text-gray-700"
                >비밀번호 찾기</a
              >
            </div> -->

            <button
              type="submit"
              disabled={form.loading}
              class="w-full h-13 flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-title-01-normal-semibold text-white shadow-sm transition-colors focus:outline-none focus:ring-offset-2 disabled:cursor-not-allowed {form.loading
                ? 'bg-gray-300 cursor-not-allowed'
                : isLoginFormValid
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  : 'bg-[#B2CEF7] text-gray-700 focus:ring-blue-300'}"
            >
              {#if form.loading}
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                로그인 중...
              {:else}
                로그인
              {/if}
            </button>
          </form>

          <div
            class="mt-6 text-center text-body-02-reading-regular text-gray-700"
          >
            <span>계정이 없으신가요?</span>
            <a
              href={signupHref}
              class="ml-3 text-body-02-reading-regular text-primary-600 hover:text-blue-500"
            >
              회원가입
            </a>
          </div>
        </div>
      {/if}

      <!-- 푸터 -->
      <div
        class="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400"
      >
        <a href="/terms" class="text-body-03-normal-regular hover:text-gray-500"
          >이용약관</a
        >
        <span aria-hidden="true">|</span>
        <a
          href="/privacy"
          class="text-body-03-normal-regular hover:text-gray-500"
          >개인정보처리방침</a
        >
      </div>
    </div>
  </div>

  <!-- 오른쪽: 서비스 소개 섹션 (캐러셀) -->
  <div
    class="hidden lg:flex lg:w-1/2 bg-primary-400 p-12 flex-col items-center justify-center"
  >
    <!-- 타이틀 -->
    <h1 class="text-4xl font-bold text-white leading-tight text-center">
      심리상담 센터를 위한<br />
      올인원 관리 플랫폼
    </h1>

    <!-- 모니터 일러스트레이션 -->
    <div class="flex justify-center mt-20 mb-12">
      <MonitorIcon />
    </div>

    <!-- 캐러셀 기능 설명 -->
    <div
      class="text-center transition-opacity duration-300 min-h-[64px]"
      style="opacity: {fadeIn ? 1 : 0}"
    >
      <h3 class="text-xl font-semibold text-white">
        {carouselItems[currentSlide].title}
      </h3>
      <p class="mt-2 text-white/70 text-sm">
        {carouselItems[currentSlide].description}
      </p>
    </div>

    <!-- 도트 인디케이터 -->
    <div class="flex justify-center gap-2.5 mt-8">
      {#each carouselItems as _, i}
        <button
          type="button"
          onclick={() => {
            fadeIn = false
            setTimeout(() => {
              currentSlide = i
              fadeIn = true
            }, 300)
          }}
          class="w-2 h-2 rounded-full transition-colors duration-300 {currentSlide ===
          i
            ? 'bg-white'
            : 'bg-white/40'}"
          aria-label="슬라이드 {i + 1}"
        ></button>
      {/each}
    </div>
  </div>
</div>
