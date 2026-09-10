<script lang="ts">
  import axios from 'axios'
  import { page } from '$app/state'
  import FormFillBody from '$lib/components/form/FormFillBody.svelte'

  // 보호자용 원격 작성 링크 — 로그인 없이 문자 코드로 열어 작성·제출한다.
  // 대부분 휴대폰으로 연다: 좁은 폭·큰 터치 타깃·하단 고정 제출을 기본으로 둔다.
  const instanceId = $derived(page.params.instanceId!)

  type Phase = 'verify' | 'fill' | 'done'
  let phase = $state<Phase>('verify')
  let code = $state('')
  let error = $state('')
  let busy = $state(false)

  let accessToken = ''
  let centerName = $state('')
  let formName = $state('')
  let schema = $state<any>(null)
  let answers = $state<Record<string, string | string[]>>({})

  const pageImageUrl = (no: number) => {
    const pg = (schema?.pages ?? []).find((p: any) => p.no === no)
    return pg?.image_url ? `/api/proxy${pg.image_url}` : ''
  }

  async function verify() {
    if (code.length !== 4 || busy) return
    busy = true
    error = ''
    try {
      const res = await axios.post(`/api/proxy/form-links/${instanceId}/verify`, {
        verification_code: code
      })
      accessToken = res.data.access_token
      centerName = res.data.center_name
      formName = res.data.form_name
      schema = res.data.schema
      const initial: Record<string, string | string[]> = {}
      for (const v of res.data.values ?? []) initial[v.field_key] = v.value?.value ?? ''
      answers = initial
      phase = 'fill'
    } catch (e: any) {
      error = e?.response?.data?.detail ?? '인증에 실패했어요. 코드를 확인해주세요.'
    } finally {
      busy = false
    }
  }

  async function submit() {
    if (busy) return
    busy = true
    error = ''
    try {
      const values = Object.entries(answers)
        .filter(([, v]) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0))
        .map(([field_key, value]) => ({ field_key, value: { value } }))
      await axios.post(
        `/api/proxy/form-links/${instanceId}/submit`,
        { values },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      phase = 'done'
    } catch (e: any) {
      error = e?.response?.data?.detail ?? '제출에 실패했어요. 잠시 후 다시 시도해주세요.'
    } finally {
      busy = false
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  {#if phase === 'verify'}
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div class="space-y-1.5 text-center">
          <h1 class="text-headline-02-normal-semibold text-gray-900">서식 작성</h1>
          <p class="text-body-02-normal-regular text-gray-500">
            문자로 받은 4자리 인증코드를 입력해주세요.
          </p>
        </div>
        <input
          inputmode="numeric"
          maxlength="4"
          bind:value={code}
          placeholder="0000"
          onkeydown={(e) => e.key === 'Enter' && verify()}
          class="mt-6 w-full rounded-lg border border-gray-200 py-3.5 text-center text-headline-01-normal-semibold tracking-[0.5em] text-gray-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
        />
        {#if error}
          <p class="mt-2 text-body-03-normal-regular text-red-600">{error}</p>
        {/if}
        <button
          onclick={verify}
          disabled={code.length !== 4 || busy}
          class="mt-5 h-11 w-full rounded-lg bg-primary-500 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? '확인 중...' : '확인'}
        </button>
      </div>
    </div>
  {:else if phase === 'fill'}
    <div class="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div class="mb-4">
        <p class="text-label-01-normal-medium text-gray-400">{centerName}</p>
        <h1 class="mt-0.5 text-headline-02-normal-semibold text-gray-900">{formName}</h1>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <FormFillBody {schema} bind:answers {pageImageUrl} />
      </div>
      {#if error}
        <p class="mt-3 text-body-03-normal-regular text-red-600">{error}</p>
      {/if}
    </div>
    <!-- 하단 고정 제출 — 휴대폰에서 스크롤 끝까지 안 가도 제출 가능 -->
    <div class="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto max-w-3xl">
        <button
          onclick={submit}
          disabled={busy}
          class="h-11 w-full rounded-lg bg-primary-500 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? '제출 중...' : '제출하기'}
        </button>
      </div>
    </div>
  {:else}
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6 text-primary-500">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="space-y-1">
          <h1 class="text-headline-02-normal-semibold text-gray-900">제출이 완료되었어요</h1>
          <p class="text-body-02-normal-regular text-gray-500">작성해주셔서 감사합니다.</p>
        </div>
      </div>
    </div>
  {/if}
</div>
