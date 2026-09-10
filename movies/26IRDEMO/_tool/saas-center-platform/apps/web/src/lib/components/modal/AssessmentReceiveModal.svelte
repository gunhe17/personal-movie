<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientSearchDropdown from '../ClientSearchDropdown.svelte'
  import OrganizationSearchDropdown from '../OrganizationSearchDropdown.svelte'
  import Calendar from '../Calendar.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  import type { Client } from '$lib/types/client'
  import type { Organization } from '$lib/types/organization'
  import SegmentToggle from '$lib/components/SegmentToggle.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (data: {
      type: 'individual' | 'group'
      client: Client | null
      organization: Organization | null
      assessmentItems: string[]
      selectedDate: Date | null
      selectedTime: string | null
      selectedRoom: string | null
      assignedStaff: string[]
      sendNotification: boolean
    }) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    onConfirm = () => {}
  }: Props = $props()

  // 폼 상태
  let clientType = $state<'individual' | 'group'>('individual')
  let searchQuery = $state('')
  let selectedClient = $state<Client | null>(null)
  let sendNotification = $state(false)
  let isDropdownOpen = $state(false)
  let isRegisterFormOpen = $state(false)

  // 단체(기관) 관련 상태
  let groupSearchQuery = $state('')
  let selectedOrganization = $state<Organization | null>(null)
  let isGroupDropdownOpen = $state(false)
  let isGroupRegisterFormOpen = $state(false)
  let groupDropdownRef: HTMLDivElement | null = $state(null)

  // 개인/단체 전환 시 폼 초기화
  function handleTypeChange(newType: 'individual' | 'group') {
    if (newType !== clientType) {
      // 개인 폼 초기화
      searchQuery = ''
      selectedClient = null
      isDropdownOpen = false
      isRegisterFormOpen = false

      // 단체 폼 초기화
      groupSearchQuery = ''
      selectedOrganization = null
      isGroupDropdownOpen = false
      isGroupRegisterFormOpen = false

      // 공통 상태 초기화
      selectedAssessmentItems = []
      selectedDate = null
      selectedTime = null
      selectedRoom = null
      selectedStaff = []

      clientType = newType
    }
  }

  // 검사 항목 상태
  let selectedAssessmentItems = $state<string[]>([])
  const assessmentOptions = [
    '스마트폰 이용습관',
    '네오펙트',
    'ADHD 검사',
    '우울증 검사'
  ]

  // 검사 일정 상태
  let selectedDate = $state<Date | null>(null)

  // 시간 선택 상태
  let selectedTime = $state<string | null>(null)
  const morningTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  const afternoonTimes = [
    '01:00',
    '01:30',
    '02:00',
    '02:30',
    '03:00',
    '03:30',
    '04:00',
    '04:30',
    '05:00',
    '05:30'
  ]

  // 상담실 선택 상태
  let selectedRoom = $state<string | null>(null)
  const roomOptions = ['상담실 A', '상담실 B', '상담실 C']

  // 담당자 지정 상태
  let selectedStaff = $state<string[]>([])
  const staffOptions = ['원장님', '실장님', '김하연', '이연복', '한나라']

  // 입력 필드 포커스 상태
  let inputElement: HTMLInputElement | null = $state(null)
  let dropdownRef: HTMLDivElement | null = $state(null)

  // 토글 함수들
  function toggleAssessmentItem(item: string) {
    if (selectedAssessmentItems.includes(item)) {
      selectedAssessmentItems = selectedAssessmentItems.filter(
        (i) => i !== item
      )
    } else {
      selectedAssessmentItems = [...selectedAssessmentItems, item]
    }
  }

  function toggleStaff(staff: string) {
    if (selectedStaff.includes(staff)) {
      selectedStaff = selectedStaff.filter((s) => s !== staff)
    } else {
      selectedStaff = [...selectedStaff, staff]
    }
  }

  function handleClientSelect(client: Client) {
    selectedClient = client
    searchQuery = client.name
    isDropdownOpen = false
  }

  function handleChangeClient() {
    selectedClient = null
    searchQuery = ''
    isDropdownOpen = true
    // 선택 초기화
    selectedAssessmentItems = []
    selectedDate = null
    selectedTime = null
    selectedRoom = null
    selectedStaff = []
  }

  function handleRegisterSubmit(data: {
    name: string
    birthDate: string
    gender: 'male' | 'female'
    guardianPhone: string
  }) {
    // 임시 Client 객체 생성 (실제로는 API 호출 후 응답 데이터 사용)
    const newClient: Client = {
      uid: `NEW_${Date.now()}`, // 임시 ID
      role: 'client',
      name: data.name,
      gender: data.gender === 'male' ? '남자' : '여자',
      birth_date: data.birthDate ? new Date(data.birthDate) : new Date(),
      guardian_relationship: '',
      guardian_name: '',
      guardian_phone: data.guardianPhone,
      memo: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 선택된 내담자로 설정
    selectedClient = newClient

    // 드롭다운 및 등록 폼 닫기
    isDropdownOpen = false
    isRegisterFormOpen = false
  }

  function handleInputFocus() {
    isDropdownOpen = true
  }

  function handleInputBlur(event: FocusEvent) {
    if (isRegisterFormOpen) {
      return
    }
    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && dropdownRef?.contains(relatedTarget)) {
      return
    }
    setTimeout(() => {
      // 타이밍 이슈 방지: 200ms 후에도 등록 폼이 열려있는지 다시 확인
      if (!isRegisterFormOpen) {
        isDropdownOpen = false
      }
    }, 200)
  }

  function handleRegisterFormChange(isOpen: boolean) {
    isRegisterFormOpen = isOpen
  }

  function handleInputChange() {
    selectedClient = null
    isDropdownOpen = true
  }

  // 단체(기관) 관련 핸들러
  function handleOrganizationSelect(organization: Organization) {
    selectedOrganization = organization
    groupSearchQuery = organization.name
    isGroupDropdownOpen = false
  }

  function handleChangeOrganization() {
    selectedOrganization = null
    groupSearchQuery = ''
    isGroupDropdownOpen = true
    // 선택 초기화
    selectedAssessmentItems = []
    selectedDate = null
    selectedTime = null
    selectedRoom = null
    selectedStaff = []
  }

  function handleGroupRegisterSubmit(data: {
    name: string
    address: string
    phone: string
  }) {
    // 임시 Organization 객체 생성 (실제로는 API 호출 후 응답 데이터 사용)
    const newOrganization: Organization = {
      id: `NEW_${Date.now()}`,
      name: data.name,
      address: data.address,
      phone: data.phone
    }

    selectedOrganization = newOrganization
    isGroupDropdownOpen = false
    isGroupRegisterFormOpen = false
  }

  function handleGroupInputFocus() {
    isGroupDropdownOpen = true
  }

  function handleGroupInputBlur(event: FocusEvent) {
    if (isGroupRegisterFormOpen) {
      return
    }
    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && groupDropdownRef?.contains(relatedTarget)) {
      return
    }
    setTimeout(() => {
      if (!isGroupRegisterFormOpen) {
        isGroupDropdownOpen = false
      }
    }, 200)
  }

  function handleGroupRegisterFormChange(isOpen: boolean) {
    isGroupRegisterFormOpen = isOpen
  }

  function handleGroupInputChange() {
    selectedOrganization = null
    isGroupDropdownOpen = true
  }

  function handleConfirm() {
    // 개인인 경우 selectedClient 필요, 단체인 경우 selectedOrganization 필요
    if (clientType === 'individual' && !selectedClient) return
    if (clientType === 'group' && !selectedOrganization) return

    onConfirm({
      type: clientType,
      client: selectedClient,
      organization: selectedOrganization,
      assessmentItems: selectedAssessmentItems,
      selectedDate,
      selectedTime,
      selectedRoom,
      assignedStaff: selectedStaff,
      sendNotification
    })
    closeModal()
  }

  // 접수 버튼 활성화 조건
  const canSubmit = $derived(
    clientType === 'individual' ? !!selectedClient : !!selectedOrganization
  )
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={true}
  showCloseButton={true}
  size="custom500"
  containerClass="max-h-[90vh]"
  bodyClass="p-5 pb-7 overflow-y-auto max-h-[654px]"
  footerClass="px-5 pt-4 pb-5"
  title="검사를 접수할게요"
