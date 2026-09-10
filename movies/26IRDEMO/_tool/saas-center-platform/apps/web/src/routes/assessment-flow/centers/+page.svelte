<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { get } from 'svelte/store'
  import {
    assessmentCenterStore,
    type AssessmentCenterSummary
  } from '$lib/stores/assessment-center.store'
  import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'
  import {
    fetchAssessmentCenters,
    selectAssessmentCenter,
    logoutAssessmentFlow
  } from '$lib/features/assessment-login/service'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'

  let centers = $state<AssessmentCenterSummary[]>([])
  let loading = $state(true)
  let loggedInUserName = $state('')

  onMount(() => {
    let unsubAuth: (() => void) | undefined
    let unsubCenters: (() => void) | undefined

    void (async () => {
      assessmentCenterStore.initialize()
      const authState = get(assessmentAuthStore)
      loggedInUserName = authState.user?.name ?? ''
      loading = true
      const result = await fetchAssessmentCenters()
      centers = result.centers
      loading = false

      if (result.autoSelected && result.centers.length === 1) {
        await selectAssessmentCenter(result.centers[0].id)
        return
      }

      unsubAuth = assessmentAuthStore.subscribe((s) => {
        loggedInUserName = s.user?.name ?? ''
      })
      unsubCenters = assessmentCenterStore.subscribe((s) => {
        centers = s.centers
      })
    })()

    return () => {
      unsubAuth?.()
      unsubCenters?.()
    }
  })

  async function handleCenterSelect(centerId: string) {
    await selectAssessmentCenter(centerId)
  }

  async function handleSwitchAccount() {
    await logoutAssessmentFlow()
    await goto('/assessment-flow/login')
  }
</script>

<svelte:head>
  <title>센터 선택</title>
</svelte:head>

<div class="h-screen bg-[#e5e5e7]">
  <AssessmentFlowHeader />

  <main
    class="mx-auto max-w-[1160px] px-4 sm:px-8 py-12 sm:py-24 w-full min-h-[calc(100vh-44px)] flex justify-center items-center min-w-0"
  >
    <section class="max-w-3xl mx-auto text-center pt-6 sm:pt-10 w-full">
      <h2 class="text-2xl sm:text-4xl font-bold text-gray-800">
        아래 센터에서 검사를 진행할게요
      </h2>

      {#if loading}
        <div class="mt-10 text-gray-600">센터 목록을 불러오는 중입니다...</div>
      {:else}
        <div class="mt-10 flex flex-col gap-4 items-center">
          {#if centers.length === 0}
            <p class="text-gray-600">진행 가능한 센터가 없습니다.</p>
            <button
              type="button"
              onclick={handleSwitchAccount}
              class="h-11 px-6 rounded-md border border-gray-300 text-gray-700"
            >
              다른 계정으로 로그인
            </button>
          {:else}
            {#each centers as center}
              <article
                class="w-full max-w-lg rounded-lg bg-white border border-gray-200 p-6"
              >
                <div class="flex items-center gap-4 justify-center">
                  <div
                    class="h-12 w-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500"
                  >
                    {center.name.slice(0, 1)}
                  </div>
                  <div class="text-left">
                    <p class="text-lg font-semibold text-gray-800">
                      {center.name}
                    </p>
                    <p class="text-sm text-gray-500 mt-1">
                      로그인 계정 <span class="text-gray-700"
                        >{loggedInUserName}</span
                      >
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onclick={() => handleCenterSelect(center.id)}
                  class="mt-5 min-h-[44px] h-12 w-full rounded-md bg-[#737373] text-white font-semibold touch-manipulation"
                >
                  진행
                </button>
              </article>
            {/each}

            <button
              type="button"
              onclick={handleSwitchAccount}
              class="h-11 px-6 rounded-md border border-gray-300 text-gray-700"
            >
              다른 계정으로 로그인
            </button>
          {/if}
        </div>
      {/if}
    </section>
  </main>
</div>
