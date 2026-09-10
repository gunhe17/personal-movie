<script lang="ts">
  import { REFERRAL_SOURCE_OPTIONS } from '../constants'
  import type { ClientFormData } from '../types'
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import Select from '$components/ui/Select.svelte'
  import FormField, {
    FIELD_INPUT_CLASS,
    FIELD_TEXTAREA_CLASS
  } from '$components/ui/FormField.svelte'
  import DatePickerInput from '$lib/components/ui/DatePickerInput.svelte'

  let {
    title = '내담자 등록',
    initialData,
    onConfirm,
    closeModal
  }: {
    title?: string
    initialData?: Partial<ClientFormData>
    onConfirm: (data: ClientFormData) => Promise<void>
    closeModal: () => void
    modalId?: string
  } = $props()

  let name = $state(initialData?.name ?? '')
  let birthDate = $state(initialData?.birth_date ?? '')
  // 선택 해제 시 Select가 undefined를 넣는다 (아래 payload는 truthy일 때만 싣는다)
  let gender = $state<string | undefined>(initialData?.gender ?? '')
  let phone = $state(initialData?.phone ?? '')
  let email = $state(initialData?.email ?? '')
  let educationLevel = $state(initialData?.education_level ?? '')
  let occupation = $state(initialData?.occupation ?? '')
  let referralSource = $state<string | undefined>(initialData?.referral_source ?? '')
  let note = $state(initialData?.note ?? '')
  let isSubmitting = $state(false)

  /**
   * 선택형 필드는 '선택 안함' 옵션을 목록에 넣는 대신 Select의 clearable을 쓴다.
   * 값이 있을 때만 X가 떠서 지울 수 있고, 빈 상태는 placeholder로 드러난다.
   */
  const GENDER_OPTIONS = [
    { value: 'male', label: '남성' },
    { value: 'female', label: '여성' }
  ] as const

  let isValid = $derived(name.trim().length > 0)

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    isSubmitting = true
    try {
      const data: ClientFormData = {
        name: name.trim(),
        ...(birthDate && { birth_date: birthDate }),
        ...(gender && { gender }),
        ...(phone && { phone: phone.trim() }),
        ...(email && { email: email.trim() }),
        ...(educationLevel && { education_level: educationLevel }),
        ...(occupation && { occupation: occupation.trim() }),
        ...(referralSource && { referral_source: referralSource }),
        ...(note && { note: note.trim() })
      }
      await onConfirm(data)
      closeModal()
    } catch {
      // error handled by service
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal {closeModal} {title} description="내담자 정보를 입력해주세요">
  {#snippet body()}
  <form
    class="flex flex-col gap-4"
    onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
  >
    <!-- 이름 (필수) -->
    <FormField label="이름" id="client-name" required>
      <input
        id="client-name"
        type="text"
        bind:value={name}
        placeholder="내담자 이름"
        class={FIELD_INPUT_CLASS}
      />
    </FormField>

    <!-- 생년월일 / 성별 -->
    <div class="grid grid-cols-2 gap-3">
      <FormField label="생년월일">
        <DatePickerInput bind:value={birthDate} />
      </FormField>
      <FormField label="성별">
        <Select
          options={GENDER_OPTIONS}
          bind:value={gender}
          placeholder="선택 안함"
          ariaLabel="성별"
          clearable
          fullWidth
          className="w-full"
        />
      </FormField>
    </div>

    <!-- 연락처 / 이메일 -->
    <div class="grid grid-cols-2 gap-3">
      <FormField label="연락처" id="client-phone">
        <input
          id="client-phone"
          type="tel"
          bind:value={phone}
          placeholder="010-0000-0000"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>
      <FormField label="이메일" id="client-email">
        <input
          id="client-email"
          type="email"
          bind:value={email}
          placeholder="example@email.com"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>
    </div>

    <!-- 학력 / 직업 -->
    <div class="grid grid-cols-2 gap-3">
      <FormField label="학력" id="client-edu">
        <input
          id="client-edu"
          type="text"
          bind:value={educationLevel}
          placeholder="예: 대학교 졸업"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>
      <FormField label="직업" id="client-job">
        <input
          id="client-job"
          type="text"
          bind:value={occupation}
          placeholder="예: 교사"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>
    </div>

    <!-- 의뢰 경로 -->
    <FormField label="의뢰 경로">
      <Select
        options={REFERRAL_SOURCE_OPTIONS}
        bind:value={referralSource}
        placeholder="선택 안함"
        ariaLabel="의뢰 경로"
        clearable
        fullWidth
        className="w-full"
      />
    </FormField>

    <!-- 비고 -->
    <FormField label="비고" id="client-note">
      <textarea
        id="client-note"
        bind:value={note}
        rows={4}
        placeholder="특이사항이나 메모를 입력하세요"
        class={FIELD_TEXTAREA_CLASS}
      ></textarea>
    </FormField>
  </form>
  {/snippet}

  {#snippet footer()}
    <Button variant="outlineSecondary" size="md" onclick={closeModal}>취소</Button>
    <Button
      variant="primary"
      size="md"
      loading={isSubmitting}
      disabled={!isValid}
      onclick={handleSubmit}
    >
      {initialData ? '수정' : '등록'}
    </Button>
  {/snippet}
</BaseModal>
