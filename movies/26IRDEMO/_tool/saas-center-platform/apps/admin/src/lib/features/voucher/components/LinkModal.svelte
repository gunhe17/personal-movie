<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import { getVoucherList, getDocumentList } from '$hooks/actions/voucher.action'

  type Mode = 'fromVoucher' | 'fromDocument'

  interface Props {
    /** 양방향 진입 표시 */
    mode: Mode
    /** 이미 연결되어 제외할 카운터파트 id 목록 */
    excludeIds?: string[]
    onConfirm?: (payload: {
      id: string
      page_range: [number, number] | null
      /** 모달이 보여준 카운터파트 항목 그대로 (이름/형식/연도 등 표시용) */
      pickedItem: any
    }) => Promise<void> | void
    /* injected by modalStore */
    modalId?: string
    closeModal?: () => void
  }

  let {
    mode,
    excludeIds = [],
    onConfirm,
    closeModal = () => {}
  }: Props = $props()

  // ─── 검색 + 디바운스 ───
  let search = $state('')
  let debouncedSearch = $state('')
  let timer: ReturnType<typeof setTimeout>
  $effect(() => {
    clearTimeout(timer)
    const q = search
    timer = setTimeout(() => (debouncedSearch = q), 300)
  })

  // ─── 리스트 쿼리 (mode에 맞춰 카운터파트 조회) ───
  const counterpartQuery = $derived(
    mode === 'fromVoucher'
      ? queryBuilder<any, any>(getDocumentList, () => ({
          q: debouncedSearch || undefined,
          page: 1,
          size: 50
        }))
      : queryBuilder<any, any>(getVoucherList, () => ({
          q: debouncedSearch || undefined,
          page: 1,
          size: 50
        }))
  )

  const items = $derived(
    (counterpartQuery.data?.items ?? []).filter(
      (it: any) => !excludeIds.includes(it.id) && !it.deleted_at
    )
  )

  // ─── 선택 + 페이지 + 메모 ───
  let selectedId = $state<string | null>(null)
  let pageStart = $state<string>('')
  let pageEnd = $state<string>('')
  let submitting = $state(false)

  const canSubmit = $derived(selectedId !== null && !submitting)

  function buildPageRange(): [number, number] | null {
    const a = pageStart.trim()
    const b = pageEnd.trim()
    if (!a || !b) return null
    const low = Number(a)
    const high = Number(b)
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null
    if (low < 0 || high < 0) return null
    if (low > high) return null
    return [Math.trunc(low), Math.trunc(high)]
  }

  async function handleConfirm() {
    if (!selectedId) return
    const picked = items.find((it: any) => it.id === selectedId)
    submitting = true
    try {
      await onConfirm?.({
        id: selectedId,
        page_range: buildPageRange(),
        pickedItem: picked
      })
      closeModal()
    } finally {
      submitting = false
    }
  }

  const title = $derived(mode === 'fromVoucher' ? '자료 연결' : '바우처 연결')
  const subjectLabel = $derived(mode === 'fromVoucher' ? '자료' : '바우처')
</script>

<BaseModal {closeModal} size="md">
  {#snippet header()}
    <div class="px-6 py-4">
      <Typography variant="title-01-normal-semibold" tag="h2">{title}</Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4 px-6 py-4">
      <!-- 검색 -->
      <div
        class="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4"
      >
        <SearchIcon />
        <input
          type="text"
          placeholder="{subjectLabel} 이름으로 검색"
          bind:value={search}
          class="w-full text-sm placeholder:text-gray-400 outline-none"
        />
      </div>

      <!-- 리스트 (라디오 선택) -->
      <div class="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
        {#if counterpartQuery.isPending}
          <div class="py-10 text-center text-sm text-gray-400">불러오는 중...</div>
        {:else if items.length === 0}
          <div class="py-10 text-center text-sm text-gray-400">
            {debouncedSearch ? '검색 결과가 없습니다' : '연결 가능한 항목이 없습니다'}
          </div>
        {:else}
          <ul class="divide-y divide-gray-100">
            {#each items as item (item.id)}
              <li>
                <label
                  class="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="link-target"
                    value={item.id}
                    bind:group={selectedId}
                    class="mt-1"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </div>
                    {#if mode === 'fromVoucher'}
                      <div class="mt-0.5 text-xs uppercase text-gray-500">
                        {item.file_type ?? '-'}
                      </div>
                    {:else}
                      <div class="mt-0.5 text-xs text-gray-500">
                        {item.program_organization} · {item.program_year}년
                      </div>
                    {/if}
                  </div>
                </label>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- 페이지 범위 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-gray-700">
          페이지 범위
          <span class="ml-1 text-xs font-normal text-gray-400"
            >(선택, 자료 내 인쇄 페이지 — 둘 다 입력 시 inclusive [low, high])</span
          >
        </label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="시작"
            bind:value={pageStart}
            class="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary-500"
          />
          <span class="text-gray-400">-</span>
          <input
            type="number"
            min="0"
            placeholder="끝"
            bind:value={pageEnd}
            class="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-2 px-6 py-4">
      <button
        type="button"
        onclick={closeModal}
        class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        취소
      </button>
      <Button
        color="primary"
        size="md"
        content={submitting ? '연결 중...' : '연결'}
        disabled={!canSubmit}
        onclick={handleConfirm}
      />
    </div>
  {/snippet}
</BaseModal>
