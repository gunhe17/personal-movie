<script lang="ts">
  import type { MemberDetailResponse } from '$lib/hooks/actions/member.action'
  import { MEMBER_EMPLOYMENT_TYPE_MAP } from '$lib/features/members/constants'
  import Select from '../Select.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import DatePickerInput from '../DatePickerInput.svelte'

  export interface MemberModifyFormData {
    role_code?: string
    employment_type?: string
    hire_date?: string
    memo?: string
    name?: string
    phone?: string
    gender?: string
    birth?: string
  }

  interface Props {
    modalId?: string
    member?: MemberDetailResponse
    roleOptions?: { value: string; title: string }[]
    closeModal?: () => void
    onConfirm?: (data: MemberModifyFormData) => Promise<void>
  }

  let {
    modalId = '',
    member,
    roleOptions = [],
    closeModal = () => {},
    onConfirm
  }: Props = $props()

  const employmentTypeOptions = [
    { value: 'FULLTIME', title: '정규직' },
    { value: 'CONTRACT', title: '계약직' },
    { value: 'FREELANCER', title: '프리랜서' }
  ]

  let memberName = $state('')
  let gender = $state('MALE')
  let birth = $state('')
  let hireDate = $state('')
  let memo = $state('')
  let phone = $state('')
  let employmentType = $state('FULLTIME')
  let roleId = $state('')
  let isSubmitting = $state(false)
  let showAdminConfirm = $state(false)

  /** 선택한 역할이 관리자(ADMIN)인지 확인 */
  const isAdminRole = $derived(
    roleOptions.find((o) => o.value === roleId)?.title === '관리자' ||
      roleId === 'ADMIN'
  )
  /** 원래 역할이 관리자가 아닌데 관리자로 변경하려는 경우 */
  const isUpgradeToAdmin = $derived(isAdminRole && member?.role_code !== roleId)

  $effect(() => {
    if (!member) return
    memberName = member.person.name || ''
    gender = member.person.gender?.toLocaleUpperCase() || 'MALE'
    birth = member.person.birth || ''
    hireDate = member.hire_date || ''
    memo = member.memo || ''
    phone = member.person.phone || ''
    employmentType = member.employment_type || 'FULLTIME'
    roleId = member.role_code || ''
  })

  const submitForm = async () => {
    if (!member || isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm?.({
        role_code: roleId,
        employment_type: employmentType,
        hire_date: hireDate || undefined,
        memo,
        name: memberName,
        phone,
        gender,
        birth
      })
      closeModal()
    } finally {
      isSubmitting = false
    }
  }

  const handleConfirm = async () => {
    if (isUpgradeToAdmin) {
      showAdminConfirm = true
      return
    }
    await submitForm()
  }

  const confirmAdminChange = async () => {
    showAdminConfirm = false
    await submitForm()
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
  title="구성원의 정보를 수정할게요"
>
  {#snippet body()}
    <div class="flex max-h-162.5 flex-col">
      <div class="mb-6">
        <label for="memberName">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">구성원 이름</Typography
          >
        </label>
        <input
          type="text"
          name="memberName"
          bind:value={memberName}
          placeholder="구성원 이름을 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">생년월일</Typography
          >
          <DatePickerInput bind:value={birth} class="flex-1" />
        </div>
        <div>
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
                color="text-body-default">여자</Typography
              >
            </button>
          </div>
        </div>
      </div>
      <div class="mb-6">
        <label for="email">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">이메일</Typography
          >
        </label>
        <input
          type="text"
          name="email"
          value={member?.person.email || ''}
          disabled
          class="field-input w-full"
        />
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
          bind:value={phone}
          placeholder="구성원 연락처를 입력해주세요"
          class="field-input w-full"
        />
      </div>
      <div class="mb-6">
        <label for="role">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">역할</Typography
          >
        </label>
        <Select
          selected={roleId}
          on:change={(e) => (roleId = e.detail.value)}
          hoverBoxClass="left-0 w-full"
          options={roleOptions}
          disabled={member?.role_name === '관리자'}
        />
        {#if member?.role_name === '관리자'}
          <Typography
            variant="body-02-regular"
            color="text-[#ef4967]"
            className="mt-2 ml-2"
          >
            관리자의 역할은 변경할 수 없습니다.
          </Typography>
        {/if}
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          계약형태
        </Typography>
        <div class="flex w-full gap-6">
          {#each employmentTypeOptions as opt}
            <button
              onclick={() => (employmentType = opt.value)}
              class="flex w-22 items-center gap-2"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {employmentType ===
                opt.value
                  ? 'bg-primary-500'
                  : 'border border-gray-300 bg-white'}"
              >
                {#if employmentType === opt.value}
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
                {opt.title}
              </Typography>
            </button>
          {/each}
        </div>
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2">입사일</Typography
        >
        <DatePickerInput bind:value={hireDate} class="flex-1" />
      </div>
      <div class="mb-6">
        <label for="memo">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2">메모</Typography
          >
        </label>
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={memo}
          placeholder="메모 내용을 입력해주세요"
          class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        disabled={isSubmitting}
        class="flex h-11 w-40 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          수정
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>

{#if showAdminConfirm}
  <div
    class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40"
  >
    <div class="w-96 rounded-lg bg-white p-5 shadow-xl">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-gray-900"
        className="mb-2"
      >
        관리자 역할로 변경할까요?
      </Typography>
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-6"
      >
        관리자는 센터의 모든 설정과 데이터에 접근할 수 있습니다. 이 변경은 즉시
        적용됩니다.
      </Typography>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => (showAdminConfirm = false)}
          class="flex h-11 items-center justify-center rounded-lg bg-gray-100 px-5 text-body-01-normal-medium text-gray-700 hover:bg-gray-200"
        >
          취소
        </button>
        <button
          onclick={confirmAdminChange}
          disabled={isSubmitting}
          class="flex h-11 items-center justify-center rounded-lg bg-red-500 px-5 text-body-01-normal-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          변경
        </button>
      </div>
    </div>
  </div>
{/if}
