<!--
  EducationCredentialModal
  학력 항목 추가/수정 모달

  공통 시그니처: onConfirm(form, file, removeAttachment)
-->
<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import DatePickerInput from '$lib/components/DatePickerInput.svelte'

  import {
    DEGREE_OPTIONS,
    type EducationFormData
  } from '$lib/features/credentials'
  import type { CredentialAttachment } from '$lib/hooks/actions/credential.action'

  import CredentialAttachmentField from './CredentialAttachmentField.svelte'

  interface Props {
    modalId?: string
    isEditMode: boolean
    initialData?: EducationFormData
    existingAttachment?: CredentialAttachment | null
    onConfirm: (
      form: EducationFormData,
      file: File | null,
      removeAttachment: boolean
    ) => Promise<void>
    closeModal?: () => void
  }

  let {
    modalId = '',
    isEditMode,
    initialData,
    existingAttachment = null,
    onConfirm,
    closeModal = () => {}
  }: Props = $props()

  let form = $state<EducationFormData>({
    school: initialData?.school ?? '',
    major: initialData?.major ?? '',
    degree: initialData?.degree ?? 'bachelor',
    start_date: initialData?.start_date ?? '',
    end_date: initialData?.end_date ?? '',
    is_attending: initialData?.is_attending ?? false
  })

  let file = $state<File | null>(null)
  let removeAttachment = $state(false)
  let submitting = $state(false)

  const degreeOptions = DEGREE_OPTIONS.map((opt) => ({
    value: opt.value,
    title: opt.label
  }))

  const isValid = $derived(
    form.school.trim().length > 0 && form.major.trim().length > 0
  )

  // 재학 중 토글되면 종료일 자동 비움
  $effect(() => {
    if (form.is_attending && form.end_date) {
      form.end_date = ''
    }
  })

  async function handleSubmit() {
    if (!isValid || submitting) return
    submitting = true
    try {
      await onConfirm(form, file, removeAttachment)
      closeModal()
    } finally {
      submitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="md"
  headerClass="px-5 py-4"
  footerClass="px-5 pt-4 pb-5"
  title={isEditMode ? '학력을 수정할게요' : '학력을 추가할게요'}
>
  {#snippet body()}
    <div class="w-full p-5 pb-7 space-y-6 max-h-[65vh] overflow-y-auto">
      {#if isEditMode}
        <div
          class="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700"
        >
          수정하면 검증 상태가 초기화돼요. 검증이 다시 필요해요.
        </div>
      {/if}

      <div>
        <label class="field-label mb-2"
          >학교명 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.school}
          placeholder="예: 서울대학교"
          class="field-input w-full"
        />
      </div>

      <!-- 전공·학위 + 재학 중 = 한 그룹(내부 12). 체크박스에 mt를 걸면 안 된다 —
           Tailwind v4의 space-y는 앞 형제의 margin-bottom으로 간격을 만들기 때문 -->
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="field-label mb-2"
              >전공 <span class="field-required">*</span></label
            >
            <input
              type="text"
              bind:value={form.major}
              placeholder="예: 심리학과"
              class="field-input w-full"
            />
          </div>
          <div>
            <label class="field-label mb-2"
              >학위 <span class="field-required">*</span></label
            >
            <Select
              options={degreeOptions}
              bind:selected={form.degree}
              on:change={(e) => {
                const v = (e as CustomEvent).detail
                form.degree =
                  typeof v === 'object' && v !== null
                    ? (v.value as typeof form.degree)
                    : (v as typeof form.degree)
              }}
            />
          </div>
        </div>

        <label
          for="education-is-attending"
          class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
        >
          <Checkbox
            id="education-is-attending"
            bind:checked={form.is_attending}
          />
          재학 중이에요
        </label>
      </div>

      <div
        class="grid grid-cols-1 gap-4"
        class:md:grid-cols-2={!form.is_attending}
      >
        <div>
          <label class="field-label mb-2">입학일</label>
          <DatePickerInput
            bind:value={form.start_date}
            placeholder="YYYY-MM-DD"
          />
        </div>
        {#if !form.is_attending}
          <div>
            <label class="field-label mb-2">졸업일</label>
            <DatePickerInput
              bind:value={form.end_date}
              placeholder="YYYY-MM-DD"
            />
          </div>
        {/if}
      </div>

      <div>
        <label class="field-label mb-2">증빙 파일 (선택)</label>
        <CredentialAttachmentField
          bind:file
          bind:removeExisting={removeAttachment}
          {existingAttachment}
          helperText="졸업증명서 등을 첨부할 수 있어요. PDF, JPG, PNG · 10MB 이하."
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleSubmit}
        disabled={!isValid || submitting}
        class="flex h-11 w-32 items-center justify-center rounded-lg transition-colors {isValid &&
        !submitting
          ? 'bg-primary-500 text-white hover:bg-primary-600'
          : 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'}"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isEditMode ? '수정' : '추가'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
