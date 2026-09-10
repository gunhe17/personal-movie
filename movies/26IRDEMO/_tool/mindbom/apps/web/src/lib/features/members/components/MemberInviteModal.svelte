<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import Select from '$components/ui/Select.svelte'
  import FormField, { FIELD_INPUT_CLASS } from '$components/ui/FormField.svelte'
  import { ROLE_OPTIONS } from '../constants'

  let {
    onConfirm,
    closeModal
  }: {
    onConfirm: (data: {
      name: string
      email: string
      role: string
    }) => Promise<void>
    closeModal: () => void
    modalId?: string
  } = $props()

  let name = $state('')
  let email = $state('')
  let role = $state('clinician')
  let isSubmitting = $state(false)

  let isValid = $derived(name.trim().length > 0 && email.trim().length > 0)

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm({
        name: name.trim(),
        email: email.trim(),
        role
      })
      closeModal()
    } catch {
      // error handled by service
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {closeModal}
  title="직원 초대"
  description="이메일로 초대 링크를 발송합니다."
>
  {#snippet body()}
    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <!-- 이름 -->
      <FormField label="이름" id="member-name" required>
        <input
          id="member-name"
          type="text"
          autocomplete="name"
          required
          maxlength="100"
          bind:value={name}
          placeholder="직원 이름"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>

      <!-- 이메일 -->
      <FormField
        label="이메일"
        id="member-email"
        required
        hint="초대 링크는 7일간 유효합니다."
      >
        <input
          id="member-email"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
          placeholder="email@example.com"
          class={FIELD_INPUT_CLASS}
        />
      </FormField>

      <!-- 역할 — 패널은 Select가 portal로 띄운다(모달 카드 overflow-hidden 회피) -->
      <FormField label="역할" required>
        <Select
          options={ROLE_OPTIONS}
          bind:value={role}
          ariaLabel="역할"
          fullWidth
          className="w-full"
        />
      </FormField>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button variant="outlineSecondary" size="md" onclick={closeModal}
      >취소</Button
    >
    <Button
      variant="primary"
      size="md"
      loading={isSubmitting}
      disabled={!isValid}
      onclick={handleSubmit}
    >
      초대 메일 발송
    </Button>
  {/snippet}
</BaseModal>
