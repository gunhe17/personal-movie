<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'

  const centerId = $derived(page.params.centerId ?? '')

  let name = $state('')
  let birthdate = $state('')
  let loading = $state(false)
  let error = $state('')
  let taskId = $state<string | null>(null)

  onMount(async () => {
    const fromUrl = new URLSearchParams(window.location?.search ?? '').get(
      'taskId'
    )
    if (fromUrl) {
      taskId = fromUrl
      return
    }
    try {
      const res = await fetch(
        `/api/assessment/proxy/centers/${centerId}/center-assessments?is_active=true`
      )
      if (!res.ok) return
      const list = await res.json()
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0] as { assessment_id?: string; id?: string }
        taskId = first.assessment_id ?? first.id ?? null
      }
    } catch {
      // ignore
    }
  })

  async function fetchTask(usedTaskId: string) {
    const url = `/api/assessment/proxy/centers/${centerId}/tasks/${usedTaskId}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message ?? '검사 조회에 실패했습니다.')
    }
    return res.json()
  }

  async function handleNext() {
    if (!name.trim()) {
      error = '이름을 입력해주세요.'
      return
    }
    if (!birthdate.trim()) {
      error = '생년월일을 입력해주세요.'
      return
    }
    const usedTaskId = taskId
    if (!usedTaskId) {
      error = '검사 정보를 불러올 수 없습니다.'
      return
    }
    loading = true
    error = ''
    try {
      await fetchTask(usedTaskId)
      await goto('/assessment-flow/receive')
    } catch (e) {
      error = e instanceof Error ? e.message : '검사 조회에 실패했습니다.'
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>검사 진행 - 정보 입력</title>
</svelte:head>

<div class="min-h-screen bg-[#e5e5e7]">
  <AssessmentFlowHeader />

  <main
    class="mx-auto max-w-[1160px] px-8 py-16 w-full flex justify-center items-center"
  >
    <section class="w-full max-w-md mx-auto">
      <h2 class="text-2xl font-bold text-gray-800 text-center mb-10">
        검사 진행을 위해 정보를 입력해주세요
      </h2>

      <form
        class="space-y-6"
        onsubmit={(e) => {
          e.preventDefault()
          handleNext()
        }}
      >
        <div>
          <label
            for="name"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            이름
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            placeholder="이름을 입력해주세요"
            class="w-full h-12 rounded-lg border border-gray-300 bg-white px-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-gray-400"
          />
        </div>
        <div>
          <label
            for="birthdate"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            생년월일
          </label>
          <input
            id="birthdate"
            type="text"
            bind:value={birthdate}
            placeholder="YYYY. MM. DD"
            class="w-full h-12 rounded-lg border border-gray-300 bg-white px-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-gray-400"
          />
        </div>
        {#if error}
          <p class="text-sm text-red-600">{error}</p>
        {/if}
        <button
          type="submit"
          disabled={loading}
          class="w-full h-12 rounded-lg bg-[#737373] text-white font-semibold disabled:opacity-60"
        >
          {loading ? '처리 중...' : '다음'}
        </button>
      </form>
    </section>
  </main>
</div>
