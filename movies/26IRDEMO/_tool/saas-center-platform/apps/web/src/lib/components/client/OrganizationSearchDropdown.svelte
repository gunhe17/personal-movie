<style>
  /* 스크롤바 스타일링 */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'

  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { Organization } from '../../types/organization'
  import { portal } from '../../utils/positionPortal'
  import NoDataSection from '../NoDataSection.svelte'

  interface Props {
    searchQuery: string
    onOrganizationSelect: (organization: Organization) => void
    onRegisterSubmit?: (data: {
      name: string
      address: string
      phone: string
    }) => void
    isOpen: boolean
    onRegisterFormChange?: (isOpen: boolean) => void
    onClose?: () => void
    containerElement?: HTMLElement | null
    // 수정 모드 관련
    isEditMode?: boolean
    editData?: {
      name: string
      address: string
      phone: string
    }
    onEditCancel?: () => void
  }

  let {
    searchQuery,
    onOrganizationSelect,
    onRegisterSubmit,
    isOpen,
    onRegisterFormChange,
    onClose,
    containerElement = null,
    isEditMode = false,
    editData,
    onEditCancel
  }: Props = $props()

  // 바깥 클릭 감지
  function handleClickOutside(event: MouseEvent) {
    if (
      isOpen &&
      containerElement &&
      !containerElement.contains(event.target as Node)
    ) {
      onClose?.()
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside, true)
    return () => {
      document.removeEventListener('click', handleClickOutside, true)
    }
  })

  // 더미 기관 데이터 (실제로는 API에서 가져옴)
  const dummyOrganizations: Organization[] = [
    {
      id: '1',
      name: '뽈라지역아동센터',
      address: '경기도 의정부시 평화로 449 3층 (의정부동)',
      phone: '031-875-3009'
    },
    {
      id: '2',
      name: '뽈라지역아동센터',
      address: '경기도 의정부시 평화로 449 3층 (의정부동)',
      phone: '031-875-3009'
    },
    {
      id: '3',
      name: '가경지역아동센터',
      address: '충청북도 청주시 흥덕구 장구봉로 20-0 2층(가경동 1493-4) 가경동',
      phone: '043-231-9681'
    }
  ]

  let showRegisterForm = $state(false)

  // 등록 폼 상태
  let registerName = $state('')
  let registerAddress = $state('')
  let registerPhone = $state('')

  // 수정 모드일 때 폼 데이터 초기화
  $effect(() => {
    if (isEditMode && editData) {
      showRegisterForm = true
      registerName = editData.name
      registerAddress = editData.address
      registerPhone = editData.phone
      onRegisterFormChange?.(true)
    }
  })

  // 검색어에 따라 필터링
  let displayOrganizations = $derived(
    searchQuery.trim() === ''
      ? []
      : dummyOrganizations.filter(
          (org) =>
            org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            org.address.toLowerCase().includes(searchQuery.toLowerCase())
        )
  )

  // 등록 폼 열기
  function openRegisterForm() {
    showRegisterForm = true
    registerName = ''
    registerAddress = ''
    registerPhone = ''
    onRegisterFormChange?.(true)
  }

  // 등록 폼 닫기
  function closeRegisterForm() {
    if (isEditMode) {
      onEditCancel?.()
    }
    showRegisterForm = false
    onRegisterFormChange?.(false)
  }

  // 등록 제출
  function handleRegisterSubmit() {
    if (onRegisterSubmit && registerName.trim()) {
      onRegisterSubmit({
        name: registerName,
        address: registerAddress,
        phone: registerPhone
      })
    }
    closeRegisterForm()
  }
</script>

