<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import AssessmentFlowHeader from '$lib/components/assessment-flow/AssessmentFlowHeader.svelte'
  import Typography from '@common/components/Typography.svelte'

  const centerId = $derived(page.params.centerId ?? '')

  interface ClientSearchResult {
    id: string
    name: string
    birth_date: string | null
    phone: string | null
    role: string
  }

  let name = $state('')
  let birthdate = $state('')
  let loading = $state(false)
  let error = $state('')
  let searchResults = $state<ClientSearchResult[] | null>(null)

  function parseBirthdate(input: string): string | null {
    const cleaned = input.replace(/\s/g, '').replace(/\./g, '-')
    const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (!match) return null
    const [, y, m, d] = match
    const year = parseInt(y!, 10)
    const month = parseInt(m!, 10)
    const day = parseInt(d!, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }

  async function searchClients(): Promise<ClientSearchResult[]> {
    const birthdateIso = parseBirthdate(birthdate)
    if (!birthdateIso) {
      throw new Error(
        '생년월일을 올바르게 입력해주세요 (예: 2010-03-15 또는 2010. 03. 15)'
      )
    }
    const params = new URLSearchParams({
      name: name.trim(),
      birthdate: birthdateIso
    })
    const res = await fetch(
      `/api/assessment/proxy/centers/${centerId}/clients/search?${params}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? err.message ?? '검색에 실패했습니다.')
    }
    return res.json()
  }

  function formatBirthdate(d: string | null): string {
    if (!d) return '-'
    return d.replace(/-/g, '. ')
  }

  function handleSelectClient(clientId: string) {
    goto(`/assessment-flow/centers/${centerId}/cases?clientId=${clientId}`)
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!name.trim()) {
      error = '이름을 입력해주세요.'
      return
    }
    if (!birthdate.trim()) {
      error = '생년월일을 입력해주세요.'
      return
    }
    loading = true
    error = ''
    searchResults = null
    try {
      const clients = await searchClients()
      if (clients.length === 0) {
        snackbarStore.success('입력하신 정보와 일치하는 내담자가 없습니다.')
        return
      }
      if (clients.length === 1) {
        snackbarStore.success(`${clients[0].name}님, 환영합니다`)
        handleSelectClient(clients[0].id)
        return
      }
      searchResults = clients
    } catch (e) {
      error = e instanceof Error ? e.message : '검색에 실패했습니다.'
    } finally {
      loading = false
    }
  }

  function handleBirthdateInput(e: Event) {
    const input = e.target as HTMLInputElement
    const raw = input.value.replace(/\D/g, '').slice(0, 8)
    let formatted = raw
    if (raw.length > 4 && raw.length <= 6) {
      formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`
    }
    birthdate = formatted
    input.value = formatted
  }

  function handleReset() {
    searchResults = null
    error = ''
  }
</script>

<svelte:head>
  <title>내담자 신원 확인 - 검사 진행</title>
</svelte:head>

<div class="min-h-screen bg-[#F6F6F6] flex flex-col">
  <AssessmentFlowHeader />

  <main
    class="flex-1 flex justify-center items-center px-4 sm:px-8 py-6 w-full min-w-0"
  >
    <section class="w-full max-w-md mx-auto">
      {#if searchResults && searchResults.length > 1}
        <!-- 동명이인 선택 UI -->
        <h2 class="text-2xl font-bold text-gray-800 text-center mb-6">
          여러 명이 검색되었습니다
        </h2>
        <p class="text-sm text-gray-600 text-center mb-8">
          본인을 선택해주세요
        </p>
        <div class="space-y-4">
          {#each searchResults as client}
            <article
              class="w-full rounded-lg bg-white border border-gray-200 p-5"
            >
              <div class="flex flex-col gap-1">
                <p class="text-lg font-semibold text-gray-800">
                  {client.name} ({formatBirthdate(client.birth_date)})
                </p>
                {#if client.phone}
                  <p class="text-sm text-gray-600">
                    연락처: {client.phone}
                  </p>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => handleSelectClient(client.id)}
                class="mt-4 min-h-[44px] h-11 w-full rounded-md bg-[#737373] text-white font-semibold touch-manipulation"
              >
                본인 선택
              </button>
            </article>
          {/each}
        </div>
        <div class="mt-6 flex justify-center gap-4">
          <button
            type="button"
            onclick={handleReset}
            class="min-h-[44px] h-11 px-6 rounded-md border border-gray-300 text-gray-700 touch-manipulation"
          >
            다시 입력
          </button>
        </div>
      {:else}
        <!-- 입력 폼 -->
        <Typography
          variant="headline-01-reading-bold"
          className="whitespace-pre-line mb-6"
          color="text-gray-900"
        >
          {`검사 진행을 위해 \n 정보를 입력해주세요`}
        </Typography>
        <form class="space-y-6" onsubmit={handleSubmit}>
          <div>
            <Typography variant="body-02-medium" color="text-gray-700">
              이름
            </Typography>
            <input
              id="name"
              type="text"
              autocomplete="name"
              bind:value={name}
              placeholder="이름을 입력해주세요"
              class="mt-2 h-[48px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-3 outline-none placeholder:text-[#aeb3bb] focus:border-gray-400"
            />
          </div>
          <div>
            <Typography variant="body-02-medium" color="text-gray-700">
              생년월일
            </Typography>
            <input
              id="birthdate"
              type="text"
              inputmode="numeric"
              bind:value={birthdate}
              oninput={handleBirthdateInput}
              placeholder="YYYY-MM-DD"
              maxlength={10}
              class="mt-2 h-[48px] w-full rounded-[12px] border border-[#e5e7eb] bg-white px-3 outline-none placeholder:text-[#aeb3bb] focus:border-gray-400"
            />
          </div>
          {#if error}
            <p class="text-sm text-red-600">{error}</p>
          {/if}
          <button
            type="submit"
            disabled={loading}
            class="min-h-[44px] h-[52px] w-full bg-etc-orange rounded-[8px] text-xl sm:text-[25px] text-white font-semibold disabled:opacity-60 touch-manipulation"
          >
            <Typography
              variant="title-01-semibold"
              className="whitespace-pre-line"
              color="text-white"
            >
              {loading ? '검색 중...' : '다음'}
            </Typography>
          </button>
        </form>
      {/if}
    </section>
  </main>
</div>
