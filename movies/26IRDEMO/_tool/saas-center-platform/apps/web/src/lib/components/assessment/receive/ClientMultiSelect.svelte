<style>
  .client-multiselect-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .client-multiselect-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .client-multiselect-scroll::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: 3px;
  }
  .client-multiselect-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--color-icon-secondary);
  }
</style>

<script lang="ts">
  import { t, josa, has } from '$lib/ontology/terms'
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { portal } from '$lib/utils/positionPortal'
  import type { ClientListItem } from '$lib/hooks/actions/client.action'
  import type { ExtendedClient } from '$lib/stores/receiveForm'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import CircleClose from '$lib/assets/CircleClose.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { GUARDIAN_RELATION_OPTIONS } from '$lib/features/clients/register/constants'
  import CircleClose16 from '$root/src/lib/assets/CircleClose16.svelte'
  import { canAccess } from '$lib/stores/permission.view'
  import { CLIENT_CREATE_RULE } from '$lib/features/clients/permissions'

  function mapClientListItemToExtendedClient(
    item: ClientListItem
  ): ExtendedClient {
    return {
      uid: item.id ?? '',
      role: item.role ?? '',
      name: item.name ?? '',
      gender:
        item.gender === '여자' || item.gender === 'female' ? '여자' : '남자',
      birth_date: item.birth_date ? new Date(item.birth_date) : null,
      guardian_relationship: item.guardian_relationship ?? '',
      guardian_name: item.guardian_name ?? '',
      guardian_phone: item.phone ?? '',
      memo: item.memo ?? '',
      created_at: item.created_at ?? '',
      updated_at: item.updated_at ?? ''
    }
  }

  interface Props {
    /** 내담자 후보 목록 (ClientListItem) */
    options: ClientListItem[]
    /** 선택된 내담자 (bindable, ExtendedClient[]) */
    selected?: ExtendedClient[]
    label?: string
    required?: boolean
    placeholder?: string
    /** 최대 선택 개수. 없으면 무제한. 개인 접수는 1 */
    maxSelection?: number
    /** 편집 모드: 검색/변경 불가, 선택된 내담자만 표시 */
    readOnly?: boolean
    /** 하단에 '찾는 내담자가 없나요? + 새 내담자 등록' 노출 여부 */
    showRegisterOption?: boolean
    /** 새 내담자 등록 클릭 시 (모달 열기 등). onRegisterSubmit 없을 때만 사용 */
    onRegisterClick?: () => void
    /** 드롭다운 내 인라인 등록 폼 제출 시 (드롭다운이 폼 뷰로 전환된 경우) */
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
      addressDetail: string
    }) => void | Promise<void>
    /** 드롭다운 열릴 때 콜백 (목록 갱신 등) */
    onOpen?: () => void
    /** 드롭다운 닫힐 때 콜백 (선택 확정 후 다음 단계 진행 등) */
    onClose?: () => void
    /** 라벨 Typography variant (기본: title-01-semibold) */
    labelVariant?: string
    /** 유효성 검증 에러 상태 (빨간 border 표시) */
    hasError?: boolean
    /** 루트 하단 마진(mb-8) 제거. 부모가 space-y 등으로 간격을 직접 관리할 때 사용. */
    disableBottomMargin?: boolean
    /** 검색 input 텍스트 스타일 override (기본: text-title-02-normal-regular) */
    searchInputTextClass?: string
  }

  let {
    options,
    selected = $bindable([]),
    label = t('subject'),
    required = false,
    placeholder = `${t('subject')} 이름을 검색해주세요`,
    maxSelection,
    readOnly = false,
    showRegisterOption = false,
    onRegisterClick,
    onRegisterSubmit,
    onOpen,
    onClose,
    labelVariant = 'title-01-semibold',
    hasError = false,
    disableBottomMargin = false,
    searchInputTextClass = 'text-title-02-normal-regular'
  }: Props = $props()

  let searchQuery = $state('')
  let isDropdownOpen = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  /** 드롭다운이 리스트 대신 '내담자 추가' 폼으로 전환된 상태 */
  let showRegisterForm = $state(false)

  // 인라인 등록 폼 상태
  let registerName = $state('')
  let registerBirthDate = $state('')
  let registerGender = $state<'male' | 'female'>('male')
  let registerGuardianPhone = $state('')
  let registerOrganization = $state('')
  let registerGuardianName = $state('')
  let registerGuardianRelationship = $state('')
  let registerGuardianEmail = $state('')
  let registerAddress = $state('')
  let registerAddressDetail = $state('')
  let isAddressSearching = $state(false)

  // 관계 커스텀 드롭다운 (포털 충돌 방지용 인라인 구현)
  let isRelationOpen = $state(false)
  let relationBtnEl = $state<HTMLButtonElement | null>(null)
  let relationWrapEl = $state<HTMLDivElement | null>(null)
  let relationListStyle = $state('')

  function toggleRelation() {
    if (isRelationOpen) {
      isRelationOpen = false
    } else if (relationBtnEl) {
      const rect = relationBtnEl.getBoundingClientRect()
      relationListStyle = `top:${rect.bottom + 4}px;left:${rect.left}px;width:${rect.width}px;`
      isRelationOpen = true
    }
  }

  $effect(() => {
    if (!isRelationOpen) return
    function onDocClick(e: MouseEvent) {
      if (!relationWrapEl?.contains(e.target as Node)) {
        isRelationOpen = false
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  })

  function formatPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  function openAddressSearch() {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        registerAddress =
          data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  function openRegisterForm() {
    showRegisterForm = true
    registerName = searchQuery.trim()
    registerBirthDate = ''
    registerGender = 'male'
    registerGuardianPhone = ''
    registerOrganization = ''
    registerGuardianName = ''
    registerGuardianRelationship = ''
    registerGuardianEmail = ''
    registerAddress = ''
    registerAddressDetail = ''
  }

  function closeRegisterForm() {
    showRegisterForm = false
  }

  function handleBirthDateInput(e: Event) {
    const input = e.target as HTMLInputElement
    let numbers = input.value.replace(/[^0-9]/g, '').slice(0, 8)
    if (numbers.length <= 4) {
      registerBirthDate = numbers
    } else if (numbers.length <= 6) {
      registerBirthDate = `${numbers.slice(0, 4)}-${numbers.slice(4)}`
    } else {
      registerBirthDate = `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6)}`
    }
  }

  /** 생년월일 8자리 + 유효한 Date 파싱 여부 */
  function parseBirthDate(value: string): Date | null {
    const clean = value.replace(/-/g, '')
    if (clean.length !== 8) return null
    const parsed = new Date(
      `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6)}`
    )
    return !isNaN(parsed.getTime()) ? parsed : null
  }

  const isValidBirthDate = $derived(parseBirthDate(registerBirthDate) !== null)

  /** 보호자 연락처: 숫자 9~11자리 */
  function validateGuardianPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 9 && digits.length <= 11
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  function validateEmail(value: string): boolean {
    if (!value.trim()) return true
    return EMAIL_REGEX.test(value.trim())
  }

  async function handleRegisterSubmit() {
    if (!onRegisterSubmit) return

    const birth = parseBirthDate(registerBirthDate)
    if (!birth) {
      snackbarStore.error('생년월일을 YYYY-MM-DD 형식으로 입력해주세요.')
      return
    }
    const hasGuardianInput =
      !!registerGuardianName.trim() || !!registerGuardianRelationship
    if (hasGuardianInput && !registerGuardianPhone.trim()) {
      snackbarStore.error(`${t('guardian')} 연락처를 입력해주세요.`)
      return
    }
    if (
      registerGuardianPhone.trim() &&
      !validateGuardianPhone(registerGuardianPhone)
    ) {
      snackbarStore.error(
        `${t('guardian')} 연락처는 숫자 9~11자리로 입력해주세요.`
      )
      return
    }
    if (!validateEmail(registerGuardianEmail)) {
      snackbarStore.error('이메일 형식을 확인해주세요.')
      return
    }

    const data = {
      name: registerName.trim(),
      birthDate: registerBirthDate,
      gender: registerGender,
      guardianPhone: registerGuardianPhone,
      organization: registerOrganization,
      guardianName: registerGuardianName,
      guardianRelationship: registerGuardianRelationship,
      guardianEmail: registerGuardianEmail,
      address: registerAddress,
      addressDetail: registerAddressDetail
    }
    await onRegisterSubmit(data)
    closeRegisterForm()
    isDropdownOpen = false
  }

  const displayOptions = $derived(
    searchQuery.trim() === ''
      ? options
      : options.filter((c) =>
          (c.name ?? '')
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase())
        )
  )

  const isItemSelected = (id: string) => selected.some((c) => c.uid === id)

  function toggleSelected(item: ClientListItem) {
    const ext = mapClientListItemToExtendedClient(item)
    const exists = selected.some((c) => c.uid === ext.uid)
    if (exists) {
      selected = selected.filter((c) => c.uid !== ext.uid)
    } else {
      if (maxSelection != null && selected.length >= maxSelection) {
        if (maxSelection === 1) selected = [ext]
        else return
      } else {
        selected = [...selected, ext]
      }
    }
  }

  function handleFocus() {
    if (readOnly) return
    isDropdownOpen = true
    onOpen?.()
  }

  function handleClose() {
    searchQuery = ''
    isDropdownOpen = false
    showRegisterForm = false
    onClose?.()
  }

  function removeFromSelected(client: ExtendedClient) {
    selected = selected.filter((c) => c.uid !== client.uid)
  }
</script>

<div class={disableBottomMargin ? '' : 'mb-8'}>
  {#if label}
    <Typography
      variant={labelVariant as any}
      color="text-body-default"
      className="mb-2"
    >
      {label}
      {#if required}<span class="field-required">*</span>{/if}
    </Typography>
  {/if}
  {#if readOnly}
    <div
      class="text-title-02-normal-regular flex h-13 w-full items-center rounded-lg border border-border-default bg-gray-50 px-4 text-title-subtitle"
    >
      {#if selected.length > 0}
        {selected.map((c) => c.name).join(', ')}
        <span class="ml-2 text-body-02-normal-regular text-caption-subtle"
          >(선택됨)</span
        >
      {:else}
        -
      {/if}
    </div>
  {:else}
    <div class="relative">
      <input
        type="text"
        bind:this={inputEl}
        bind:value={searchQuery}
        onfocus={handleFocus}
        {placeholder}
        class="{searchInputTextClass} h-12 w-full rounded-lg border px-3 focus:border-border-active focus:outline-none {hasError
          ? 'border-red-300'
          : 'border-gray-200'}"
      />
    </div>
  {/if}
  {#if !readOnly && isDropdownOpen && inputEl}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 8,
        callback: () => {
          handleClose()
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000 max-w-[calc(100vw-32px)] xl:min-w-120"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      {#if showRegisterForm && onRegisterSubmit}
        <!-- 드롭다운이 '내담자 추가' 폼으로 전환된 뷰 -->
        <div class="flex flex-col p-5">
          <!-- 타이틀↔부제 간격 8 (§Components>modal 2줄 헤더 — 4는 붙어 보인다) -->
          <Typography
            variant="body-01-normal-semibold"
            color="text-body-default"
            className="mb-2"
          >
            {t('subject')} 추가
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-caption-default"
            className="mb-4"
          >
            새로운 {t('subject')}의 정보를 입력해주세요
          </Typography>
          <!-- 라벨 고정 너비(w-24)로 정렬 맞춤 -->
          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="w-24 shrink-0"
                >이름 <span class="field-required">*</span></Typography
              >
              <input
                type="text"
                bind:value={registerName}
                placeholder="이름을 입력해주세요"
                class="field-input min-w-0 flex-1"
              />
            </div>
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-caption-default"
                className="w-24 shrink-0"
                >성별 <span class="field-required">*</span></Typography
              >
              <div class="flex min-w-0 flex-1 items-center gap-6">
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="regGender"
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
                    name="regGender"
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
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="w-24 shrink-0"
                >생년월일 <span class="field-required">*</span></Typography
              >
              <input
                type="text"
                inputmode="numeric"
                maxlength="10"
                value={registerBirthDate}
                oninput={handleBirthDateInput}
                placeholder="YYYY-MM-DD"
                class="field-input min-w-0 flex-1"
              />
            </div>
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="w-24 shrink-0">이메일</Typography
              >
              <input
                type="email"
                bind:value={registerGuardianEmail}
                placeholder="example@email.com"
                class="field-input min-w-0 flex-1"
              />
            </div>
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="w-24 shrink-0">{t('guardian')} 이름</Typography
              >
              <input
                type="text"
                bind:value={registerGuardianName}
                placeholder="이름을 입력해주세요"
                class="field-input min-w-0 flex-1"
              />
            </div>
            <div class="flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-caption-default"
                className="w-24 shrink-0">관계</Typography
              >
              <div class="relative min-w-0 flex-1" bind:this={relationWrapEl}>
                <button
                  type="button"
                  bind:this={relationBtnEl}
                  onclick={toggleRelation}
                  class="text-body-02-normal-regular flex h-12 w-full items-center justify-between rounded-lg border px-4 {isRelationOpen
                    ? 'border-border-active'
                    : 'border-border-default'} {registerGuardianRelationship
                    ? 'text-body-default'
                    : 'text-caption-subtle'}"
                >
                  <span>{registerGuardianRelationship || '관계 선택'}</span>
                  <svg
                    width="6"
                    height="12"
                    viewBox="0 0 6 12"
                    fill="none"
                    class="pointer-events-none h-3 w-1.5 shrink-0 text-icon-secondary transition-transform duration-300 {isRelationOpen
                      ? 'rotate-90'
                      : '-rotate-90'}"
                  >
                    <path
                      d="M1 1L5 6L1 11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                {#if isRelationOpen}
                  <div
                    style="position:fixed;z-index:20002;{relationListStyle}"
                    class="dropdown-panel max-h-60 overflow-y-auto"
                  >
                    <ul class="dropdown-list">
                      {#each GUARDIAN_RELATION_OPTIONS as option}
                        <li>
                          <button
                            type="button"
                            onclick={() => {
                              registerGuardianRelationship = option
                              isRelationOpen = false
                            }}
                            class="dropdown-item {registerGuardianRelationship ===
                            option
                              ? 'is-selected'
                              : ''}"
                          >
                            {option}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </div>
            <div class="col-span-2 flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-caption-default"
                className="w-24 shrink-0"
                >{t('guardian')} 연락처
                <span class="field-required">*</span></Typography
              >
              <input
                type="tel"
                inputmode="numeric"
                maxlength="13"
                value={registerGuardianPhone}
                oninput={(e) => {
                  registerGuardianPhone = formatPhoneInput(
                    (e.target as HTMLInputElement).value
                  )
                }}
                placeholder="010-0000-0000"
                class="text-body-02-normal-regular h-12 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 focus:border-border-active focus:outline-none"
              />
            </div>
            <div class="col-span-2 flex items-center gap-3">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="w-24 shrink-0">주소</Typography
              >
              <input
                type="text"
                bind:value={registerAddress}
                placeholder="주소 검색"
                readonly
                onclick={openAddressSearch}
                class="field-input min-w-0 flex-1 cursor-pointer"
              />
              <input
                type="text"
                bind:value={registerAddressDetail}
                placeholder="상세주소"
                class="field-input min-w-0 flex-1"
              />
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onclick={closeRegisterForm}
              class="flex h-10 w-20 items-center justify-center rounded-lg bg-gray-100 text-title-subtitle transition-colors hover:bg-gray-200"
            >
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle">취소</Typography
              >
            </button>
            <button
              type="button"
              onclick={handleRegisterSubmit}
              disabled={!registerName.trim() || !isValidBirthDate}
              class="flex h-10 w-20 items-center justify-center rounded-lg bg-action-primary text-white transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
            >
              <Typography variant="body-02-normal-medium" color="text-white"
                >등록</Typography
              >
            </button>
          </div>
        </div>
      {:else if displayOptions.length > 0}
        <div class="flex flex-col">
          <!-- 목록 높이 252 — 행 52(아바타 36 + py 8·8) + gap 4 = 56 피치라
               4행(224) + 다음 행 28이 걸쳐 스크롤이 있다는 걸 알린다
               (§Components>dropdown "N개가 들어가고 다음 것이 살짝 걸친다"와 같은 셈).
               옛 200은 3행 + 32라 3명 반만 보였다. -->
          <div
            class="client-multiselect-scroll dropdown-list max-h-63 grow overflow-y-auto"
          >
            {#each displayOptions as client}
              <button
                type="button"
                onclick={(e) => {
                  e.preventDefault()
                  toggleSelected(client)
                }}
                class="dropdown-item h-auto justify-start gap-2 py-2"
              >
                <ClientAvatar
                  profileImageUrl={client.profile_image_url}
                  name={client.name}
                  gender={client.gender}
                  sizeClass="h-9 w-9"
                  textClass="text-label-01-normal-medium"
                />
                <div
                  class="flex min-w-0 flex-1 items-center gap-2 text-body-02-normal-medium"
                >
                  <!-- 보호자는 배지가 아니라 **이름 앞 브랜드 컬러 텍스트**다 —
                       이름의 수식어라 배지로 띄우면 식별자와 같은 급으로 읽힌다
                       (정본 = ClientCard 목록 카드). both(내담자 겸 보호자)는
                       본인이 접수 대상이라 표시하지 않는다. -->
                  {#if client.role === 'guardian' && has('guardian')}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-action-primary"
                      tag="span"
                      className="shrink-0"
                    >
                      {t('guardian')}
                    </Typography>
                  {/if}
                  <Typography
                    variant="body-01-normal-semibold"
                    color="text-body-strong"
                    tag="span"
                    className="min-w-0 flex-1 xl:flex-initial xl:shrink-0 truncate-safe"
                  >
                    {client.name}
                  </Typography>
                  <!-- 생년월일 | 성별 = 공용 ClientBirthGender 단일 규격.
                       구분선 높이·간격·시크릿 마스킹까지 그 컴포넌트가 소유한다
                       (손으로 그리면 화면마다 구분선이 갈린다). -->
                  <ClientBirthGender
                    birthDate={client.birth_date}
                    gender={client.gender}
                  />
                </div>
                <!-- 다중선택 표시 — 공용 Checkbox와 같은 규격(20 박스 · radius 4 ·
                     1.5px border-default). 행 전체가 토글 버튼이라 그 안에 <input>을
                     중첩할 수 없어 시각 규격만 맞춘 표시용 박스다(§Components>dropdown). -->
                <div
                  class={twMerge(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-[1.5px] duration-200',
                    isItemSelected(client.id)
                      ? 'border-action-primary bg-action-primary'
                      : 'border-border-default'
                  )}
                >
                  {#if isItemSelected(client.id)}
                    <svg
                      width="13"
                      height="10"
                      viewBox="0 0 13 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M0.75 5L4.27078 9L11.75 1"
                        stroke="#fff"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
          <!-- 패널 꼬리 안내 — 안내는 15/400 body-default, 액션은 15/500 primary.
               크기는 같고 굵기·색으로만 갈린다(2026-09-02 사용자 결정 —
               §Components>dropdown의 "패널 안은 전부 Medium"보다 이 결정이 우선).
               크기로 가르면 한 줄 안에서 baseline이 어긋나고 패널의 다른 행(15)과도 안 맞는다.
               아이콘은 PlusIcon20(currentColor) — 옛 PlusIcon(24 · 파란 원판 · hex 고정)은
               글자와 색이 달랐다. -->
          {#if showRegisterOption && $canAccess(CLIENT_CREATE_RULE) && (onRegisterSubmit || onRegisterClick)}
            <div
              class="flex shrink-0 items-center justify-center gap-2 border-t border-border-subtle py-4"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-body-default"
              >
                찾는 {josa(t('subject'), '이/가')} 없나요?
              </Typography>
              <button
                type="button"
                onclick={() => {
                  if (onRegisterSubmit) openRegisterForm()
                  else {
                    onRegisterClick?.()
                    isDropdownOpen = false
                  }
                }}
                class="flex items-center gap-2 text-action-primary hover:underline"
              >
                <PlusIcon20 />
                <Typography
                  variant="body-02-normal-medium"
                  color="text-current"
                >
                  새 {t('subject')} 등록
                </Typography>
              </button>
            </div>
          {/if}
          <!-- 선택 칩 + 적용 — 패널 꼬리 띠. 좌우로 full-bleed(-mx-2/-mb-2)시켜
               구분선이 패널 폭 전체를 긋게 하고, 자기 패딩 16을 사방에 갖는다.
               그러면 칩 시작선이 위 항목 텍스트(패널 8 + 항목 8 = 16)와 정확히 맞는다.
               옛 min-h-15(60) + items-end 조합이 한 줄일 때 위쪽에만 죽은 높이를 만들어
               상단 여백이 유독 넓어 보였다 — 높이는 내용이 정하게 둔다.
               선택 0건이면 띠 자체를 내보내지 않는다 — 담을 칩도 커밋할 것도 없는데
               빈 띠가 패널 아래를 차지하면 목록만 좁아진다(2026-09-08 결정). -->
          {#if selected.length > 0}
            <div
              class="-mx-2 -mb-2 flex shrink-0 items-end justify-between gap-2 border-t border-border-subtle p-4"
            >
              <div class="flex flex-1 flex-wrap items-center gap-2">
                {#each selected as client}
                  <span
                    class="inline-flex h-9 min-w-20 items-center justify-center gap-2 rounded-lg border border-border-active bg-brand-subtle px-3"
                  >
                    <Typography
                      variant="body-03-normal-regular"
                      color="text-action-primary"
                    >
                      {client.name}
                    </Typography>
                    <button
                      type="button"
                      onclick={() => removeFromSelected(client)}
                      class="flex items-center justify-center"
                      aria-label="제거"
                    >
                      <CircleClose16 />
                    </button>
                  </span>
                {/each}
              </div>
              <!-- 적용 버튼만 한 단계 큰 Medium(40 × 좌우 24 · 레이블 15/500) —
                   §Components>button 사이즈 4단. 칩(36)과 나란히 서는 자리라
                   드롭다운 공통 Small(32)로는 커밋 버튼이 칩보다 작아 보인다. -->
              <button
                type="button"
                class="dropdown-footer-apply h-10 px-6 text-body-02-normal-medium"
                onclick={handleClose}
              >
                적용
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="flex flex-col">
          <!-- 빈 상태도 꼬리 안내와 같은 규격 — 문구는 해요체(§Voice), 어휘는
               온톨로지 t() 경유(리터럴 '내담자' 금지) -->
          <div class="flex flex-col items-center justify-center gap-4 p-8">
            <Typography
              variant="body-02-normal-regular"
              color="text-body-default"
            >
              {options.length === 0
                ? `등록된 ${josa(t('subject'), '이/가')} 없어요`
                : '검색 결과가 없어요'}
            </Typography>
            {#if showRegisterOption && $canAccess(CLIENT_CREATE_RULE) && (onRegisterSubmit || onRegisterClick)}
              <button
                type="button"
                onclick={() => {
                  if (onRegisterSubmit) openRegisterForm()
                  else {
                    onRegisterClick?.()
                    isDropdownOpen = false
                  }
                }}
                class="flex items-center gap-2 text-action-primary hover:underline"
              >
                <PlusIcon20 />
                <Typography
                  variant="body-02-normal-medium"
                  color="text-current"
                >
                  새 {t('subject')} 등록
                </Typography>
              </button>
            {/if}
          </div>
          <!-- 선택 칩 + 적용 — 패널 꼬리 띠. 좌우로 full-bleed(-mx-2/-mb-2)시켜
               구분선이 패널 폭 전체를 긋게 하고, 자기 패딩 16을 사방에 갖는다.
               그러면 칩 시작선이 위 항목 텍스트(패널 8 + 항목 8 = 16)와 정확히 맞는다.
               옛 min-h-15(60) + items-end 조합이 한 줄일 때 위쪽에만 죽은 높이를 만들어
               상단 여백이 유독 넓어 보였다 — 높이는 내용이 정하게 둔다. -->
          {#if selected.length > 0}
            <div
              class="-mx-2 -mb-2 flex shrink-0 items-end justify-between gap-2 border-t border-border-subtle p-4"
            >
              <div class="flex flex-1 flex-wrap items-center gap-2">
                {#each selected as client}
                  <span
                    class="inline-flex h-9 min-w-20 items-center justify-center gap-2 rounded-lg border border-border-active bg-brand-subtle px-3"
                  >
                    <Typography
                      variant="body-03-normal-regular"
                      color="text-action-primary"
                    >
                      {client.name}
                    </Typography>
                    <button
                      type="button"
                      onclick={() => removeFromSelected(client)}
                      class="flex items-center justify-center"
                      aria-label="제거"
                    >
                      <CircleClose size={16} />
                    </button>
                  </span>
                {/each}
              </div>
              <button
                type="button"
                class="dropdown-footer-apply h-10 px-6 text-body-02-normal-medium"
                onclick={handleClose}
              >
                적용
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  {#if !readOnly && selected.length > 0}
    <div
      transition:slide={{ duration: 200 }}
      class="mt-2 flex flex-wrap items-center gap-2"
    >
      {#each selected as client}
        <span
          class="inline-flex h-9 min-w-20 items-center justify-center gap-2 rounded-lg border border-border-active bg-brand-subtle px-3"
        >
          <Typography
            variant="body-03-normal-regular"
            color="text-action-primary"
          >
            {client.name}
          </Typography>
          <button
            type="button"
            onclick={() => removeFromSelected(client)}
            class="flex items-center justify-center"
            aria-label="선택 해제"
          >
            <CircleClose16 />
          </button>
        </span>
      {/each}
    </div>
  {/if}
</div>
