<script lang="ts">
  import { t, josa } from '$lib/ontology/terms'
  import { onMount } from 'svelte'

  import { queryBuilder } from '../hooks/queries/builder'
  import {
    getClientList,
    type ClientListItem
  } from '../hooks/actions/client.action'

  import type { Client } from '../types/client'

  import { dateToString } from '$lib/utils/date'

  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import { centerId } from '../stores/center.store'
  import { buildClientListInput, useClientFilters } from '../features/clients'
  import { page } from '$app/state'
  import { canAccess } from '$lib/stores/permission.view'
  import { CLIENT_CREATE_RULE } from '$lib/features/clients/permissions'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    searchQuery: string
    onClientSelect: (client: Client) => void
    onRegisterClick?: () => void
    onRegisterSubmit?: (data: {
      name: string
      birthDate: string
      gender: 'male' | 'female'
      guardianPhone: string
      organization: string
      guardianName: string
      guardianRelationship: string
      guardianEmail: string
      address: string
    }) => void
    isOpen: boolean
    onRegisterFormChange?: (isOpen: boolean) => void
    onClose?: () => void
    // 수정 모드 관련
    isEditMode?: boolean
    editData?: {
      name: string
      birthDate: string
      gender: 'male' | 'female'
      guardianPhone: string
      organization: string
      guardianName: string
      guardianRelationship: string
      guardianEmail: string
      address: string
    }
    onEditCancel?: () => void
    // 등록 옵션 표시 여부
    showRegisterOption?: boolean
  }

  let {
    searchQuery,
    onClientSelect,
    onRegisterClick,
    onRegisterSubmit,
    isOpen,
    onRegisterFormChange,
    onClose,
    isEditMode = false,
    editData,
    onEditCancel,
    showRegisterOption = true
  }: Props = $props()

  // write:client 권한이 없으면 '새 내담자 등록' affordance를 숨긴다.
  // (/clients 목록의 CLIENT_CREATE_RULE 게이팅과 동일 기준 — 접수/청구/일정 등 모든 진입점 일괄 적용)
  const canShowRegister = $derived(
    showRegisterOption && $canAccess(CLIENT_CREATE_RULE)
  )

  const pathname = page.url.pathname
  const filters = useClientFilters(page.url, pathname)
  // 드롭다운 컨테이너 참조
  let dropdownContainerRef: HTMLDivElement | null = $state(null)

  // 외부 클릭 감지
  onMount(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        dropdownContainerRef &&
        !dropdownContainerRef.contains(event.target as Node)
      ) {
        showRegisterForm = false
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  })

  // 전체 내담자 목록 조회
  // USE_MOCK 플래그에 따라 목데이터/실제 API 자동 전환
  const clientsQuery = $derived(
    queryBuilder(getClientList, () => ({
      ...buildClientListInput($centerId!, filters.buildFilters()),
      status: 'active' as const
    }))
  )

  const clients = $derived<ClientListItem[]>(clientsQuery.data?.items ?? [])
  let showRegisterForm = $state(false)
  // 등록 폼 상태
  let registerName = $state('')
  let registerBirthDate = $state('')
  let registerGender = $state<'male' | 'female'>('male')
  let registerGuardianPhone = $state('')
  let registerOrganization = $state('')
  let registerGuardianName = $state('')
  let registerGuardianRelationship = $state('')
  let registerGuardianEmail = $state('')
  let registerAddress = $state('')

  // 관계 옵션
  const relationshipOptions = ['부', '모', '조부', '조모', '기타']

  // 수정 모드일 때 폼 데이터 초기화
  $effect(() => {
    if (isEditMode && editData) {
      showRegisterForm = true
      registerName = editData.name
      registerBirthDate = editData.birthDate
      registerGender = editData.gender
      registerGuardianPhone = editData.guardianPhone
      registerOrganization = editData.organization
      registerGuardianName = editData.guardianName
      registerGuardianRelationship = editData.guardianRelationship || ''
      registerGuardianEmail = editData.guardianEmail
      registerAddress = editData.address
      onRegisterFormChange?.(true)
    }
  })

  // 학교 검색 관련 상태
  let isSchoolDropdownOpen = $state(false)
  let schoolDropdownRef: HTMLDivElement | null = $state(null)
  let highlightedSchoolIndex = $state(-1)

  // 더미 학교 데이터 (실제로는 API에서 가져옴)
  const dummySchools = [
    { id: '1', name: '서울초등학교', address: '서울시 강남구' },
    { id: '2', name: '서울중학교', address: '서울시 서초구' },
    { id: '3', name: '강남초등학교', address: '서울시 강남구' },
    { id: '4', name: '역삼초등학교', address: '서울시 강남구' },
    { id: '5', name: '대치초등학교', address: '서울시 강남구' },
    { id: '6', name: '삼성초등학교', address: '서울시 강남구' },
    { id: '7', name: '언주초등학교', address: '서울시 강남구' }
  ]

  // 학교 검색 필터링
  let filteredSchools = $derived(
    registerOrganization.trim() === ''
      ? []
      : dummySchools.filter((school) =>
          school.name.toLowerCase().includes(registerOrganization.toLowerCase())
        )
  )

  // 검색어에 따라 필터링
  let displayClients = $derived(
    clients.length === 0
      ? []
      : clients.filter(
          (client) =>
            client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
  )

  // 등록 폼 열기
  function openRegisterForm() {
    showRegisterForm = true
    registerName = searchQuery
    registerBirthDate = ''
    registerGender = 'male'
    registerGuardianPhone = ''
    registerOrganization = ''
    registerGuardianName = ''
    registerGuardianRelationship = ''
    registerGuardianEmail = ''
    registerAddress = ''
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
    const hasGuardianInput =
      !!registerGuardianName.trim() || !!registerGuardianRelationship
    if (hasGuardianInput && !registerGuardianPhone.trim()) {
      snackbarStore.error('보호자 연락처를 입력해주세요.')
      return
    }
    if (onRegisterSubmit) {
      onRegisterSubmit({
        name: registerName,
        birthDate: registerBirthDate,
        gender: registerGender,
        guardianPhone: registerGuardianPhone,
        organization: registerOrganization,
        guardianName: registerGuardianName,
        guardianRelationship: registerGuardianRelationship,
        guardianEmail: registerGuardianEmail,
        address: registerAddress
      })
    } else if (onRegisterClick) {
      onRegisterClick()
    }
    closeRegisterForm()
  }

  // 생년월일 자동 포맷팅 (YYYY-MM-DD)
  function handleBirthDateInput(e: Event) {
    const input = e.target as HTMLInputElement
    // 숫자만 추출
    let numbers = input.value.replace(/[^0-9]/g, '')

    // 8자리 제한
    numbers = numbers.slice(0, 8)

    // 포맷팅 (YYYY-MM-DD)
    if (numbers.length <= 4) {
      registerBirthDate = numbers
    } else if (numbers.length <= 6) {
      registerBirthDate = `${numbers.slice(0, 4)}-${numbers.slice(4)}`
    } else {
      registerBirthDate = `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6)}`
    }
  }

  // 학교 검색 핸들러
  function handleSchoolInputFocus() {
    isSchoolDropdownOpen = true
    highlightedSchoolIndex = 0
  }

  const mapClientListItemToClient = (item: ClientListItem): Client => {
    return {
      uid: item.id || '',
      role: item.role || '',
      name: item.name || '',
      gender: item.gender === '여자' ? '여자' : '남자',
      birth_date: item.birth_date ? new Date(item.birth_date) : new Date(),
      guardian_relationship: '',
      guardian_name: '',
      guardian_phone: item.phone || '',
      memo: item.memo || '',
      created_at: item.created_at || '',
      updated_at: item.updated_at || ''
    }
  }

  function handleSchoolInput() {
    highlightedSchoolIndex = 0
  }

  function handleSchoolInputBlur(event: FocusEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && schoolDropdownRef?.contains(relatedTarget)) {
      return
    }
    setTimeout(() => {
      isSchoolDropdownOpen = false
    }, 150)
  }

  function handleSchoolSelect(school: {
    id: string
    name: string
    address: string
  }) {
    registerOrganization = school.name
    isSchoolDropdownOpen = false
    highlightedSchoolIndex = -1
  }

  // 학교 검색 키보드 네비게이션
  function handleSchoolKeydown(event: KeyboardEvent) {
    if (!isSchoolDropdownOpen || filteredSchools.length === 0) {
      // 드롭다운이 닫혀있을 때 아래 화살표로 열기
      if (event.key === 'ArrowDown' && filteredSchools.length > 0) {
        isSchoolDropdownOpen = true
        highlightedSchoolIndex = 0
        event.preventDefault()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        highlightedSchoolIndex = Math.min(
          highlightedSchoolIndex + 1,
          filteredSchools.length - 1
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        highlightedSchoolIndex = Math.max(highlightedSchoolIndex - 1, 0)
        break
      case 'Enter':
        event.preventDefault()
        if (
          highlightedSchoolIndex >= 0 &&
          highlightedSchoolIndex < filteredSchools.length
        ) {
          handleSchoolSelect(filteredSchools[highlightedSchoolIndex])
        }
        break
      case 'Escape':
        event.preventDefault()
        isSchoolDropdownOpen = false
        highlightedSchoolIndex = -1
        break
    }
  }

  // 하이라이트된 항목이 보이도록 스크롤
  $effect(() => {
    if (highlightedSchoolIndex >= 0) {
      const element = document.getElementById(
        `school-option-${highlightedSchoolIndex}`
      )
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
</script>

<div
  bind:this={dropdownContainerRef}
  class="{isEditMode
    ? 'relative'
    : 'absolute top-full right-0 left-0 z-50 mt-1'} origin-top rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg transition-all duration-150 ease-out
    {isOpen
    ? 'visible scale-y-100 opacity-100'
    : 'invisible scale-y-0 opacity-0'}"
>
  {#if showRegisterForm}
    <!-- 인라인 등록/수정 폼 -->
    <div class="flex flex-col gap-5 bg-white p-5">
      <!-- 헤더 -->
      <Typography variant="body-01-semibold" color="text-gray-700"
        >{isEditMode ? '내담자 정보 수정' : '내담자 추가'}</Typography
      >
      <!-- 그리드 폼 -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-5">
        <!-- Row 1: 이름*, 성별* -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
          >
            이름 <span class="field-required">*</span>
          </Typography>
          <input
            type="text"
            bind:value={registerName}
            placeholder="이름을 입력해주세요"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >성별 <span class="field-required">*</span></Typography
          >
          <div class="flex flex-1 items-center gap-6">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="registerGender"
                value="male"
                checked={registerGender === 'male'}
                onchange={() => (registerGender = 'male')}
                class="h-5 w-5 cursor-pointer accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default">남</Typography
              >
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="registerGender"
                value="female"
                checked={registerGender === 'female'}
                onchange={() => (registerGender = 'female')}
                class="h-5 w-5 cursor-pointer accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default">여</Typography
              >
            </label>
          </div>
        </div>

        <!-- Row 2: 생년월일*, 소속(학교) -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >생년월일 <span class="field-required">*</span></Typography
          >
          <div class="relative flex-1">
            <input
              type="text"
              inputmode="numeric"
              value={registerBirthDate}
              oninput={handleBirthDateInput}
              placeholder="YYYY-MM-DD"
              class="text-body-02-normal-regular h-[44px] w-full rounded-lg border border-gray-200 bg-white px-2.5 pr-10 focus:border-border-active focus:outline-none"
            />
            <div
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect
                  x="2"
                  y="3"
                  width="16"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path d="M2 7H18" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M6 1V4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <path
                  d="M14 1V4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0">소속(학교)</Typography
          >
          <div class="relative flex-1" bind:this={schoolDropdownRef}>
            <input
              type="text"
              bind:value={registerOrganization}
              onfocus={handleSchoolInputFocus}
              onblur={handleSchoolInputBlur}
              oninput={handleSchoolInput}
              onkeydown={handleSchoolKeydown}
              placeholder="소속을 검색해주세요"
              role="combobox"
              aria-expanded={isSchoolDropdownOpen && filteredSchools.length > 0}
              aria-controls="school-listbox"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-activedescendant={highlightedSchoolIndex >= 0
                ? `school-option-${highlightedSchoolIndex}`
                : undefined}
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

            <!-- 학교 검색 드롭다운 -->
            {#if isSchoolDropdownOpen && filteredSchools.length > 0}
              <div
                id="school-listbox"
                role="listbox"
                class="dropdown-panel absolute top-full right-0 left-0 z-50 mt-1 max-h-50 overflow-y-auto"
              >
                {#each filteredSchools as school, index}
                  <button
                    type="button"
                    id="school-option-{index}"
                    role="option"
                    aria-selected={highlightedSchoolIndex === index}
                    onclick={() => handleSchoolSelect(school)}
                    onmouseenter={() => (highlightedSchoolIndex = index)}
                    class="dropdown-item {highlightedSchoolIndex === index
                      ? 'is-selected'
                      : ''}"
                  >
                    <Typography
                      variant="body-02-medium"
                      color={highlightedSchoolIndex === index
                        ? 'text-primary-600'
                        : 'text-gray-700'}
                    >
                      {school.name}
                    </Typography>
                    <Typography
                      variant="label-02-regular"
                      color="text-gray-400"
                    >
                      {school.address}
                    </Typography>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Row 3: 보호자 이름, 관계* -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0">보호자 이름</Typography
          >
          <input
            type="text"
            bind:value={registerGuardianName}
            placeholder="이름을 입력해주세요"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >관계 <span class="field-required">*</span></Typography
          >
          <div class="relative flex-1">
            <select
              bind:value={registerGuardianRelationship}
              class="text-body-02-normal-regular h-[44px] w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 pr-10 focus:border-border-active focus:outline-none {registerGuardianRelationship
                ? 'text-gray-700'
                : 'text-gray-400'}"
            >
              <option value="" disabled>관계 선택</option>
              {#each relationshipOptions as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
            <div
              class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- Row 4: 보호자 연락처*, 주소* -->
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >보호자 연락처 <span class="field-required">*</span></Typography
          >
          <input
            type="tel"
            bind:value={registerGuardianPhone}
            placeholder="보호자 연락처를 입력해주세요"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
        <div class="flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0"
            >주소 <span class="field-required">*</span></Typography
          >
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

        <!-- Row 5: 이메일 (전체 너비) -->
        <div class="col-span-2 flex items-center gap-3">
          <Typography
            variant="body-02-medium"
            color="text-gray-500"
            className="w-24 shrink-0">이메일</Typography
          >
          <input
            type="email"
            bind:value={registerGuardianEmail}
            placeholder="이메일을 입력해주세요"
            class="text-body-02-normal-regular h-[44px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 focus:border-border-active focus:outline-none"
          />
        </div>
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
  {:else if displayClients.length > 0}
    <!-- Client(내담자) 검색 결과 리스트 -->
    <div class="max-h-70 overflow-y-auto p-2">
      {#each displayClients as client}
        <button
          type="button"
          onclick={() => onClientSelect(mapClientListItemToClient(client))}
          class="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-50"
        >
          <!-- 아바타 — 내담자 최소 단위 규격(성별 톤 + 프로필/이니셜) -->
          <ClientAvatar
            profileImageUrl={client.profile_image_url}
            name={client.name}
            gender={client.gender}
            sizeClass="h-9 w-9"
            textClass="text-[13px]"
          />
          <!-- 이름, ID, 생년월일, 성별, 보호자 관계·이름, 연락처 -->
          <div
            class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5"
          >
            <Typography
              variant="body-01-semibold"
              color="text-gray-800"
              className="truncate-safe"
            >
              {client.name}
            </Typography>
            {#if client.id}
              <BadgeRectangle label={client.id} size="sm" />
            {/if}
            {#if client.birth_date}
              <Typography
                variant="body-02-normal-regular"
                color="text-body-default"
              >
                {dateToString(client.birth_date, 'YYYY-MM-DD')}
              </Typography>
            {/if}
            {#if client.gender}
              {#if client.birth_date}
                <span class="h-3 w-px shrink-0 bg-gray-300" aria-hidden="true"
                ></span>
              {/if}
              <Typography
                variant="body-02-normal-regular"
                color="text-body-default"
              >
                {client.gender === '여자' ? '여' : '남'}
              </Typography>
            {/if}
            {#if client.guardian_relationship || client.guardian_name || client.phone}
              {#if client.guardian_relationship}
                <span
                  class="inline-flex items-center rounded-md border border-pink-200 bg-gray-50 px-1.5 py-0.5 text-body-03-normal-regular text-gray-700"
                >
                  {client.guardian_relationship}
                </span>
              {/if}
              {#if client.guardian_name}
                <Typography variant="body-02-regular" color="text-gray-700">
                  {client.guardian_name}
                </Typography>
              {/if}
              {#if client.phone}
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-default"
                >
                  {client.phone}
                </Typography>
              {/if}
            {/if}
          </div>
        </button>
      {/each}
    </div>
    {#if canShowRegister}
      <div
        class="flex items-center justify-center gap-2 border-t border-border-subtle py-4"
      >
        <Typography variant="body-02-normal-regular" color="text-body-default"
          >찾는 {josa(t('subject'), '이/가')} 없나요?</Typography
        >
        <button
          onclick={openRegisterForm}
          class="flex items-center gap-2 text-action-primary hover:underline"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current"
            >새 {t('subject')} 등록</Typography
          >
        </button>
      </div>
    {/if}
  {:else}
    <!-- 검색 결과 없음 -->
    <div class="mt-2 flex flex-col items-center justify-center gap-4 p-4">
      <Typography variant="body-02-normal-regular" color="text-body-default">
        {canShowRegister
          ? `등록된 ${josa(t('subject'), '이/가')} 없어요`
          : '검색 결과가 없어요'}
      </Typography>
      {#if canShowRegister}
        <button
          onclick={openRegisterForm}
          class="flex items-center gap-2 text-action-primary hover:underline"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current">
            새 {t('subject')} 등록
          </Typography>
        </button>
      {/if}
    </div>
  {/if}
</div>
