<script lang="ts">
  import Button from '../Button.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '../Select.svelte'
  import DateSelect from '../searchInput/DateSelect.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { formatPhoneNumber } from '$lib/utils/stringConverter'
  import CloseIcon from '../../assets/CloseIcon.svelte'

  export interface ClientUpdateData {
    name: string
    birth_date: string | null
    gender: 'male' | 'female'
    phone: string | null
    address: string | null
    memo: string | null
  }

  interface Props {
    modalId?: string
    clientId?: string
    client?: {
      id?: string
      name?: string
      gender?: 'MALE' | 'FEMALE' | 'male' | 'female' | string | null
      birth_date?: string | null
      phone?: string | null
      address?: string | null
      status?: string | null
      memo?: string | null
    }
    onConfirm?: (data: ClientUpdateData) => Promise<void>
    closeModal?: () => void
  }

  let {
    modalId,
    closeModal = () => {},
    clientId,
    client,
    onConfirm
  }: Props = $props()

  interface GuardianForm {
    id: string
    name: string
    relation: string
    birth: Date | null
    phone: string
  }

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
  const statusOptions = [
    { value: 'ACTIVE', title: '활성' },
    { value: 'INACTIVE', title: '비활성' }
  ]

  let memo = $state('')
  let birthDate = $state<Date | null>(null)
  let clientName = $state('')
  let address = $state('')
  let addressDetail = $state('')
  let phone = $state('')
  let guardians = $state<GuardianForm[]>([
    {
      id: `${Date.now()}-guardian`,
      name: '',
      relation: '',
      birth: null,
      phone: ''
    }
  ])
  let chiefComplaint = $state('')
  let tagInput = $state('')
  let tags = $state<string[]>([])
  let gender = $state<'male' | 'female'>('male')
  let isInitialized = $state(false)
  let isAddressSearching = $state(false)
  let isSubmitting = $state(false)

  const formatDateStr = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const onClickChangeInfo = async () => {
    if (isSubmitting) return
    isSubmitting = true
    try {
      const fullAddress = [address, addressDetail].filter(Boolean).join(' ')
      const birthStr = birthDate ? formatDateStr(birthDate) : null
      await onConfirm?.({
        name: clientName,
        birth_date: birthStr,
        gender,
        phone: phone.trim() || null,
        address: fullAddress || null,
        memo: memo.trim() || null
      })
    } catch {
      snackbarStore.error('내담자 정보 수정에 실패했습니다')
    } finally {
      isSubmitting = false
    }
  }

  const openAddressSearch = () => {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        address = data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  const addGuardian = () => {
    guardians = [
      ...guardians,
      {
        id: `${Date.now()}-guardian`,
        name: '',
        relation: '',
        birth: null,
        phone: ''
      }
    ]
  }

  const removeGuardian = (id: string) => {
    guardians = guardians.filter((guardian) => guardian.id !== id)
  }

  const addTag = () => {
    const next = tagInput.trim()
    if (!next) return
    if (tags.includes(next)) return
    tags = [...tags, next]
    tagInput = ''
  }

  const removeTag = (value: string) => {
    tags = tags.filter((tag) => tag !== value)
  }

  $effect(() => {
    if (isInitialized || !client) return
    clientName = client.name || ''
    const genderRaw = client.gender?.toString().toLowerCase()
    gender =
      genderRaw === 'female' || genderRaw === 'f' || genderRaw === '여자'
        ? 'female'
        : 'male'
    birthDate = client.birth_date ? new Date(client.birth_date) : null
    address = client.address || ''
    addressDetail = ''
    phone = formatPhoneNumber(client.phone || '') || ''
    memo = client.memo || ''
    chiefComplaint = ''
    tags = []
    isInitialized = true
  })
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  showCloseButton={false}
  size="lg"
  bodyClass="p-5 pb-7 max-h-[600px]"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="flex w-full items-center justify-between">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        내담자 정보를 수정할게요
      </Typography>
      <Button
        onclick={closeModal}
        class="flex h-11 w-10 px-0 items-center justify-center rounded-lg bg-gray-50 duration-300 hover:bg-gray-100"
      >
        <CloseIcon size={24} color="#8A949E" />
      </Button>
    </div>
  {/snippet}
  {#snippet body()}
    <div class="flex flex-col">
      <div class="mb-6">
        <label for="clientName">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">이름</Typography
          >
        </label>
        <input
          type="text"
          name="clientName"
          bind:value={clientName}
          placeholder="내담자 이름"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-2">생년월일</Typography
        >
        <DateSelect bind:selectedDate={birthDate} />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-3">성별</Typography
        >
        <div class="flex w-full gap-6">
          <button
            onclick={() => (gender = 'male')}
            class="flex w-22 items-center gap-2"
          >
            <div
              class="flex h-5 w-5 items-center justify-center rounded-full border {gender ===
              'male'
                ? 'border-border-active'
                : 'border-gray-300'}"
            >
              {#if gender === 'male'}
                <div class="h-2.5 w-2.5 rounded-full bg-primary-500"></div>
              {/if}
            </div>
            <Typography variant="body-01-regular" color="text-gray-800"
              >남자</Typography
            >
          </button>
          <button
            onclick={() => (gender = 'female')}
            class="flex w-22 items-center gap-2"
          >
            <div
              class="flex h-5 w-5 items-center justify-center rounded-full border {gender ===
              'female'
                ? 'border-border-active'
                : 'border-gray-300'}"
            >
              {#if gender === 'female'}
                <div class="h-2.5 w-2.5 rounded-full bg-primary-500"></div>
              {/if}
            </div>
            <Typography variant="body-01-regular" color="text-gray-800"
              >여자</Typography
            >
          </button>
        </div>
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2">주소</Typography
        >
        <input
          type="text"
          bind:value={address}
          placeholder="주소"
          readonly
          onclick={openAddressSearch}
          class="field-input w-full"
        />
        <input
          type="text"
          bind:value={addressDetail}
          placeholder="상세 주소"
          class="field-input mt-2 w-full"
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-2">연락처</Typography
        >
        <input
          type="tel"
          value={phone}
          oninput={(e) => {
            const raw = e.currentTarget.value.replace(/[^\d]/g, '').slice(0, 11)
            phone = formatPhoneNumber(raw) || raw
          }}
          placeholder="010-0000-0000"
          class="text-title-02-normal-regular h-13 w-full rounded-lg border border-gray-200 px-2.5 focus:border-border-active focus:outline-none"
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-2">주호소 문제</Typography
        >
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={chiefComplaint}
          placeholder="주호소 문제를 입력해주세요"
          class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-medium"
          color="text-gray-700"
          className="mb-2">메모</Typography
        >
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={memo}
          placeholder="내담자 메모를 입력해주세요"
          class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
        />
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2">내담자 태그</Typography
        >
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={tagInput}
            placeholder="태그를 입력하고 Enter"
            class="field-input flex-1"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <Button
            class="h-11 w-20 rounded-norm border border-gray-200 bg-white duration-200 hover:bg-gray-100"
            onclick={addTag}
          >
            <Typography variant="body-01-normal-medium" color="text-gray-700"
              >추가</Typography
            >
          </Button>
        </div>
        {#if tags.length > 0}
          <div class="mt-3 flex flex-wrap gap-2">
            {#each tags as tag}
              <div
                class="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600"
                  onclick={() => removeTag(tag)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="my-6 border-b border-gray-200"></div>
      <div class="space-y-4">
        <div class="flex items-center gap-1">
          <Typography
            variant="headline-02-reading-semibold"
            color="text-gray-800"
          >
            보호자 정보
          </Typography>
          <Typography variant="body-01-normal-medium" color="text-gray-500"
            >(선택)</Typography
          >
        </div>
        <Typography variant="body-03-normal-regular" color="text-gray-600">
          입력한 보호자는 별도의 내담자로 함께 등록돼요
        </Typography>
        {#each guardians as guardian, idx}
          <div class="p-4 bg-primary-50 rounded-lg relative">
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
              class="field-input w-full"
            />
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
                  class="w-full bg-white"
                  selected={guardian.relation}
                  options={relations}
                  on:change={(e) => {
                    guardian.relation = e.detail
                  }}
                />
              </div>
              <div>
                <Typography
                  variant="body-02-medium"
                  color="text-gray-700"
                  className="mb-2"
                >
                  생년월일
                </Typography>
                <DateSelect bind:selectedDate={guardian.birth} />
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
                class="field-input w-full"
              />
            </div>
            {#if idx}
              <div class="w-full flex justify-end">
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
        <button onclick={addGuardian} class="mx-auto flex items-center gap-2">
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
          <Typography variant="body-01-medium" color="text-gray-600"
            >추가</Typography
          >
        </button>
      </div>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full items-center justify-between">
      <Button
        class="h-11 w-40 rounded-norm border border-gray-200 bg-white duration-200 hover:bg-gray-100"
        onclick={closeModal}
      >
        <Typography variant="body-01-normal-medium" color="text-gray-500"
          >취소</Typography
        >
      </Button>
      <Button
        onclick={onClickChangeInfo}
        disabled={isSubmitting}
        class="h-11 w-40 rounded-norm bg-primary-500 duration-200 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >{isSubmitting ? '수정 중...' : '수정'}</Typography
        >
      </Button>
    </div>
  {/snippet}
</BaseModal>
