<!--
  CertificationCredentialModal
  자격증 항목 추가/수정 모달 (증빙 파일 업로드 포함)

  공통 시그니처: onConfirm(form, file, removeAttachment)
-->
<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import DatePickerInput from '$lib/components/DatePickerInput.svelte'

  import type { CertificationFormData } from '$lib/features/credentials'
  import type { CredentialAttachment } from '$lib/hooks/actions/credential.action'

  import CredentialAttachmentField from './CredentialAttachmentField.svelte'

  interface Props {
    modalId?: string
    isEditMode: boolean
    initialData?: CertificationFormData
    existingAttachment?: CredentialAttachment | null
    onConfirm: (
      form: CertificationFormData,
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

  let form = $state<CertificationFormData>({
    name: initialData?.name ?? '',
    issuer: initialData?.issuer ?? '',
    certificate_number: initialData?.certificate_number ?? '',
    issued_date: initialData?.issued_date ?? '',
    expires_at: initialData?.expires_at ?? ''
  })

  let file = $state<File | null>(null)
  let removeAttachment = $state(false)
  let submitting = $state(false)

  const isValid = $derived(
    form.name.trim().length > 0 &&
      form.issuer.trim().length > 0 &&
      form.certificate_number.trim().length > 0
  )

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
  size="lg"
  footerClass="px-5 pt-4 pb-5"
  title={isEditMode ? '자격증을 수정할게요' : '자격증을 추가할게요'}
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
          >자격증명 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.name}
          placeholder="예: 임상심리사 1급"
          class="field-input w-full"
        />
      </div>

      <div>
        <label class="field-label mb-2"
          >발급 기관 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.issuer}
          placeholder="예: 한국심리학회"
          class="field-input w-full"
        />
      </div>

      <div>
        <label class="field-label mb-2"
          >자격증 번호 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.certificate_number}
          placeholder="예: 제2020-12345호"
          class="field-input w-full"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label class="field-label mb-2">발급일</label>
          <DatePickerInput
            bind:value={form.issued_date}
            placeholder="YYYY-MM-DD"
          />
        </div>
        <div>
          <label class="field-label mb-2">만료일 (선택)</label>
          <DatePickerInput
            bind:value={form.expires_at}
            placeholder="YYYY-MM-DD"
          />
        </div>
      </div>

      <div>
        <label class="field-label mb-2">증빙 파일</label>
        <CredentialAttachmentField
          bind:file
          bind:removeExisting={removeAttachment}
          {existingAttachment}
          helperText="자격증 사본을 첨부해주세요. PDF, JPG, PNG · 10MB 이하. 검증 시 관리자가 확인해요."
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
