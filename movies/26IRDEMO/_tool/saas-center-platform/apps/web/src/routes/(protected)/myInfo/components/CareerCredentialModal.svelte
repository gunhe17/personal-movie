<!--
  CareerCredentialModal
  경력 항목 추가/수정 모달
-->
<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import DatePickerInput from '$lib/components/DatePickerInput.svelte'

  import type { CareerFormData } from '$lib/features/credentials'
  import type { CredentialAttachment } from '$lib/hooks/actions/credential.action'

  import CredentialAttachmentField from './CredentialAttachmentField.svelte'

  interface Props {
    modalId?: string
    isEditMode: boolean
    initialData?: CareerFormData
    existingAttachment?: CredentialAttachment | null
    onConfirm: (
      form: CareerFormData,
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

  let form = $state<CareerFormData>({
    organization: initialData?.organization ?? '',
    position: initialData?.position ?? '',
    description: initialData?.description ?? '',
    start_date: initialData?.start_date ?? '',
    end_date: initialData?.end_date ?? '',
    is_current: initialData?.is_current ?? false
  })

  let file = $state<File | null>(null)
  let removeAttachment = $state(false)
  let submitting = $state(false)

  const isValid = $derived(
    form.organization.trim().length > 0 && form.position.trim().length > 0
  )

  $effect(() => {
    if (form.is_current && form.end_date) {
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
  footerClass="px-5 pt-4 pb-5"
  title={isEditMode ? '경력을 수정할게요' : '경력을 추가할게요'}
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
          >기관/회사 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.organization}
          placeholder="예: ○○상담센터"
          class="field-input block w-full"
        />
      </div>

      <div>
        <label class="field-label mb-2"
          >직책 <span class="field-required">*</span></label
        >
        <input
          type="text"
          bind:value={form.position}
          placeholder="예: 선임상담사"
          class="field-input block w-full"
        />
      </div>

      <div>
        <label class="field-label mb-2">담당 업무 (선택)</label>
        <textarea
          bind:value={form.description}
          rows="2"
          placeholder="예: 성인 정신건강 상담"
          class="block w-full rounded-lg border border-gray-200 bg-white text-body-03-reading-regular outline-none focus:border-border-active resize-none px-3 py-3.5"
        ></textarea>
      </div>

      <!-- 기간 + 재직 중 = 한 그룹(내부 12). 체크박스에 mt를 걸면 안 된다 —
           Tailwind v4의 space-y는 앞 형제의 margin-bottom으로 간격을 만들기 때문 -->
      <div class="space-y-3">
        <div
          class="grid grid-cols-1 gap-4"
          class:md:grid-cols-2={!form.is_current}
        >
          <div>
            <label class="field-label mb-2">입사일</label>
            <DatePickerInput
              bind:value={form.start_date}
              placeholder="YYYY-MM-DD"
            />
          </div>
          {#if !form.is_current}
            <div>
              <label class="field-label mb-2">퇴사일</label>
              <DatePickerInput
                bind:value={form.end_date}
                placeholder="YYYY-MM-DD"
              />
            </div>
          {/if}
        </div>

        <label
          for="career-is-current"
          class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
        >
          <Checkbox id="career-is-current" bind:checked={form.is_current} />
          재직 중이에요
        </label>
      </div>

      <div>
        <label class="field-label mb-2">증빙 파일 (선택)</label>
        <CredentialAttachmentField
          bind:file
          bind:removeExisting={removeAttachment}
          {existingAttachment}
          helperText="재직증명서, 경력증명서 등을 첨부할 수 있어요. PDF, JPG, PNG · 10MB 이하."
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