{#if isOpen && containerElement}
  <div
    transition:slide={{ duration: 300, easing: quintOut }}
    use:portal={{
      offset: 6,
      anchor: containerElement
    }}
    class="dropdown-panel max-h-none overflow-hidden z-20000"
  >
    {#if showRegisterForm}
      <!-- 인라인 등록/수정 폼 -->
      <div class="flex flex-col gap-5 bg-white p-5">
        <!-- 헤더 -->
        <Typography variant="body-01-semibold" color="text-gray-700"
          >{isEditMode ? '단체(기관명) 수정' : '단체(기관명) 추가'}</Typography
        >
        <!-- 단체(기관)명 -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >단체(기관명) <span class="field-required">*</span></Typography
          >
          <input
            type="text"
            bind:value={registerName}
            placeholder="이름을 입력해주세요"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
        <!-- 주소 -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
          >
            주소 <span class="field-required">*</span>
          </Typography>
          <div class="relative flex-1">
            <input
              type="text"
              bind:value={registerAddress}
              placeholder="주소를 검색해주세요"
              class="text-body-02-normal-regular h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 pr-10 focus:border-border-active focus:outline-none"
            />
            <div
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M9.58366 17.5C13.9559 17.5 17.5003 13.9556 17.5003 9.58333C17.5003 5.21108 13.9559 1.66667 9.58366 1.66667C5.2114 1.66667 1.66699 5.21108 1.66699 9.58333C1.66699 13.9556 5.2114 17.5 9.58366 17.5Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M18.3337 18.3333L16.667 16.6667"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
        <!-- 연락처 -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0">연락처</Typography
          >
          <input
            type="tel"
            bind:value={registerPhone}
            placeholder="02-0000-0000"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
        <!-- 버튼 영역 -->
        <div class="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onclick={closeRegisterForm}
            class="flex h-10 w-20 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          >
            <Typography variant="body-02-medium" color="text-gray-600"
              >취소</Typography
            >
          </button>
          <button
            type="button"
            onclick={handleRegisterSubmit}
            disabled={!registerName.trim()}
            class="flex h-10 w-20 items-center justify-center rounded-lg bg-primary-400 text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-primary-100"
          >
            <Typography variant="body-02-medium" color="text-white"
              >{isEditMode ? '수정' : '등록'}</Typography
            >
          </button>
        </div>
      </div>
    {:else if displayOrganizations.length > 0}
      <!-- 검색 결과 리스트 -->
      <div class="dropdown-list max-h-70 overflow-y-auto">
        {#each displayOrganizations as org}
          <button
            onclick={() => onOrganizationSelect(org)}
            class="dropdown-item h-auto justify-start gap-3 py-2"
          >
            <!-- 기관 정보 -->
            <Typography
              variant="body-02-medium"
              color="text-gray-800"
              className="shrink-0">{org.name}</Typography
            >
            <!-- 위치 아이콘 -->
            <div class="flex items-center gap-1 text-red-400">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 7.5C7.82843 7.5 8.5 6.82843 8.5 6C8.5 5.17157 7.82843 4.5 7 4.5C6.17157 4.5 5.5 5.17157 5.5 6C5.5 6.82843 6.17157 7.5 7 7.5Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <path
                  d="M7 12.5C9.5 10.5 11.5 8.31371 11.5 6C11.5 3.51472 9.48528 1.5 7 1.5C4.51472 1.5 2.5 3.51472 2.5 6C2.5 8.31371 4.5 10.5 7 12.5Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
              </svg>
              <span class="text-body-03-normal-regular text-gray-500"
                >{org.address}</span
              >
            </div>
            <!-- 전화 아이콘 -->
            <div class="flex shrink-0 items-center gap-1 text-primary-500">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M12.8332 9.89333V11.5267C12.8339 11.6826 12.8021 11.837 12.7398 11.9802C12.6776 12.1234 12.5864 12.2522 12.4718 12.3585C12.3573 12.4649 12.2219 12.5465 12.074 12.5981C11.9262 12.6497 11.7692 12.6701 11.6132 12.6581C9.82019 12.4635 8.0978 11.8579 6.58324 10.8896C5.17235 10.0074 3.97248 8.80753 3.0902 7.39665C2.11842 5.87536 1.51257 4.14503 1.3216 2.34468C1.30969 2.18924 1.32981 2.033 1.38099 1.88573C1.43217 1.73847 1.51323 1.60348 1.61889 1.48927C1.72455 1.37506 1.85249 1.28403 1.99488 1.22162C2.13727 1.1592 2.29086 1.12688 2.4462 1.12665H4.07954C4.34954 1.12393 4.6113 1.21883 4.81729 1.39416C5.02329 1.56949 5.15946 1.8134 5.20087 2.0804C5.27796 2.61373 5.41422 3.13695 5.60704 3.64C5.68282 3.83677 5.69984 4.05205 5.65608 4.25847C5.61231 4.46489 5.50957 4.65362 5.36024 4.8044L4.66807 5.49656C5.48516 6.93421 6.68239 8.13144 8.12004 8.94853L8.8122 8.25636C8.96298 8.10703 9.15171 8.00429 9.35813 7.96052C9.56455 7.91676 9.77983 7.93378 9.9766 8.00956C10.4797 8.20238 11.0029 8.33864 11.5362 8.41573C11.8063 8.45756 12.0526 8.59621 12.2283 8.80595C12.404 9.01569 12.4972 9.28177 12.4906 9.55493L12.8332 9.89333Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span class="text-body-03-normal-regular text-gray-500"
                >{org.phone}</span
              >
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="h-12 bg-gray-50"></div>
    {/if}
    <!-- 검색어 입력 안내 -->
    <div
      class="flex items-center justify-center gap-2 py-4 border-t border-border-subtle"
    >
      <Typography variant="body-02-normal-regular" color="text-body-default">
        찾는 단체(기관)가 없나요?
      </Typography>
      <button
        onclick={openRegisterForm}
        class="flex items-center gap-2 text-action-primary transition-colors hover:text-action-primary-hover"
      >
        <PlusIcon20 />
        <Typography variant="body-02-normal-medium" color="text-current">
          새 단체(기관) 등록
        </Typography>
      </button>
    </div>
  </div>
{/if}
