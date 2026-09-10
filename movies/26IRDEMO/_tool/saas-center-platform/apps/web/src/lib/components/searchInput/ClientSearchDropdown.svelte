<style>
  .client-dropdown-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .client-dropdown-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .client-dropdown-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  .client-dropdown-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'

  import {
    getClientList,
    type ClientListItem
  } from '../../hooks/actions/client.action'
  import { centerId } from '../../stores/center.store'
  import { dateToString } from '../../utils/date'

  import TrashIcon from '../../assets/TrashIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'

  interface Props {
    searchQuery: string
    selected: ClientListItem | null
    onClientSelect: (client: ClientListItem) => void
    onClientDelete: (client: ClientListItem | null) => void
    showDelete?: boolean
    /** lg(기본): h-13/rounded-lg, md: 모달 인풋 크기 맞춤 h-10/rounded-lg */
    size?: 'md' | 'lg'
  }

  let {
    searchQuery = $bindable(),
    selected,
    onClientSelect,
    onClientDelete,
    showDelete = true,
    size = 'lg'
  }: Props = $props()

  const selectedBoxClass = $derived(
    size === 'md' ? 'h-12 px-3 rounded-lg' : 'px-3 py-3 rounded-lg'
  )
  const avatarClass = $derived(size === 'md' ? 'h-8 w-8' : 'h-9 w-9')
  const avatarTextClass = $derived(
    size === 'md' ? 'text-[12px]' : 'text-[13px]'
  )

  const SEARCH_DEBOUNCE_MS = 250
  const SEARCH_LIMIT = 20

  let displayClients = $state<ClientListItem[]>([])
  let isDropdownOpen = $state<boolean>(false)
  let isLoading = $state<boolean>(false)
  let debouncedQuery = $state('')
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  // 무한 스크롤 — 바닥에 닿으면 다음 20명을 이어붙인다(페이지 이동 없음)
  let loadedPage = $state(0)
  let hasMore = $state(false)
  let listEl = $state<HTMLDivElement | null>(null)
  // 늦게 도착한 이전 요청이 최신 목록을 덮어쓰지 않도록 순번으로 가른다
  let requestSeq = 0

  // searchQuery 변경 시 debounce 후 debouncedQuery에 반영
  $effect(() => {
    const q = searchQuery
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedQuery = q
    }, SEARCH_DEBOUNCE_MS)
  })

  async function fetchPage(targetPage: number, query: string, append: boolean) {
    const cid = $centerId
    if (!cid) return
    const seq = ++requestSeq
    isLoading = true
    try {
      const res = await getClientList().request({
        centerId: cid,
        search: query || undefined,
        limit: SEARCH_LIMIT,
        skip: (targetPage - 1) * SEARCH_LIMIT
      })
      if (seq !== requestSeq) return
      const items = res.items ?? []
      displayClients = append ? [...displayClients, ...items] : items
      loadedPage = targetPage
      hasMore = displayClients.length < (res.total ?? 0) && items.length > 0
    } catch {
      if (seq !== requestSeq) return
      if (!append) displayClients = []
      hasMore = false
    } finally {
      if (seq === requestSeq) isLoading = false
    }
  }

  /** 바닥이 한 화면의 1/3 남았을 때 미리 당겨온다 — 스크롤이 끊기지 않게 */
  function handleListScroll(e: Event) {
    if (isLoading || !hasMore) return
    const el = e.currentTarget as HTMLDivElement
    const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight)
    if (remaining < el.clientHeight / 3) {
      fetchPage(loadedPage + 1, debouncedQuery.trim(), true)
    }
  }

  // 드롭다운이 열리거나 검색어가 바뀌면 첫 페이지부터 다시 — 목록을 갈아끼운다
  $effect(() => {
    if (!isDropdownOpen) return
    if (!$centerId) return
    const q = debouncedQuery.trim()
    fetchPage(1, q, false)
    if (listEl) listEl.scrollTop = 0
  })

  /** 성별 표기는 생년월일과 같은 gray — 성별에 색을 입히지 않는다(내담자 최소 단위 규격) */
  function getGenderLabel(gender: string | null | undefined): string | null {
    if (!gender) return null
    const g = gender.toLowerCase()
    if (g === '여자' || g === 'female' || g === 'f') return '여'
    if (g === '남자' || g === 'male' || g === 'm') return '남'
    return null
  }

  const handleClientSearchFocus = () => {
    isDropdownOpen = true
  }

  const handleClientSearchBlur = () => {
    setTimeout(() => {
      isDropdownOpen = false
    }, 200)
  }