>
  {#snippet body()}
    <div class="flex flex-col gap-6">
      <!-- 개인/단체 선택 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
          >개인/단체 <span class="field-required">*</span></Typography
        >
        <SegmentToggle
          options={[
            { label: '개인', value: 'individual' },
            { label: '단체', value: 'group' }
          ]}
          value={clientType}
          onchange={(v) => handleTypeChange(v as 'individual' | 'group')}
        />
      </div>

      {#if clientType === 'individual'}
        <!-- 개인 모드 -->
        {#if selectedClient}
          <!-- 선택된 내담자 정보 카드 -->
          <div
            class="rounded-lg border border-trans-bg-green-yellow bg-trans-bg-green-yellow p-4"
          >
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <div class="h-2 w-2 rounded-full bg-green-500"></div>
                  <Typography variant="title-01-semibold" color="text-gray-900">
                    {selectedClient.name}
                  </Typography>
                  <Typography variant="body-02-regular" color="text-gray-500">
                    ({selectedClient.uid})
                  </Typography>
                </div>
                <div class="mt-2 flex flex-col gap-0.5 text-sm text-gray-600">
                  <span>생년월일: {selectedClient.birth_date || '-'}</span>
                  <span>성별: {selectedClient.gender || '-'}</span>
                  <span
                    >보호자 연락처: {selectedClient.guardian_phone || '-'}</span
                  >
                </div>
              </div>
              <button
                type="button"
                onclick={handleChangeClient}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                변경
              </button>
            </div>
          </div>

          <!-- 검사 항목 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">검사 항목</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each assessmentOptions as item}
                <button
                  type="button"
                  onclick={() => toggleAssessmentItem(item)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedAssessmentItems.includes(
                    item
                  )
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {item}
                </button>
              {/each}
            </div>
          </div>

          <!-- 검사 일정 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">검사 일정</Typography
            >
            <div class="flex items-stretch gap-6">
              <!-- 캘린더 -->
              <Calendar bind:selectedDate />

              <!-- 시간 선택 -->
              <div
                class="flex flex-1 flex-col rounded-lg border border-gray-200 p-4"
              >
                <Typography
                  variant="body-02-medium"
                  color="text-gray-700"
                  className="mb-2">시간 선택</Typography
                >
                <div class="flex-1 rounded-lg">
                  <!-- 오전 -->
                  <div class="mb-6">
                    <Typography
                      variant="label-02-regular"
                      color="text-gray-400"
                      className="mb-2">오전</Typography
                    >
                    <div class="grid grid-cols-5 gap-2">
                      {#each morningTimes as time}
                        <button
                          type="button"
                          onclick={() => (selectedTime = time)}
                          class="rounded-lg border py-2 text-sm transition-colors {selectedTime ===
                          time
                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                        >
                          {time}
                        </button>
                      {/each}
                    </div>
                  </div>
                  <!-- 오후 -->
                  <div>
                    <Typography
                      variant="label-02-regular"
                      color="text-gray-400"
                      className="mb-2">오후</Typography
                    >
                    <div class="grid grid-cols-5 gap-2">
                      {#each afternoonTimes as time}
                        <button
                          type="button"
                          onclick={() => (selectedTime = time)}
                          class="rounded-lg border py-2 text-sm transition-colors {selectedTime ===
                          time
                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                        >
                          {time}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 상담실 선택 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">상담실 선택</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each roomOptions as room}
                <button
                  type="button"
                  onclick={() => (selectedRoom = room)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedRoom ===
                  room
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {room}
                </button>
              {/each}
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-primary-50 px-4 py-2 text-sm text-primary-500 transition-colors hover:bg-primary-50"
              >
                <PlusIcon20 />
                상담실 추가
              </button>
            </div>
          </div>

          <!-- 담당자 지정 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">담당자 지정</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each staffOptions as staff}
                <button
                  type="button"
                  onclick={() => toggleStaff(staff)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedStaff.includes(
                    staff
                  )
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {staff}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <!-- 이름 검색 입력 -->
          <div
            class="transition-[min-height] duration-300 ease-out"
            style="min-height: {isRegisterFormOpen
              ? '450px'
              : isDropdownOpen
                ? '280px'
                : '0px'}"
          >
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
              >이름 <span class="field-required">*</span></Typography
            >
            <div class="relative">
              <input
                bind:this={inputElement}
                type="text"
                bind:value={searchQuery}
                oninput={handleInputChange}
                onfocus={handleInputFocus}
                onblur={handleInputBlur}
                placeholder="내담자 이름을 검색해주세요"
                class="text-body-02-normal-regular h-[52px] w-full rounded-lg border border-gray-200 px-3 focus:border-border-active focus:outline-none"
              />

              <!-- 내담자 검색 드롭다운 -->
              <div bind:this={dropdownRef}>
                <ClientSearchDropdown
                  {searchQuery}
                  onClientSelect={handleClientSelect}
                  onRegisterSubmit={handleRegisterSubmit}
                  isOpen={isDropdownOpen}
                  onRegisterFormChange={handleRegisterFormChange}
                />
              </div>
            </div>
          </div>
        {/if}
      {:else}
        <!-- 단체 모드 -->
        {#if selectedOrganization}
          <!-- 선택된 기관 정보 카드 -->
          <div
            class="rounded-lg border border-trans-bg-green-yellow bg-trans-bg-green-yellow p-4"
          >
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <div class="h-2 w-2 rounded-full bg-green-500"></div>
                  <Typography variant="title-01-semibold" color="text-gray-900">
                    {selectedOrganization.name}
                  </Typography>
                </div>
                <div class="mt-2 flex flex-col gap-0.5 text-sm text-gray-600">
                  <span>주소: {selectedOrganization.address || '-'}</span>
                  <span>연락처: {selectedOrganization.phone || '-'}</span>
                </div>
              </div>
              <button
                type="button"
                onclick={handleChangeOrganization}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                변경
              </button>
            </div>
          </div>

          <!-- 검사 항목 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">검사 항목</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each assessmentOptions as item}
                <button
                  type="button"
                  onclick={() => toggleAssessmentItem(item)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedAssessmentItems.includes(
                    item
                  )
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {item}
                </button>
              {/each}
            </div>
          </div>

          <!-- 검사 일정 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">검사 일정</Typography
            >
            <div class="flex items-stretch gap-6">
              <!-- 캘린더 -->
              <Calendar bind:selectedDate />

              <!-- 시간 선택 -->
              <div
                class="flex flex-1 flex-col rounded-lg border border-gray-200 p-4"
              >
                <Typography
                  variant="body-02-medium"
                  color="text-gray-700"
                  className="mb-2">시간 선택</Typography
                >
                <div class="flex-1 rounded-lg">
                  <!-- 오전 -->
                  <div class="mb-6">
                    <Typography
                      variant="label-02-regular"
                      color="text-gray-400"
                      className="mb-2">오전</Typography
                    >
                    <div class="grid grid-cols-5 gap-2">
                      {#each morningTimes as time}
                        <button
                          type="button"
                          onclick={() => (selectedTime = time)}
                          class="rounded-lg border py-2 text-sm transition-colors {selectedTime ===
                          time
                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                        >
                          {time}
                        </button>
                      {/each}
                    </div>
                  </div>
                  <!-- 오후 -->
                  <div>
                    <Typography
                      variant="label-02-regular"
                      color="text-gray-400"
                      className="mb-2">오후</Typography
                    >
                    <div class="grid grid-cols-5 gap-2">
                      {#each afternoonTimes as time}
                        <button
                          type="button"
                          onclick={() => (selectedTime = time)}
                          class="rounded-lg border py-2 text-sm transition-colors {selectedTime ===
                          time
                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
                        >
                          {time}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 상담실 선택 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">상담실 선택</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each roomOptions as room}
                <button
                  type="button"
                  onclick={() => (selectedRoom = room)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedRoom ===
                  room
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {room}
                </button>
              {/each}
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-primary-50 px-4 py-2 text-sm text-primary-500 transition-colors hover:bg-primary-50"
              >
                <PlusIcon20 />
                상담실 추가
              </button>
            </div>
          </div>

          <!-- 담당자 지정 -->
          <div>
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-3">담당자 지정</Typography
            >
            <div class="flex flex-wrap gap-2">
              {#each staffOptions as staff}
                <button
                  type="button"
                  onclick={() => toggleStaff(staff)}
                  class="rounded-lg border px-4 py-2 text-sm transition-colors {selectedStaff.includes(
                    staff
                  )
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
                >
                  {staff}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <!-- 단체(기관)명 검색 입력 -->
          <div
            class="transition-[min-height] duration-300 ease-out"
            style="min-height: {isGroupRegisterFormOpen
              ? '450px'
              : isGroupDropdownOpen
                ? '280px'
                : '0px'}"
          >
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2"
              >단체(기관)명 <span class="field-required">*</span></Typography
            >
            <div class="relative">
              <input
                type="text"
                bind:value={groupSearchQuery}
                oninput={handleGroupInputChange}
                onfocus={handleGroupInputFocus}
                onblur={handleGroupInputBlur}
                placeholder="기관명을 검색해주세요"
                class="text-body-02-normal-regular h-[52px] w-full rounded-lg border border-gray-200 px-3 focus:border-border-active focus:outline-none"
              />

              <!-- 기관 검색 드롭다운 -->
              <div bind:this={groupDropdownRef}>
                <OrganizationSearchDropdown
                  searchQuery={groupSearchQuery}
                  onOrganizationSelect={handleOrganizationSelect}
                  onRegisterSubmit={handleGroupRegisterSubmit}
                  isOpen={isGroupDropdownOpen}
                  onRegisterFormChange={handleGroupRegisterFormChange}
                />
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-end gap-10">
      <!-- 접수 알림톡 발송 체크박스 -->
      <button
        type="button"
        onclick={() => (sendNotification = !sendNotification)}
        class="flex items-center gap-2"
      >
        <div class="relative h-6 w-6">
          <div
            class="absolute inset-0 transition-all duration-200 {sendNotification
              ? 'scale-100 opacity-100'
              : 'scale-75 opacity-0'}"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" fill="#464C53" />
              <path
                d="M7 12L10.6008 15.75L17.5 9.5"
                stroke="#FDFDFD"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div
            class="absolute inset-0 transition-all duration-200 {sendNotification
              ? 'scale-75 opacity-0'
              : 'scale-100 opacity-100'}"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2.78125"
                y="2.78125"
                width="18.4375"
                height="18.4375"
                rx="9.21875"
                stroke="#E4E4E8"
                stroke-width="1.5625"
              />
              <path
                d="M8 12L10.8806 15L17 9"
                stroke="#E4E4E8"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <Typography variant="title-01-medium" color="text-gray-600"
          >접수 알림톡 발송</Typography
        >
      </button>

      <!-- 접수하기 버튼 -->
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!canSubmit}
        class="flex h-11 items-center justify-center rounded-lg px-8 transition-colors {canSubmit
          ? 'bg-primary-500 text-white hover:bg-primary-600'
          : 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'}"
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >접수</Typography
        >
      </button>
    </div>
  {/snippet}
</BaseModal>
