<script lang="ts">
  import { fade } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'
  import { useQueryClient } from '@tanstack/svelte-query'

  import { mutationBuilder } from '../../hooks/queries/builder'
  import {
    useClientRegisterForm,
    type GroupClientActions,
    type GroupClientState
  } from '../../features/clients/register/hooks.svelte'

  import {
    excelUploadStore,
    type ExcelClientData
  } from '../../stores/excelUpload'
  import { snackbarStore } from '../../stores/snackbar'
  import { dateToString } from '$lib/utils/date'

  import { requireCenterId } from '$lib/stores/center.store'
  import {
    createGuardianRelation,
    postCreateClient,
    type ClientRole
  } from '$lib/hooks/actions/client.action'
  import {
    type GuardianForm,
    type MockClient
  } from '../../mocks/clientMockStore'

  import Select from '../Select.svelte'
  import BaseModal from './BaseModal.svelte'
  import SegmentToggle from '../SegmentToggle.svelte'
  import TrashIcon from '../../assets/TrashIcon.svelte'
  import DateSelect from '../searchInput/DateSelect.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BulkRegisterClient from '../client/BulkRegisterClient.svelte'
  import GroupSelectDropdown from '../client/GroupSelectDropdown.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    /** 등록 완료 후 콜백 (목록 갱신 등) */
    onRegistered?: () => void
  }

  let { modalId = '', closeModal = () => {}, onRegistered }: Props = $props()

  const form = useClientRegisterForm()
  const queryClient = useQueryClient()

  // const createClient = mutationBuilder(postCreateClient, ['getClientList'])

  const removeGuardian = (id: string) => {
    guardians = guardians.filter((g) => g.id !== id)
  }

  let guardians = $state<GuardianForm[]>([
    {
      id: `${new Date().getTime()}`,
      name: '',
      relation: '',
      birth: null,
      phone: ''
    }
  ])

  let name = $state('')
  let checkedGuardians = $state<any[]>([])
  let gender = $state<'MALE' | 'FEMALE'>('MALE')
  let birth = $state<Date | null>(null)
  let phone = $state('')
  let memo = $state('')
  let hasPhone = $state(true)
  let fieldErrors = $state<{
    name?: string
    birth_date?: string
    phone?: string
  }>({})
  type GuardianFieldErrors = {
    name?: string
    relation?: string
    birth_date?: string
    phone?: string
  }
  let guardianErrors = $state<Record<string, GuardianFieldErrors>>({})
  let lastBirth = $state<Date | null>(null)
  const isSubmitDisabled = $derived(
    form.clientType === 'individual' ? !name.trim() : true
  )
  // let clientType = $state<'individual' | 'group'>('individual')

  const relations = [
    '엄마',
    '아빠',
    '할머니',
    '할아버지',
    '이모',
    '고모',
    '삼촌',
    '기타'
  ]

  const handleAddGuadian = () => {
    const newSection = {
      id: `${Date.now().toString()}-ggg`,
      name: '',
      relation: '',
      birth: null,
      phone: ''
    }
    guardians = [...guardians, newSection]
  }

  const groupState = $derived.by<GroupClientState>(() => ({
    groupSearchQuery: form.groupSearchQuery,
    selectedOrganization: form.selectedOrganization,
    isOrganizationEditMode: form.isOrganizationEditMode,
    isGroupDropdownOpen: form.isGroupDropdownOpen,
    isGroupRegisterFormOpen: form.isGroupRegisterFormOpen,
    groupMembers: form.groupMembers,
    organizationEditData: form.organizationEditData
  }))

  const groupActions: GroupClientActions = {
    setGroupSearchQuery: form.setGroupSearchQuery,
    setIsGroupDropdownOpen: form.setIsGroupDropdownOpen,
    handleGroupInputChange: form.handleGroupInputChange,
    handleGroupInputFocus: form.handleGroupInputFocus,
    handleOrganizationSelect: form.handleOrganizationSelect,
    handleGroupRegisterSubmit: form.handleGroupRegisterSubmit,
    handleGroupRegisterFormChange: form.handleGroupRegisterFormChange,
    handleEditOrganization: form.handleEditOrganization,
    handleDeleteOrganization: form.handleDeleteOrganization,
    handleOrganizationEditCancel: form.handleOrganizationEditCancel,
    clearGroupMembers: form.clearGroupMembers,
    onExcelUploadClick: () => {},
    onEditGroupMembers: handleEditGroupMembers
  }

  function handleEditGroupMembers() {
    const excelClients: ExcelClientData[] = form.groupMembers.map((m) => ({
      id: m.id,
      status: 'new' as const,
      name: m.name,
      gender: m.gender as 'male' | 'female' | '',
      birthDate: m.birthDate,
      organization: '',
      guardianName: '',
      guardianRelationship: '',
      guardianPhone: m.guardianPhone || '',
      guardianEmail: '',
      address: ''
    }))
    excelUploadStore.setData(excelClients, '내담자 목록')
    form.groupMembers = []
  }

  const relationDetailMap: Record<string, string | null> = {
    엄마: 'mother',
    아빠: 'father',
    할머니: 'grandmother',
    할아버지: 'grandfather',
    이모: 'aunt',
    고모: 'aunt',
    삼촌: 'uncle',
    기타: 'caregiver'
  }

  const formatDate = (value: Date | null) =>
    value ? dateToString(value, 'YYYY-MM-DD') : null

  const normalizeErrorMessage = (message: string) =>
    message.replace(/^Value error,\s*/i, '').trim()

  const extractResponseId = (response: unknown) => {
    const anyResponse = response as { id?: string; data?: { id?: string } }
    return anyResponse?.data?.id ?? anyResponse?.id
  }

  const clearGuardianError = (id: string, field: keyof GuardianFieldErrors) => {
    const current = guardianErrors[id]
    if (!current?.[field]) return
    guardianErrors = {
      ...guardianErrors,
      [id]: { ...current, [field]: undefined }
    }
  }

  const handleConfirm = async () => {
    try {
      if (isSubmitDisabled) return
      fieldErrors = {}
      guardianErrors = {}
      if (!name.trim()) {
        snackbarStore.error('이름을 입력해주세요.')
        return
      }

      const nextGuardianErrors: Record<string, GuardianFieldErrors> = {}
      let hasGuardianError = false
      for (const guardian of guardians) {
        const hasInput =
          !!guardian.name.trim() ||
          !!guardian.relation ||
          !!guardian.phone.trim() ||
          !!guardian.birth
        if (!hasInput) continue

        const errors: GuardianFieldErrors = {}
        if (!guardian.name.trim()) {
          errors.name = '보호자 이름을 입력해주세요.'
        }
        if (!guardian.relation) {
          errors.relation = '관계를 선택해주세요.'
        }
        if (guardian.birth && guardian.birth > new Date()) {
          errors.birth_date = '생년월일은 미래 날짜일 수 없습니다.'
        }
        if (guardian.phone && !/^[\d-]+$/.test(guardian.phone)) {
          errors.phone = '전화번호는 숫자와 하이픈(-)만 포함해야 합니다'
        }

        if (Object.keys(errors).length > 0) {
          nextGuardianErrors[guardian.id] = errors
          hasGuardianError = true
        }
      }

      if (hasGuardianError) {
        guardianErrors = nextGuardianErrors
        return
      }

      const centerId = requireCenterId()
      const createClientAction = postCreateClient()

      const childResponse = await createClientAction.request({
        centerId,
        payload: {
          role: 'client' as ClientRole,
          name,
          birth_date: formatDate(birth),
          gender: gender === 'MALE' ? 'male' : 'female',
          phone: phone || null,
          memo: memo || null
        }
      })

      const clientId = extractResponseId(childResponse)

      if (!clientId) {
        throw new Error('내담자 생성 결과를 확인할 수 없습니다.')
      }

      const validGuardians = guardians.filter(
        (g) => g.name.trim() && g.relation !== ''
      )

      for (let index = 0; index < validGuardians.length; index += 1) {
        const guardian = validGuardians[index]
        const guardianResponse = await createClientAction.request({
          centerId,
          payload: {
            role: 'guardian' as ClientRole,
            name: guardian.name,
            birth_date: formatDate(guardian.birth),
            gender: 'female',
            phone: guardian.phone || null
          }
        })

        const guardianId = extractResponseId(guardianResponse)

        if (!guardianId) continue

        await createGuardianRelation().request({
          centerId,
          client_id: clientId,
          related_client_id: guardianId,
          relation_type: 'guardian',
          relation_detail: relationDetailMap[guardian.relation] ?? 'caregiver',
          is_primary: index === 0
        })
      }

      await queryClient.invalidateQueries({
        queryKey: ['getClientList'],
        exact: false
      })

      snackbarStore.success('내담자가 등록되었어요')
      onRegistered?.()
      closeModal()
    } catch (error) {
      const details =
        (error as any)?.response?.data?.detail ??
        (error as any)?.detail ??
        (error as any)?.response?.data?.errors

      if (Array.isArray(details)) {
        const nextErrors: typeof fieldErrors = {}
        for (const item of details) {
          const loc = Array.isArray(item?.loc) ? item.loc : []
          const field = loc[loc.length - 1]
          const message = normalizeErrorMessage(item.msg ?? '')
          if (field === 'name') nextErrors.name = message
          if (field === 'birth_date') nextErrors.birth_date = message
          if (field === 'phone') nextErrors.phone = message
        }
        fieldErrors = nextErrors
      }

      const firstDetail = Array.isArray(details) ? details[0]?.msg : null
      if (firstDetail) {
        // 에러 스낵바는 표시하지 않음
      }
    }
  }

  $effect(() => {
    if (fieldErrors.birth_date && birth !== lastBirth) {
      fieldErrors = { ...fieldErrors, birth_date: undefined }
    }
    lastBirth = birth
  })

  const syncGuardiansFromChecked = (list: MockClient[]) => {
    const existingMap = new Map(guardians.map((g) => [g.id, g]))

    const synced: GuardianForm[] = list.map((g) => {
      const existing = existingMap.get(g.id)
      if (existing) return existing

      return {
        id: g.id,
        name: g.name,
        relation: '',
        birth: g.birth ? new Date(g.birth) : null,
        phone: g.phone ?? ''
      }
    })

    const manual = guardians.filter((g) => g.id.includes('ggg'))

    guardians = [...synced, ...manual]
  }

  const updateCheckedGuardians = (next: MockClient[]) => {
    checkedGuardians = next
    syncGuardiansFromChecked(next)
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  containerClass="max-h-[819px]"
  title="내담자를 등록할게요"
>
  {#snippet body()}
    <div class="flex flex-col">
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          개인/단체 <span class="field-required">*</span>
        </Typography>
        <SegmentToggle
          options={[
            { label: '개인', value: 'individual' },
            { label: '단체', value: 'group' }
          ]}
          value={form.clientType}
          onchange={(v) => form.handleTypeChange(v as 'individual' | 'group')}
        />
      </div>
      {#if form.clientType === 'individual'}
        <div class="mb-6">
          <label for="name">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2">내담자 이름</Typography
            >
          </label>
          <input
            type="text"
            name="name"
            bind:value={name}
            placeholder="내담자 이름을 입력해주세요"
            class={twMerge('field-input', fieldErrors.name ? 'is-error' : '')}
            aria-invalid={fieldErrors.name ? 'true' : 'false'}
            aria-describedby="client-name-error"
            oninput={() => {
              if (fieldErrors.name) {
                fieldErrors = { ...fieldErrors, name: undefined }
              }
            }}
          />
          <p id="client-name-error" class="mt-1 field-help is-error">
            {fieldErrors.name ?? ''}
          </p>
        </div>
        <div class="mb-6">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">생년월일</Typography
          >
          <DateSelect
            bind:selectedDate={birth}
            className={fieldErrors.birth_date
              ? '!border-status-danger !ring-1 !ring-red-200'
              : ''}
          />
          <p class="mt-1 field-help is-error">
            {fieldErrors.birth_date ?? ''}
          </p>
        </div>
        <div class="mb-6">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">성별</Typography
          >
          <div class="flex w-full h-11 items-center gap-6">
            <button
              onclick={() => (gender = 'MALE')}
              class="flex w-22 items-center gap-2"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {gender ===
                'MALE'
                  ? 'bg-primary-500'
                  : 'border border-gray-300 bg-white'}"
              >
                {#if gender === 'MALE'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.3337 4L6.00033 11.3333L2.66699 8"
                      stroke="white"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                남자
              </Typography>
            </button>
            <button
              onclick={() => (gender = 'FEMALE')}
              class="flex w-22 items-center gap-2"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {gender ===
                'FEMALE'
                  ? 'bg-primary-500'
                  : 'border border-gray-300 bg-white'}"
              >
                {#if gender === 'FEMALE'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.3337 4L6.00033 11.3333L2.66699 8"
                      stroke="white"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                여자
              </Typography>
            </button>
          </div>
        </div>
        <div class="mb-6">
          <label for="phone">
            <Typography
              variant="body-02-normal-medium"
              color="text-title-subtitle"
              className="mb-2">연락처</Typography
            >
          </label>
          <input
            type="text"
            name="phone"
            disabled={!hasPhone}
            bind:value={phone}
            placeholder="내담자 연락처를 입력해주세요"
            class={twMerge('field-input', fieldErrors.phone ? 'is-error' : '')}
            aria-invalid={fieldErrors.phone ? 'true' : 'false'}
            aria-describedby="client-phone-error"
            oninput={() => {
              if (fieldErrors.phone) {
                fieldErrors = { ...fieldErrors, phone: undefined }
              }
            }}
          />
          <p id="client-phone-error" class="mt-1 field-help is-error">
            {fieldErrors.phone ?? ''}
          </p>
        </div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2">메모</Typography
        >
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={memo}
          placeholder="메모 내용을 입력해주세요"
          class="text-body-01-reading-regular placeholder:text-placeholder h-30 min-h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
        />
        <hr class="border-gray-200 my-4" />
        <div class="space-y-4">
          <div class="flex items-center gap-1 mb-2">
            <Typography variant="title-01-normal-semibold">
              보호자 정보
            </Typography>
            <Typography variant="body-01-normal-medium" color="text-gray-500">
              (선택)
            </Typography>
          </div>
          <Typography variant="body-03-normal-regular" color="text-gray-600">
            입력한 보호자는 별도의 내담자로 함께 등록돼요
          </Typography>
          <!-- <GuardianSearchDropdown
          className="mb-4"
          bind:checkedGuardians
          searchQuery={guardian_name}
          onChange={(next) => {
            updateCheckedGuardians(next)
          }}
        /> -->
          {#each guardians as guardian, idx}
            <div in:fade class="p-4 bg-primary-50 rounded-lg relative">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-2"
              >
                보호자 이름
              </Typography>

              <input
                type="text"
                bind:value={guardian.name}
                placeholder="보호자 이름을 입력해주세요"
                class={twMerge(
                  'field-input',
                  guardianErrors[guardian.id]?.name
                    ? 'border-status-danger'
                    : 'border-gray-200'
                )}
                oninput={() => clearGuardianError(guardian.id, 'name')}
              />
              <p class="mt-1 field-help is-error">
                {guardianErrors[guardian.id]?.name ?? ''}
              </p>
              <div class="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-title-subtitle"
                    className="mb-2"
                  >
                    관계
                  </Typography>
                  <Select
                    placeholder="내담자와의 관계"
                    textClass="text-body-01-normal-regular"
                    class={twMerge(
                      'w-full h-11 bg-white',
                      guardianErrors[guardian.id]?.relation
                        ? 'border border-status-danger'
                        : ''
                    )}
                    selected={guardian.relation}
                    options={relations}
                    on:change={(e) => {
                      guardian.relation = e.detail
                      clearGuardianError(guardian.id, 'relation')
                    }}
                  />
                  <p class="mt-1 field-help is-error">
                    {guardianErrors[guardian.id]?.relation ?? ''}
                  </p>
                </div>
                <div>
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-title-subtitle"
                    className="mb-2"
                  >
                    생년월일
                  </Typography>
                  <DateSelect
                    bind:selectedDate={guardian.birth}
                    className={guardianErrors[guardian.id]?.birth_date
                      ? '!border-status-danger !ring-1 !ring-red-200'
                      : ''}
                  />
                  <p class="mt-1 field-help is-error">
                    {guardianErrors[guardian.id]?.birth_date ?? ''}
                  </p>
                </div>
              </div>
              <div class="mt-4">
                <Typography
                  variant="body-02-normal-medium"
                  color="text-title-subtitle"
                  className="mb-2"
                >
                  보호자 연락처
                </Typography>
                <input
                  type="tel"
                  bind:value={guardian.phone}
                  placeholder="연락처를 입력해주세요"
                  class={twMerge(
                    'field-input',
                    guardianErrors[guardian.id]?.phone
                      ? 'border-status-danger'
                      : 'border-gray-200'
                  )}
                  oninput={() => clearGuardianError(guardian.id, 'phone')}
                />
                <p class="mt-1 field-help is-error">
                  {guardianErrors[guardian.id]?.phone ?? ''}
                </p>
              </div>
              {#if idx}
                <div class="w-full flex justify-end">
                  <!-- 삭제 버튼 -->
                  <button
                    class="flex items-center mt-5"
                    onclick={() => removeGuardian(guardian.id)}
                  >
                    <div class="w-6 h-6 flex-center">
                      <TrashIcon class="w-auto h-full" />
                    </div>
                    <span class="text-sm text-gray-400"> 삭제 </span>
                  </button>
                </div>
              {/if}
            </div>
          {/each}
          <button
            onclick={handleAddGuadian}
            class="mx-auto flex items-center gap-2"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" fill="#D7E5FD" />
              <path
                d="M7 12L17 12"
                stroke="#4C87F6"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M12 7L12 17"
                stroke="#4C87F6"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <Typography variant="body-01-medium" color="text-gray-600">
              추가
            </Typography>
          </button>
        </div>
      {:else}
        <GroupSelectDropdown view={groupState} actions={groupActions} />
        <BulkRegisterClient view={groupState} actions={groupActions} />
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center gap-3">
      <button
        onclick={handleConfirm}
        class={twMerge(
          'flex h-11 flex-1 items-center justify-center rounded-lg text-white transition-colors',
          isSubmitDisabled
            ? 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'
            : 'bg-primary-500 hover:bg-primary-500'
        )}
        disabled={isSubmitDisabled}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          등록
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