</script>

<div class="relative">
  {#if selected}
    <!-- 선택된 내담자 표시 -->
    <div
      class="flex w-full items-center border border-gray-200 bg-gray-50 {selectedBoxClass}"
    >
      <div class="flex grow items-center gap-2">
        <ClientAvatar
          profileImageUrl={selected.profile_image_url}
          name={selected.name}
          gender={selected.gender}
          sizeClass="shrink-0 {avatarClass}"
          textClass={avatarTextClass}
        />
        <div class="flex items-center gap-x-2 text-body-02-normal-regular">
          <Typography
            variant="body-01-semibold"
            color="text-gray-800"
            className="shrink-0 truncate-safe"
          >
            {selected.name}
          </Typography>
          {#if selected.id}
            <BadgeRectangle
              label={selected.id.length >= 12
                ? selected.id.slice(0, 6)
                : selected.id}
              size="sm"
            />
          {/if}
          {#if selected.birth_date}
            <span class="shrink-0 text-gray-500">
              {dateToString(selected.birth_date, 'YYYY-MM-DD')}
            </span>
          {/if}
          {#if getGenderLabel(selected.gender)}
            {#if selected.birth_date}
              <span class="h-3.5 w-px shrink-0 bg-gray-300" aria-hidden="true"
              ></span>
            {/if}
            <span class="shrink-0 text-gray-500"
              >{getGenderLabel(selected.gender)}</span
            >
          {/if}
        </div>
      </div>
      {#if showDelete}
        <button
          onclick={() => onClientDelete(selected)}
          class="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 transition"
        >
          <TrashIcon />
        </button>
      {/if}
    </div>
  {:else}
    <!-- 검색 입력 -->
    <input
      type="text"
      autocomplete="off"
      onfocus={handleClientSearchFocus}
      onblur={handleClientSearchBlur}
      bind:value={searchQuery}
      placeholder="내담자 이름을 검색해주세요"
      class="field-input"
    />
    {#if isDropdownOpen}
      <div
        class="dropdown-panel max-h-none overflow-hidden absolute top-full right-0 left-0 z-50 mt-1"
        transition:slide={{ duration: 200, easing: quintOut }}
      >
        {#if displayClients.length > 0}
          <div
            bind:this={listEl}
            onscroll={handleListScroll}
            class="client-dropdown-scroll dropdown-list max-h-80 overflow-y-auto"
          >
            {#each displayClients as client}
              {@const displayId =
                client.id?.length >= 12
                  ? client.id.slice(0, 6)
                  : (client.id ?? '')}
              {@const genderInfo = getGenderLabel(client.gender)}
              <button
                onclick={() => onClientSelect(client)}
                class="dropdown-item h-auto justify-start gap-2 py-2"
              >
                <ClientAvatar
                  profileImageUrl={client.profile_image_url}
                  name={client.name}
                  gender={client.gender}
                  sizeClass="h-9 w-9"
                  textClass="text-[13px]"
                />
                <div
                  class="flex min-w-0 flex-1 items-center gap-x-2 gap-y-0.5 text-body-02-normal-medium"
                >
                  <Typography
                    variant="body-01-semibold"
                    color="text-gray-800"
                    className="shrink-0 truncate-safe"
                  >
                    {client.name}
                  </Typography>
                  {#if displayId}
                    <BadgeRectangle label={displayId} size="sm" />
                  {/if}
                  {#if client.birth_date}
                    <span class="shrink-0 text-gray-500">
                      {dateToString(client.birth_date, 'YYYY-MM-DD')}
                    </span>
                  {/if}
                  {#if genderInfo}
                    {#if client.birth_date}
                      <span
                        class="h-3.5 w-px shrink-0 bg-gray-300"
                        aria-hidden="true"
                      ></span>
                    {/if}
                    <span class="shrink-0 text-gray-500">{genderInfo}</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <div class="flex items-center justify-center p-8">
            <Typography variant="body-02-medium" color="text-gray-400">
              {isLoading ? '검색 중...' : '검색 결과가 없습니다'}
            </Typography>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
