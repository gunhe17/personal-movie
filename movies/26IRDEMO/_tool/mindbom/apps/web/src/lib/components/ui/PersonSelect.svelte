<script lang="ts" module>
  export interface PersonOption {
    id: string
    name: string
    /** 이름 아래 보조 정보 — 생년월일, 역할 라벨 등 */
    sub?: string
    /** 아바타 일러스트 선택용. 없으면 이름 해시로 배정된다(PersonAvatar 규칙) */
    gender?: string | null
    /** 업로드된 프로필 사진 */
    profileUrl?: string | null
  }
</script>

<script lang="ts">
  /**
   * 사람 선택 드롭다운 — 아바타 + 2줄 옵션.
   *
   * 공용 Select와 나눠 쓰는 기준: 이름 이니셜 아바타가 붙는 "사람"이면 여기,
   * 그냥 값 목록이면 Select. (Select는 아이콘 슬롯이 없다.)
   *
   * 검사 등록의 내담자·검사자가 같은 모양이라 하나로 묶었다. 패널은 portal로
   * body에 내보낸다 — 모달 카드가 overflow-hidden이라 absolute면 잘린다.
   */
  import { fade } from 'svelte/transition'
  import Check from '$lib/assets/icons/Check.svelte'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import Close from '$lib/assets/icons/Close.svelte'
  import Search from '$lib/assets/icons/Search.svelte'
  import PersonAvatar from './PersonAvatar.svelte'
  import { portal, Z_LAYER } from '$lib/utils/positionPortal'

  let {
    options,
    value = $bindable(''),
    /** 선택된 사람의 이름 — 목록 로딩 전에도 칩을 그릴 수 있게 따로 받는다 */
    selectedName = $bindable(''),
    placeholder = '선택하세요',
    /** 입력창으로 이름을 걸러 고른다 (내담자처럼 목록이 길 때) */
    searchable = false,
    searchPlaceholder = '이름을 검색하세요',
    /** 값이 정해져 있어 바꿀 수 없는 상태 (예: 임상심리사 본인 자동 지정) */
    locked = false,
    emptyText = '항목이 없습니다',
    /**
     * 아바타 일러스트 세트 — 내담자는 캐주얼, 검사자(구성원)는 정장.
     * PersonAvatar와 같은 어휘를 쓴다(§4-x).
     */
    role = 'client',
    ariaLabel = ''
  }: {
    options: readonly PersonOption[]
    value?: string
    selectedName?: string
    placeholder?: string
    searchable?: boolean
    searchPlaceholder?: string
    locked?: boolean
    emptyText?: string
    role?: 'client' | 'counselor'
    ariaLabel?: string
  } = $props()

  let open = $state(false)
  let search = $state('')
  let triggerEl = $state<HTMLElement | null>(null)

  let filtered = $derived(
    searchable && search
      ? options.filter((o) => o.name.includes(search))
      : options
  )

  /**
   * 선택된 사람의 원본 옵션 — 칩의 아바타에 성별·사진을 넘기려면 필요하다.
   * 목록 로딩 전이면 없을 수 있고, 그때는 selectedName만으로 그린다
   * (PersonAvatar가 이름 해시로 일러스트를 고르므로 이름만으로도 성립).
   */
  const selectedOption = $derived(options.find((o) => o.id === value))

  function pick(option: PersonOption) {
    value = option.id
    selectedName = option.name
    search = ''
    open = false
  }

  function clear() {
    value = ''
    selectedName = ''
    search = ''
  }
</script>

{#if selectedName}
  <!-- 선택됨 — 칩 형태. 높이는 필드 표준 h-11(§2-3)로 입력창과 맞춘다. -->
  <div
    class="flex h-11 items-center justify-between rounded-lg border border-gray-200 bg-white px-3 {locked
      ? 'opacity-90'
      : ''}"
  >
    <div class="flex min-w-0 items-center gap-2">
      <PersonAvatar
        name={selectedName}
        gender={selectedOption?.gender}
        profileUrl={selectedOption?.profileUrl}
        {role}
        size={24}
      />
      <span class="truncate text-body-02-normal-regular text-gray-900">{selectedName}</span>
    </div>
    {#if !locked}
      <button
        type="button"
        aria-label="선택 해제"
        onclick={clear}
        class="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <Close size={16} />
      </button>
    {/if}
  </div>
{:else}
  <div class="relative" bind:this={triggerEl}>
    {#if searchable}
      <Search
        size={16}
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        bind:value={search}
        onfocus={() => (open = true)}
        placeholder={searchPlaceholder}
        aria-label={ariaLabel}
        class="h-11 w-full rounded-lg border bg-white pl-9 pr-3 text-body-02-normal-regular text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400
          {open ? 'border-primary-500' : 'border-gray-200'}"
      />
    {:else}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onclick={() => (open = !open)}
        class="flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-body-02-normal-regular transition-colors
          {open ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'}"
      >
        <!-- 빈 상태를 native ::placeholder처럼 — Select와 같은 규칙(§4-3) -->
        <span class="font-normal text-gray-400">{placeholder}</span>
        <!-- Select와 같은 열림 표시 (§4-3) -->
        <ChevronToggle {open} size={18} class="shrink-0 text-icon-secondary" />
      </button>
    {/if}

    {#if open}
      <!-- 바깥 클릭 닫기는 portal의 callback이 처리한다 -->
      <div
        role="listbox"
        transition:fade={{ duration: 100 }}
        use:portal={{
          anchor: triggerEl!,
          zIndex: Z_LAYER.portalDropdown,
          callback: () => (open = false)
        }}
        class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-popup"
      >
        {#if filtered.length === 0}
          <div class="px-3 py-4 text-center text-body-02-normal-regular text-gray-400">
            {search ? '검색 결과가 없습니다' : emptyText}
          </div>
        {:else}
          {#each filtered as option (option.id)}
            <button
              type="button"
              role="option"
              aria-selected={value === option.id}
              onclick={() => pick(option)}
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <PersonAvatar
                  name={option.name}
                  gender={option.gender}
                  profileUrl={option.profileUrl}
                  {role}
                  size={28}
                />
                <div class="min-w-0">
                  <p class="truncate text-body-02-normal-medium text-gray-900">{option.name}</p>
                  {#if option.sub}
                    <p class="truncate text-label-02-normal-regular text-gray-400">{option.sub}</p>
                  {/if}
                </div>
              </div>
              {#if value === option.id}
                <Check size={16} class="shrink-0 text-primary-500" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
{/if}
