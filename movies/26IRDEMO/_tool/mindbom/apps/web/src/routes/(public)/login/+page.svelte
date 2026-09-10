<script lang="ts">
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { institutionStore } from '$lib/stores/institution.store'
  import { postRaw } from '$lib/services/api/instances'
  import { snackbarStore } from '$lib/stores/snackbar'
  import BrandMark from '$components/ui/BrandMark.svelte'
  import ProjectiveTestsIllustration from '$lib/assets/illustrations/ProjectiveTestsIllustration.svelte'
  import AuthField from '$components/ui/AuthField.svelte'
  import Button from '$components/ui/Button.svelte'

  let email = $state('')
  let password = $state('')
  let isLoading = $state(false)
  let error = $state('')

  let isFormValid = $derived(
    Boolean(email?.trim()) && Boolean(password?.trim())
  )

  async function handleLogin() {
    if (!isFormValid) return

    error = ''
    isLoading = true
    try {
      const result = await postRaw<{
        access_token: string
        refresh_token: string
        user: {
          id: string
          email: string
          name: string
          role: 'admin' | 'clinician' | 'researcher'
        }
        institution: { id: string; name: string }
        institutions: Array<{
          institution_id: string
          institution_name: string
          member_id: string
          name: string
          role: 'admin' | 'clinician' | 'researcher'
        }>
        requires_institution_choice: boolean
      }>('/auth/login', { email, password })

      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          institution_id: result.institution.id
        })
      })

      auth.login(result.user)
      institutionStore.hydrate({
        currentInstitutionId: result.institution.id,
        institutions: result.institutions.map((m) => ({
          id: m.institution_id,
          name: m.institution_name,
          role: m.role
        }))
      })

      if (result.requires_institution_choice) {
        goto('/select-institution')
      } else {
        goto('/dashboard')
      }
    } catch (err: any) {
      error =
        err?.response?.data?.detail || '이메일 또는 비밀번호를 확인해주세요.'
    } finally {
      isLoading = false
    }
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && isFormValid) handleLogin()
  }

  // 캐러셀
  const carouselItems = [
    {
      title: 'AI 기반 검사 해석',
      description:
        'HTP, 로르샤하, SCT 검사 결과를 AI가 분석하여 초안을 제공합니다.'
    },
    {
      title: '투사적 심리검사 통합',
      description:
        '3종 투사검사의 실시, 채점, 보고서를 하나의 시스템에서 관리하세요.'
    },
    {
      title: '효율적인 검사 프로세스',
      description:
        'AI 초안 작성부터 임상 심리사 검토까지, 체계적인 워크플로우를 지원합니다.'
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
  <!--
    왼쪽: 로그인 폼.
    좌우 분할이라 AuthShell(중앙 단일 카드)을 쓰지 않는다 — 대신 카드 규격
    (rounded-2xl · border-gray-200 · shadow-card · p-8)과 폭 540을 맞춰 둔다.
  -->
  <div
    class="flex min-h-screen flex-1 flex-col items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-20"
  >
    <div class="w-full max-w-135">
      <div class="w-full rounded-2xl bg-white p-8 shadow-card">
        <!--
          여기가 로그인 화면이라 로고에 링크를 걸지 않는다.
          size="sm"(18) — 아래 제목 "로그인"이 20이라 같은 크기면 위계가 사라진다.
        -->
        <BrandMark size="sm" class="mb-6" />

        <h1 class="text-headline-02-semibold text-gray-900">로그인</h1>

        <form
          class="mt-6 flex flex-col gap-5"
          onsubmit={(e) => {
            e.preventDefault()
            handleLogin()
          }}
        >
          <!--
            로그인 실패는 어느 필드가 틀렸는지 알 수 없다(서버가 알려주지
            않고, 알려주면 계정 존재 여부가 새어 나간다). 그래서 두 필드를
            같이 빨갛게 표시하되 문구는 아래 에러 박스 하나로 모은다 —
            예전엔 필드마다 "…를 다시 확인해주세요"를 띄우면서 정작 서버가
            준 실제 사유(잠금·미인증 등)를 버리고 있었다.
          -->
          <AuthField
            id="email"
            label="이메일"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            onkeypress={handleKeyPress}
            placeholder="이메일을 입력해주세요"
            invalid={Boolean(error)}
          />

          <AuthField
            id="password"
            label="비밀번호"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            onkeypress={handleKeyPress}
            placeholder="비밀번호를 입력해주세요"
            invalid={Boolean(error)}
          />

          {#if error}
            <div
              class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-03-regular text-red-700"
            >
              {error}
            </div>
          {/if}

          <Button
            type="submit"
            variant="primary"
            size="xl"
            fullWidth
            loading={isLoading}
            disabled={!isFormValid}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <div
          class="mt-5 flex items-center justify-between text-body-03-regular text-gray-500"
        >
          <a
            href="/forgot-password"
            class="hover:text-primary-500 hover:underline"
          >
            비밀번호를 잊으셨나요?
          </a>
          <a href="/signup" class="text-primary-500 hover:underline">
            회원가입
          </a>
        </div>
      </div>

      <!-- 푸터 -->
      <div
        class="mt-6 flex items-center justify-center gap-2 text-body-03-regular text-gray-400"
      >
        <a href="/terms" class="hover:text-gray-500">이용약관</a>
        <span aria-hidden="true">|</span>
        <a href="/privacy" class="hover:text-gray-500">개인정보처리방침</a>
      </div>
    </div>
  </div>

  <!-- 오른쪽: 서비스 소개 (캐러셀) -->
  <!-- 배경은 참조 프로젝트와 같은 primary-400(#68A0FF) — 500보다 한 단계 밝다 -->
  <div
    class="hidden flex-col items-center justify-center bg-primary-400 p-12 lg:flex lg:w-1/2"
  >
    <!--
      브랜드 히어로 문구 — 토큰 사다리 최상단이 headline-01(24)이라 담기지 않는다.
      정본 타이포는 정보 표면(표·폼·상세)을 위한 것이고, 로그인 우측 패널은
      읽는 화면이 아니라 보는 화면이라 여기만 예외로 36을 유지한다.
    -->
    <p class="text-center text-4xl leading-tight font-bold text-white">
      투사적 심리검사<br />
      AI 해석 보조 시스템
    </p>

    <!-- 일러스트 — 세 검사(HTP·로르샤하·SCT)를 겹친 카드로 -->
    <div class="mt-16 mb-12 flex justify-center">
      <ProjectiveTestsIllustration class="h-56 w-auto" />
    </div>

    <!--
      캐러셀 — 슬라이드마다 설명 길이가 달라 높이가 튄다. min-h로 가장 긴
      문구(2줄) 기준을 잡아 두면 아래 도트가 위아래로 흔들리지 않는다.
      max-w는 한 줄이 지나치게 길어지는 걸 막는다(가독 폭).
    -->
    <div
      class="min-h-20 max-w-100 text-center transition-opacity duration-300"
      style="opacity: {fadeIn ? 1 : 0}"
    >
      <h3 class="text-headline-02-semibold text-white">
        {carouselItems[currentSlide].title}
      </h3>
      <p class="mt-2 text-body-02-reading-regular text-white/80">
        {carouselItems[currentSlide].description}
      </p>
    </div>

    <!--
      도트 인디케이터 — 점 자체는 8이지만 버튼은 24로 잡아 누르기 쉽게 한다
      (점 크기를 키우면 시각적으로 무거워진다). 활성 점은 너비를 늘려
      색뿐 아니라 형태로도 구분되게 했다.
    -->
    <div class="mt-8 flex justify-center gap-1">
      {#each carouselItems as _, i}
        <button
          type="button"
          onclick={() => {
            if (i === currentSlide) return
            fadeIn = false
            setTimeout(() => {
              currentSlide = i
              fadeIn = true
            }, 300)
          }}
          class="flex h-6 w-6 items-center justify-center"
          aria-label="슬라이드 {i + 1}"
          aria-current={currentSlide === i}
        >
          <span
            class="h-2 rounded-full transition-all duration-300
              {currentSlide === i ? 'w-5 bg-white' : 'w-2 bg-white/40'}"
          ></span>
        </button>
      {/each}
    </div>
  </div>
</div>
