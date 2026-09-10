<script lang="ts">
  import type { SCTResponseItem, SCTStem } from '../types'

  interface ResponsePatch {
    answer: string
    reason?: string | null
  }

  interface Props {
    responses: SCTResponseItem[]
    stems: SCTStem[]
    /**
     * 응답 수정 저장. 넘기지 않으면 읽기 전용으로 동작한다
     * (확정 이후처럼 더 이상 손대면 안 되는 화면).
     */
    onResponseChange?: (stemId: number, patch: ResponsePatch) => Promise<void>
  }

  let { responses, stems, onResponseChange }: Props = $props()

  let editable = $derived(Boolean(onResponseChange))

  let stemMap = $derived(new Map(stems.map((s) => [s.id, s])))
  let rows = $derived(
    responses
      .map((r) => ({
        response: r,
        stem: stemMap.get(r.stemId)
      }))
      .filter((row) => row.stem)
      .sort((a, b) => a.response.stemId - b.response.stemId)
  )

  /**
   * 문항별 편집 중인 값. 원본과 다른 항목만 담긴다.
   *
   * 저장은 저장 버튼(또는 Enter)으로만 일어난다 — blur로 암묵 저장하면
   * 편집 종료와 저장이 얽혀 같은 커밋이 두 번 실행되는 문제가 생긴다.
   */
  let answerDrafts = $state<Record<number, string>>({})
  let reasonDrafts = $state<Record<number, string>>({})
  let savingId = $state<number | null>(null)

  const norm = (v: string | null | undefined) => (v ?? '').trim()

  function currentAnswer(r: SCTResponseItem): string {
    return answerDrafts[r.stemId] ?? r.answer ?? ''
  }

  function currentReason(r: SCTResponseItem): string {
    return reasonDrafts[r.stemId] ?? r.reason ?? ''
  }

  function isDirty(r: SCTResponseItem): boolean {
    const a = answerDrafts[r.stemId]
    const b = reasonDrafts[r.stemId]
    if (a === undefined && b === undefined) return false
    return (
      norm(currentAnswer(r)) !== norm(r.answer) ||
      norm(currentReason(r)) !== norm(r.reason)
    )
  }

  function editAnswer(stemId: number, value: string) {
    answerDrafts = { ...answerDrafts, [stemId]: value }
  }

  function editReason(stemId: number, value: string) {
    reasonDrafts = { ...reasonDrafts, [stemId]: value }
  }

  function discard(stemId: number) {
    const { [stemId]: _a, ...restA } = answerDrafts
    const { [stemId]: _b, ...restB } = reasonDrafts
    answerDrafts = restA
    reasonDrafts = restB
  }

  async function save(r: SCTResponseItem, isCompound: boolean) {
    if (!isDirty(r) || savingId !== null) return

    savingId = r.stemId
    try {
      await onResponseChange?.(r.stemId, {
        answer: currentAnswer(r).trim(),
        // 복합문항이 아니면 reason을 건드리지 않는다
        ...(isCompound ? { reason: currentReason(r).trim() || null } : {})
      })
      // 저장 성공 → 서버 값이 원본이 되므로 draft를 버린다
      discard(r.stemId)
    } catch {
      // 실패 시 draft를 남겨 사용자가 다시 시도할 수 있게 둔다
    } finally {
      savingId = null
    }
  }

  function handleKeydown(e: KeyboardEvent, r: SCTResponseItem, isCompound: boolean) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save(r, isCompound)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      discard(r.stemId)
    }
  }
</script>

