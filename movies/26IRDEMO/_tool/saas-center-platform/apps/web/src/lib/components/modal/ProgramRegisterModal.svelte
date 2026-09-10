<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { useQueryClient } from '@tanstack/svelte-query'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ManagerSearchDropdown from '../searchInput/ManagerSearchDropdown.svelte'
  import SpecialistChip from '../chip/SpecialistChip.svelte'
  import CustomInputSelect from '../CustomInputSelect.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    createProgram,
    updateProgram,
    type ProgramType
  } from '$lib/hooks/actions/program.action'

  type ProgramFieldErrors = Partial<
    Record<'name' | 'managers' | 'price' | 'duration', string>
  >

  interface ManagerItem {
    id: string
    name: string
  }

  interface Props {
    modalId?: string
    program_id?: string
    initial_name?: string
    initial_price?: number
    initial_duration_minutes?: number
    initial_program_type?: ProgramType
    initial_managers?: ManagerItem[]
    closeModal?: () => void
    onSuccessAfterCreate?: (
      created: import('$lib/hooks/actions/program.action').ProgramDetail
    ) => void
  }

  let {
    modalId = '',
    program_id = '',
    initial_name = '',
    initial_price = 0,
    initial_duration_minutes = 0,
    initial_program_type = 'INDIVIDUAL',
    initial_managers = [],
    closeModal = () => {},
    onSuccessAfterCreate
  }: Props = $props()
  const queryClient = useQueryClient()

  const format = (value: number) => (value ? value.toLocaleString('ko-KR') : '')

  // 폼 상태
  let name = $state('')
  let specialist_id = $state('')
  let checkedSpecialists = $state<ManagerItem[]>([])
  let price = $state(0)
  let duration_minutes = $state(0)
  let program_type = $state<ProgramType>('INDIVIDUAL')
  let displayPrice = $state('')
  let isInitialized = $state(false)
  let fieldErrors = $state<ProgramFieldErrors>({})
  let loading = $state(false)

  $effect(() => {
    if (isInitialized) return
    name = initial_name
    checkedSpecialists = initial_managers
    price = initial_price
    duration_minutes = initial_duration_minutes
    program_type = initial_program_type
    displayPrice = format(initial_price)
    isInitialized = true
  })

  const handleInputPrice = (e: Event) => {
    const input = e.target as HTMLInputElement
    const digits = input.value.replace(/[^0-9]/g, '')
    const numeric = digits ? parseInt(digits, 10) : 0
    price = numeric
    displayPrice = digits ? numeric.toLocaleString('ko-KR') : ''
    if (fieldErrors.price) fieldErrors = { ...fieldErrors, price: undefined }
  }

  // 유효성 검증
  function validate(): ProgramFieldErrors {
    const errors: ProgramFieldErrors = {}
    if (!name.trim()) errors.name = '프로그램명을 입력해주세요.'
    if (checkedSpecialists.length === 0)
      errors.managers = '담당자를 선택해주세요.'
    if (!duration_minutes) {
      errors.duration = '소요시간을 선택해주세요.'
    } else if (duration_minutes < 1 || duration_minutes > 480) {
      errors.duration = '소요시간은 1~480분 사이여야 합니다.'
    }
    return errors
  }

  // 값이 유효해지면 해당 필드 에러 자동 클리어
  $effect(() => {
    if (fieldErrors.name && name.trim())
      fieldErrors = { ...fieldErrors, name: undefined }
  })
  $effect(() => {
    if (fieldErrors.managers && checkedSpecialists.length > 0)
      fieldErrors = { ...fieldErrors, managers: undefined }
  })
  $effect(() => {
    if (
      fieldErrors.duration &&
      duration_minutes >= 1 &&
      duration_minutes <= 480
    )
      fieldErrors = { ...fieldErrors, duration: undefined }
  })

  /** 필드 순서 기준 첫 번째 에러 필드 */
  const FIELD_ORDER: (keyof ProgramFieldErrors)[] = [
    'name',
    'managers',
    'price',
    'duration'
  ]
  const firstErrorField = $derived(FIELD_ORDER.find((f) => fieldErrors[f]))

  /** 백엔드 필드명 → 프론트엔드 필드명 매핑 */
  const BACKEND_FIELD_MAP: Record<string, keyof ProgramFieldErrors> = {
    name: 'name',
    member_ids: 'managers',
    price: 'price',
    duration_minutes: 'duration'
  }

  /** Pydantic 에러 type → 한국어 메시지 */
  const PYDANTIC_ERROR_MESSAGES: Record<string, string> = {
    int_parsing_size: '입력한 값이 너무 큽니다.',
    int_parsing: '숫자만 입력 가능합니다.',
    greater_than_equal: '값이 너무 작습니다.',
    less_than_equal: '값이 너무 큽니다.',
    string_too_short: '값이 너무 짧습니다.',
    string_too_long: '값이 너무 깁니다.',
    missing: '필수 항목입니다.'
  }

  /** Pydantic 422 에러에서 fieldErrors 매핑. 매핑된 에러가 있으면 반환 */
  function extractFieldErrors(err: unknown): ProgramFieldErrors | null {
    if (!(err && typeof err === 'object' && 'response' in err)) return null
    const res = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = res?.data?.detail
    if (!Array.isArray(detail)) return null

    const mapped: ProgramFieldErrors = {}
    let hasFieldError = false
    for (const item of detail) {
      const loc = item.loc as string[] | undefined
      const field = loc?.find((l: string) => BACKEND_FIELD_MAP[l])
      if (field) {
        const key = BACKEND_FIELD_MAP[field]
        mapped[key] =
          PYDANTIC_ERROR_MESSAGES[item.type] ||
          item.msg ||
          '유효하지 않은 값입니다.'
        hasFieldError = true
      }
    }
    return hasFieldError ? mapped : null
  }

  /** AxiosError 응답에서 사용자용 메시지 추출 */
  function extractApiError(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { data?: { detail?: unknown } } })
        .response
      const detail = res?.data?.detail
      if (typeof detail === 'string') return detail
    }
    return '프로그램 처리에 문제가 있었어요'
  }

  const handleConfirm = async () => {
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      fieldErrors = errors
      return
    }

    loading = true

    try {
      const centerId = requireCenterId()

      let created: Awaited<
        ReturnType<ReturnType<typeof createProgram>['request']>
      > | null = null
      if (program_id) {
        await updateProgram().request({
          centerId,
          programId: program_id,
          name,
          program_type,
          price,
          duration_minutes,
          member_ids: checkedSpecialists.map((manager) => manager.id)
        })
      } else {
        created = await createProgram().request({
          centerId,
          name,
          member_ids: checkedSpecialists.map((manager) => manager.id),
          program_type,
          price,
          duration_minutes
        })
      }

      await queryClient.invalidateQueries({
        queryKey: ['getProgramList'],
        exact: false
      })

      snackbarStore.success(
        program_id ? '프로그램을 수정했어요' : '신규 프로그램 생성을 완료했어요'
      )
      if (created) onSuccessAfterCreate?.(created)
      closeModal()
    } catch (error) {
      const mapped = extractFieldErrors(error)
      if (mapped) {
        fieldErrors = mapped
      } else {
        snackbarStore.error(extractApiError(error))
      }
    } finally {
      loading = false
    }
  }

  const programTypes: { label: string; value: ProgramType }[] = [
    { label: '개별', value: 'INDIVIDUAL' },
    { label: '그룹', value: 'GROUP' }
  ]

  const canSubmit = $derived(
    name.trim().length > 0 &&
      checkedSpecialists.length > 0 &&
      price >= 0 &&
      duration_minutes > 0
  )

  const toggleManager = (manager: ManagerItem) => {
    const exists = checkedSpecialists.some((m) => m.id === manager.id)
    checkedSpecialists = exists
      ? checkedSpecialists.filter((m) => m.id !== manager.id)
      : [...checkedSpecialists, manager]
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
  title="프로그램 정보를 입력해주세요"
>
  {#snippet body()}
    <div class="flex max-h-162.5 flex-col">
      <div class="mb-6">
        <label for="name" class="field-label mb-2">
          프로그램명
          <span class="field-required">*</span>
        </label>
        <input
          type="text"
          name="name"
          bind:value={name}
          placeholder="프로그램명을 입력해주세요"
          class="field-input {fieldErrors.name ? 'is-error' : ''}"
        />
        {#if firstErrorField === 'name'}
          <p class="mt-1 field-help is-error">{fieldErrors.name}</p>
        {/if}
      </div>
      <div class="mb-6">
        <label for="specialist_id" class="field-label mb-2">
          담당자
          <span class="field-required">*</span>
        </label>
        <ManagerSearchDropdown
          bind:checkedSpecialists
          searchQuery={specialist_id}
        />
        <div class="flex gap-2 items-center flex-wrap mt-2">
          {#each checkedSpecialists as specialist}
            <SpecialistChip manager={specialist} {toggleManager} />
          {/each}
        </div>
        {#if firstErrorField === 'managers'}
          <p class="mt-1 field-help is-error">
            {fieldErrors.managers}
          </p>
        {/if}
      </div>
      <div class="mb-6">
        <label for="price" class="field-label mb-2">
          금액
          <span class="field-required">*</span>
        </label>
        <input
          type="text"
          inputmode="numeric"
          placeholder="금액을 입력해주세요"
          value={displayPrice}
          oninput={handleInputPrice}
          class="field-input {fieldErrors.price ? 'is-error' : ''}"
        />
        {#if firstErrorField === 'price'}
          <p class="mt-1 field-help is-error">{fieldErrors.price}</p>
        {/if}
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          소요시간
          <span class="field-required">*</span>
        </Typography>
        <CustomInputSelect
          bind:value={duration_minutes}
          option={[30, 50, 60, 90, 120, 180, 240]}
        />
        {#if firstErrorField === 'duration'}
          <p class="mt-1 field-help is-error">
            {fieldErrors.duration}
          </p>
        {/if}
      </div>
      <div class="mb-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          프로그램 유형
        </Typography>
        <div class="flex w-full gap-2">
          {#each programTypes as type}
            <button
              onclick={() => (program_type = type.value)}
              class={twMerge(
                'flex-center border border-gray-200 rounded-lg w-full h-11 duration-200',
                program_type === type.value
                  ? 'border-primary-500 bg-[#F4F8FF]'
                  : ''
              )}
            >
              <Typography
                variant="body-02-medium"
                color={program_type === type.value
                  ? 'text-primary-500'
                  : 'text-gray-500'}
              >
                {type.label}
              </Typography>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        disabled={!canSubmit}
        class={twMerge(
          'flex h-11 w-40 items-center justify-center rounded-lg transition-colors',
          canSubmit
            ? 'bg-primary-500 hover:bg-primary-600 text-white'
            : 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {loading ? '처리 중...' : '등록'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
