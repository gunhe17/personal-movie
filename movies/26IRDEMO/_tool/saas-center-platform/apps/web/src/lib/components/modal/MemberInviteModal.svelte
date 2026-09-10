<script lang="ts">
  import type { InvitationItem } from '$lib/hooks/actions/member.action'
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Select from '../Select.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import CircleClose from '../../assets/CircleClose.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import ErrorCircleRedIcon20 from '$lib/assets/ErrorCircleRedIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  type InviteFieldErrors = Partial<
    Record<'name' | 'email' | 'role_code' | 'employment_type', string>
  >

  interface InviteRow {
    id: string
    name: string
    email: string
    role_code: string
    employment_type: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (items: InvitationItem[]) => Promise<void>
    roleOptions?: { value: string; title: string }[]
  }

  let {
    modalId,
    closeModal = () => {},
    onConfirm,
    roleOptions = []
  }: Props = $props()

  const employmentTypeOptions = [
    { value: 'FULLTIME', title: '정규직' },
    { value: 'CONTRACT', title: '계약직' },
    { value: 'FREELANCER', title: '프리랜서' }
  ]

  let name = $state('')
  let email = $state('')
  let roleId = $state<string>('')
  let employmentType = $state('')
  let invites = $state<InviteRow[]>([])
  let isSubmitting = $state(false)
  let fieldErrors = $state<InviteFieldErrors>({})

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // 유효성 검증
  function validate(): InviteFieldErrors {
    const errors: InviteFieldErrors = {}
    if (!name.trim()) errors.name = '이름을 입력해주세요.'
    if (!email.trim()) {
      errors.email = '이메일을 입력해주세요.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = '올바른 이메일 형식이 아닙니다.'
    } else if (invites.some((i) => i.email === email.trim())) {
      errors.email = '이미 추가된 이메일입니다.'
    }
    if (!roleId) errors.role_code = '역할을 선택해주세요.'
    if (!employmentType) errors.employment_type = '근무형태를 선택해주세요.'
    return errors
  }

  // 값이 유효해지면 해당 필드 에러 자동 클리어
  $effect(() => {
    if (fieldErrors.name && name.trim())
      fieldErrors = { ...fieldErrors, name: undefined }
  })
  $effect(() => {
    if (
      fieldErrors.email &&
      email.trim() &&
      EMAIL_REGEX.test(email.trim()) &&
      !invites.some((i) => i.email === email.trim())
    )
      fieldErrors = { ...fieldErrors, email: undefined }
  })
  $effect(() => {
    if (fieldErrors.role_code && roleId)
      fieldErrors = { ...fieldErrors, role_code: undefined }
  })
  $effect(() => {
    if (fieldErrors.employment_type && employmentType)
      fieldErrors = { ...fieldErrors, employment_type: undefined }
  })

  /** 필드 순서 기준 첫 번째 에러 필드 */
  const FIELD_ORDER: (keyof InviteFieldErrors)[] = [
    'name',
    'email',
    'role_code',
    'employment_type'
  ]
  const firstErrorField = $derived(FIELD_ORDER.find((f) => fieldErrors[f]))

  function handleAdd() {
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      fieldErrors = errors
      return
    }
    invites = [
      ...invites,
      {
        id: crypto.randomUUID?.() ?? `invite-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        role_code: roleId,
        employment_type: employmentType
      }
    ]
    name = ''
    email = ''
    roleId = ''
    employmentType = ''
    fieldErrors = {}
  }

  function handleRemove(id: string) {
    invites = invites.filter((inv) => inv.id !== id)
  }

  /** AxiosError 응답에서 사용자용 메시지 추출 */
  function extractApiError(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { data?: { detail?: unknown } } })
        .response
      const detail = res?.data?.detail
      if (typeof detail === 'string') return detail
    }
    return '구성원 초대에 문제가 있었어요'
  }

  async function handleSubmit() {
    if (invites.length === 0 || isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm?.(
        invites.map(({ name, email, role_code, employment_type }) => ({
          name,
          email,
          role_code,
          employment_type
        }))
      )
      closeModal()
    } catch (error) {
      snackbarStore.error(extractApiError(error))
    } finally {
      isSubmitting = false
    }
  }
</script>

{#snippet header()}
  <div class="flex items-start justify-between">
    <div>
      <h2 class="text-headline-02-normal-semibold text-gray-900">
        구성원을 초대할게요
      </h2>
      <p class="mt-2 text-body-02-normal-regular text-gray-600">
        구성원 초대에 필요한 정보를 입력해주세요
      </p>
    </div>
    <Tooltip text="닫기">
      <button
        class="h-8 w-8 rounded-full text-gray-500 transition hover:bg-gray-100"
        onclick={closeModal}
        aria-label="close"
      >
        <CloseIcon />
      </button>
    </Tooltip>
  </div>
{/snippet}

{#snippet body()}
  <div class="flex flex-col gap-4">
    <!-- 이름·이메일 / 역할·근무형태·추가를 한 그리드로 묶는다 —
         행을 나누면 1행(2열)과 2행(2열+버튼)의 1fr 폭이 달라져 인풋이 어긋난다.
         한 그리드면 열 폭이 두 행에 공유된다 (행 간격은 gap-y-4) -->
    <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-x-3 gap-y-4">
      <div class="relative flex flex-col gap-2 pb-6">
        <label
          class="text-body-03-normal-medium text-gray-600"
          for="invite-name">이름</label
        >
        <input
          id="invite-name"
          type="text"
          bind:value={name}
          placeholder="이름을 입력해주세요"
          class="h-12 w-full rounded-lg border px-2.5 text-body-02-normal-regular placeholder:text-placeholder focus:border-border-active focus:outline-none {fieldErrors.name
            ? 'border-red-400'
            : 'border-gray-200'}"
        />
        {#if fieldErrors.name}
          <p
            class="absolute bottom-0 flex items-center gap-2 field-help is-error"
          >
            <span class="flex shrink-0" aria-hidden="true"
              ><ErrorCircleRedIcon20 /></span
            >
            {fieldErrors.name}
          </p>
        {/if}
      </div>
      <div class="relative flex flex-col gap-2 pb-6">
        <label
          class="text-body-03-normal-medium text-gray-600"
          for="invite-email">이메일</label
        >
        <input
          id="invite-email"
          type="email"
          bind:value={email}
          placeholder="example@mail.com"
          class="h-12 w-full rounded-lg border px-2.5 text-body-02-normal-regular placeholder:text-placeholder focus:border-border-active focus:outline-none {fieldErrors.email
            ? 'border-red-400'
            : 'border-gray-200'}"
        />
        {#if fieldErrors.email}
          <p
            class="absolute bottom-0 flex items-center gap-2 field-help is-error"
          >
            <span class="flex shrink-0" aria-hidden="true"
              ><ErrorCircleRedIcon20 /></span
            >
            {fieldErrors.email}
          </p>
        {/if}
      </div>
      <!-- 1행의 버튼 열 자리 (비움) -->
      <div></div>
      <div class="relative flex flex-col gap-2 pb-6">
        <label
          class="text-body-03-normal-medium text-gray-600"
          for="invite-role">역할</label
        >
        <Select
          id="invite-role"
          class="w-full rounded-lg {fieldErrors.role_code
            ? '!border-red-400'
            : ''}"
          placeholder="역할 선택"
          options={roleOptions}
          selected={roleId}
          on:change={(e) => (roleId = e.detail.value)}
        />
        {#if fieldErrors.role_code}
          <p
            class="absolute bottom-0 flex items-center gap-2 field-help is-error"
          >
            <span class="flex shrink-0" aria-hidden="true"
              ><ErrorCircleRedIcon20 /></span
            >
            {fieldErrors.role_code}
          </p>
        {/if}
      </div>
      <div class="relative flex flex-col gap-2 pb-6">
        <label
          class="text-body-03-normal-medium text-gray-600"
          for="invite-worktype">근무형태</label
        >
        <Select
          id="invite-worktype"
          class="w-full rounded-lg {fieldErrors.employment_type
            ? '!border-red-400'
            : ''}"
          placeholder="근무형태 선택"
          options={employmentTypeOptions}
          selected={employmentType}
          on:change={(e) => (employmentType = e.detail.value)}
        />
        {#if fieldErrors.employment_type}
          <p
            class="absolute bottom-0 flex items-center gap-2 field-help is-error"
          >
            <span class="flex shrink-0" aria-hidden="true"
              ><ErrorCircleRedIcon20 /></span
            >
            {fieldErrors.employment_type}
          </p>
        {/if}
      </div>
      <!-- 필드 컨테이너와 같은 하단 확보값 — items-end 기준선이 어긋나면 버튼만 아래로 내려간다 -->
      <div class="pb-6">
        <!-- button-tertiary(Gray solid) — 모달의 Primary는 푸터의 '초대'가 소유한다.
             Title(44) 규격: 높이 44 · 좌우 20 · 레이블 16 · 아이콘 20 · gap 8 -->
        <button
          type="button"
          onclick={handleAdd}
          class="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-100 px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          <PlusIcon20 />
          추가
        </button>
      </div>
    </div>

    {#if invites.length > 0}
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        <div
          class="grid grid-cols-[80px_1fr_64px_72px_32px] items-center bg-white px-5 py-3 text-body-03-normal-medium text-gray-500 border-b border-gray-100"
        >
          <span>이름</span>
          <span>이메일</span>
          <span>역할</span>
          <span>근무형태</span>
          <span></span>
        </div>
        <div class="max-h-[200px] overflow-y-auto bg-white">
          {#each invites as inv}
            <div
              class="grid grid-cols-[80px_1fr_64px_72px_32px] items-center px-5 py-3 border-b border-gray-100 last:border-b-0"
            >
              <span
                class="truncate-safe text-body-02-normal-regular text-gray-800"
              >
                {inv.name}
              </span>
              <span class="break-all text-body-02-normal-regular text-gray-800">
                {inv.email}
              </span>
              <span class="text-body-02-normal-regular text-gray-700">
                {roleOptions.find((r) => r.value === inv.role_code)?.title}
              </span>
              <span class="text-body-02-normal-regular text-gray-700">
                {employmentTypeOptions.find(
                  (w) => w.value === inv.employment_type
                )?.title}
              </span>
              <div class="flex justify-end">
                <Tooltip text="제거">
                  <button
                    class="cursor-pointer"
                    onclick={() => handleRemove(inv.id)}
                    aria-label="remove"
                  >
                    <CircleClose />
                  </button>
                </Tooltip>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet footer()}
  <div class="w-[109px] h-[52px] rounded-[8px]">
    <Button
      class="h-11 w-full justify-center bg-primary-500 text-white rounded-[8px]
        disabled:opacity-50 disabled:cursor-not-allowed"
      onclick={handleSubmit}
      disabled={invites.length === 0 || isSubmitting}
    >
      <Typography variant="body-01-normal-medium" color="text-white">
        {isSubmitting ? '처리 중...' : '초대'}
      </Typography>
    </Button>
  </div>
{/snippet}

<BaseModal
  {modalId}
  {closeModal}
  size="fit"
  showHeaderBorder={true}
  showFooterBorder={true}
  headerClass="px-5 py-4"
  footerClass="px-5 pt-4 pb-5"
  bodyClass="p-5 pb-7"
  containerClass=" min-h-[378px] max-h-[90vh]"
  bodyScrollable={false}
  {header}
  {body}
  {footer}
/>