<table class="w-full">
  <thead class="border-b border-gray-200">
    <tr>
      <th class="w-14 py-2 text-left text-xs font-medium text-gray-500">번호</th>
      <th class="py-2 text-left text-xs font-medium text-gray-500">문항 · 응답</th>
      {#if editable}
        <!-- 저장 버튼 열 — 폭을 고정해 버튼이 생겨도 표가 흔들리지 않게 한다 -->
        <th class="w-16 py-2"><span class="sr-only">저장</span></th>
      {/if}
    </tr>
  </thead>
  <tbody>
    {#each rows as { response, stem } (response.stemId)}
      {@const dirty = isDirty(response)}
      {@const isSaving = savingId === response.stemId}
      {@const isCompound = Boolean(stem!.isCompound)}
      <tr class="border-b border-gray-100">
        <td class="py-3 align-top text-sm text-gray-500">{response.stemId}</td>
        <td class="py-3 pr-4 text-sm text-gray-700">
          <span>{stem!.stem}</span>
          {#if editable}
            <!-- 응답은 문장 안 밑줄 자리에서 바로 고친다 -->
            <input
              value={currentAnswer(response)}
              oninput={(e) => editAnswer(response.stemId, e.currentTarget.value)}
              onkeydown={(e) => handleKeydown(e, response, isCompound)}
              disabled={isSaving}
              placeholder="(미응답)"
              aria-label="{response.stemId}번 응답"
              class="mx-1 min-w-20 border-b bg-transparent px-1 text-center text-gray-900 outline-none transition-colors placeholder:text-gray-300 disabled:opacity-50
                {dirty
                ? 'border-primary-500'
                : 'border-gray-400 hover:border-primary-400 focus:border-primary-500'}"
            />
          {:else}
            <span
              class="mx-1 inline-block min-w-20 border-b border-gray-400 px-1 text-center align-baseline text-gray-900"
            >
              {#if response.answer}
                {response.answer}
              {:else}
                <span class="text-gray-300">(미응답)</span>
              {/if}
            </span>
          {/if}

          <!-- 복합문항(22·28번 등)은 '왜냐하면…' 두 번째 응답을 갖는다.
               문장의 일부이므로 줄을 바꾸지 않고 이어서 쓴다. -->
          {#if isCompound}
            <span class="text-gray-700">왜냐하면</span>
            {#if editable}
              <input
                value={currentReason(response)}
                oninput={(e) => editReason(response.stemId, e.currentTarget.value)}
                onkeydown={(e) => handleKeydown(e, response, isCompound)}
                disabled={isSaving}
                placeholder="(미응답)"
                aria-label="{response.stemId}번 이유"
                class="mx-1 min-w-20 border-b bg-transparent px-1 text-center text-gray-900 outline-none transition-colors placeholder:text-gray-300 disabled:opacity-50
                  {dirty
                  ? 'border-primary-500'
                  : 'border-gray-400 hover:border-primary-400 focus:border-primary-500'}"
              />
            {:else}
              <span
                class="mx-1 inline-block min-w-20 border-b border-gray-400 px-1 text-center align-baseline text-gray-900"
              >
                {#if response.reason}
                  {response.reason}
                {:else}
                  <span class="text-gray-300">(미응답)</span>
                {/if}
              </span>
            {/if}
          {:else if response.reason}
            <div class="mt-1 text-xs text-gray-500">
              왜냐하면: {response.reason}
            </div>
          {/if}
        </td>
        {#if editable}
          <!-- 버튼 자리를 늘 확보한다 — 나타날 때 행이 밀리면 '딸깍'거린다 -->
          <td class="py-3 pl-2 align-top">
            <button
              type="button"
              onclick={() => save(response, isCompound)}
              disabled={isSaving || !dirty}
              aria-hidden={!dirty && !isSaving}
              tabindex={dirty || isSaving ? 0 : -1}
              class="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md bg-primary-600 text-xs font-medium text-white transition-opacity hover:bg-primary-700
                {dirty || isSaving ? 'opacity-100' : 'pointer-events-none opacity-0'}"
            >
              {#if isSaving}
                <span
                  class="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white"
                ></span>
              {:else}
                저장
              {/if}
            </button>
          </td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>

{#if rows.length === 0}
  <div class="py-12 text-center text-sm text-gray-400">응답이 없습니다.</div>
{/if}
