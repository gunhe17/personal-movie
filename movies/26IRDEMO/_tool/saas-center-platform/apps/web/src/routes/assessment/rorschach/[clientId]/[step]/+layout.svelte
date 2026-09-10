<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'
  import CardIcon from '@assessment/rorschach/assets/Card.svg'
  import GradingIcon from '@assessment/rorschach/assets/Grading.svg'
  import AnalyzeIcon from '@assessment/rorschach/assets/Analyze.svg'
  import ResultIcon from '@assessment/rorschach/assets/Result.svg'

  let { children } = $props()

  // Client ID from URL params
  const clientId = $derived(page.params.clientId || '')
  const currentStep = $derived(page.params.step || 'card-presentation')
  const rorschachBasePath = $derived(
    page.url.pathname.startsWith('/assessment-flow/rorschach')
      ? '/assessment-flow/rorschach'
      : '/assessment/rorschach'
  )

  // 인증 상태 확인
  let isAuthenticated = $state(false)
  let isMainAuthLoading = true
  let isAssessmentAuthLoading = true
  let hasMainAuth = false
  let hasAssessmentAuth = false

  // Mock client data - 실제로는 API에서 가져와야 함
  let clientInfo = $state({
    id: '',
    parentName: '김학부',
    parentId: 'dlapath',
    childName: '아이상호',
    school: '초등학교',
    grade: '체인자 서',
    template: '보고서 양식1'
  })

  // 로르샤흐 검사 단계 정의 (스크린샷 기준)
  const steps = [
    {
      id: 'card-presentation',
      label: '카드 그림',
      description: '로르샤흐 카드 제시 및 반응 기록',
      icon: CardIcon
    },
    {
      id: 'scoring',
      label: '채점표 작성/결과',
      description: '반응에 대한 채점 및 분석',
      icon: GradingIcon
    },
    {
      id: 'interpretation',
      label: '해석 확인',
      description: '심리 분석 및 해석',
      icon: AnalyzeIcon
    },
    {
      id: 'finalizing',
      label: '미리보기',
      description: '최종 결과 및 보고서',
      icon: ResultIcon
    }
  ]

  const currentStepIndex = $derived(
    steps.findIndex((step) => step.id === currentStep)
  )

  onMount(() => {
    // 인증 상태 확인 (내부 로그인 또는 검사 전용 로그인 모두 허용)
    auth.checkAuth()
    assessmentAuthStore.checkAuth()

    const validateAuthState = () => {
      if (isMainAuthLoading || isAssessmentAuthLoading) return

      isAuthenticated = hasMainAuth || hasAssessmentAuth
      if (!isAuthenticated) {
        const redirectTo = `${window.location.pathname}${window.location.search}`
        if (rorschachBasePath.startsWith('/assessment-flow')) {
          goto(
            `/assessment-flow/login?redirectTo=${encodeURIComponent(redirectTo)}`
          )
          return
        }
        goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
      }
    }

    const unsubscribeMainAuth = auth.subscribe((state) => {
      isMainAuthLoading = state.isLoading
      hasMainAuth = state.isAuthenticated
      validateAuthState()
    })

    const unsubscribeAssessmentAuth = assessmentAuthStore.subscribe((state) => {
      isAssessmentAuthLoading = state.isLoading
      hasAssessmentAuth = state.isAuthenticated
      validateAuthState()
    })

    // 클라이언트 정보 로드
    if (clientId) {
      clientInfo.id = clientId
    }

    return () => {
      unsubscribeMainAuth()
      unsubscribeAssessmentAuth()
    }
  })

  function closeTest() {
    if (rorschachBasePath.startsWith('/assessment-flow')) {
      goto('/assessment-flow/receive')
      return
    }
    goto('/assessment')
  }

  function navigateToStep(stepId: string) {
    goto(`${rorschachBasePath}/${clientId}/${stepId}`)
  }

  function navigateToPrevStep() {
    if (currentStepIndex > 0) {
      const prevStep = steps[currentStepIndex - 1]
      navigateToStep(prevStep.id)
    }
  }

  function navigateToNextStep() {
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1]
      navigateToStep(nextStep.id)
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="border-b border-gray-200 bg-white px-6 py-3">
    <div class="flex items-center justify-between">
      <!-- Left: Close button and test title -->
      <div class="flex items-center gap-4">
        <button
          onclick={closeTest}
          class="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
        >
          닫기
        </button>

        <!-- Test Title -->
        <div class="text-sm text-gray-600">
          <span class="font-medium"
            >{clientInfo.parentName}({clientInfo.parentId})</span
          >의
          <span class="font-medium">Rorschach({clientInfo.childName})</span>를
          보고서
          <span class="font-medium">{clientInfo.template}</span> |
          <span>{clientInfo.school} {clientInfo.grade}</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Step Indicator -->
  <div class=" bg-gray-50 px-9 py-4">
    <div class="flex items-center justify-between">
      <!-- 이전 단계 버튼 -->
      <button
        onclick={navigateToPrevStep}
        disabled={currentStepIndex === 0}
        class="h-[52px] w-[120px] rounded-[100px] border border-gray-300 text-[20px] leading-[20px] font-semibold text-gray-500 transition-colors
				{currentStepIndex === 0
          ? 'cursor-not-allowed bg-gray-300'
          : 'bg-white hover:bg-gray-50'}"
      >
        이전 단계
      </button>

      <!-- Step 버튼들 -->
      <div class="flex items-center justify-center">
        {#each steps as step, index}
          {@const isActive = step.id === currentStep}
          {@const isCompleted = index <= currentStepIndex}

          <div class="flex items-center gap-3">
            <button
              onclick={() => navigateToStep(step.id)}
              class="flex h-[40px] w-[40px] items-center justify-center gap-3 rounded-[8px] transition-all duration-200
							{isCompleted
                ? 'text-white shadow-lg'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
              style={isCompleted ? 'background-color: #256ef4' : ''}
            >
              <img
                src={step.icon}
                alt={step.label}
                class={isCompleted ? 'brightness-0 invert' : ''}
              />
            </button>
            <span
              class={`text-[24px] leading-[24px] font-medium ${isCompleted ? 'text-[#256ef4]' : 'text-gray-300'}`}
              >{step.label}</span
            >

            <!-- 점선 구분선 (마지막 단계 제외) -->
            {#if index < steps.length - 1}
              <div
                class="mx-4 h-px w-12 border-t border-dashed border-gray-300"
              ></div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- 다음 단계 버튼 -->
      <button
        onclick={navigateToNextStep}
        disabled={currentStepIndex === steps.length - 1}
        class="h-[52px] w-[120px] rounded-[100px] text-[20px] leading-[20px] font-semibold text-white transition-colors
				{currentStepIndex === steps.length - 1
          ? 'cursor-not-allowed bg-gray-300'
          : 'cursor-pointer bg-gray-700 hover:bg-gray-800'}"
      >
        다음 단계
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <main class="h-full flex-1 bg-gray-50">
    <div class=" mx-auto">
      {@render children?.()}
    </div>
  </main>
</div>
