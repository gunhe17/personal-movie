<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import Select from '$components/ui/Select.svelte'
  import FormField, { FIELD_INPUT_CLASS } from '$components/ui/FormField.svelte'
  import { ROLE_OPTIONS } from '../constants'

  let {
    initialData,
    onConfirm,
    closeModal
  }: {
    initialData: { name: string; role: string }
    onConfirm: (data: { name: string; role: string }) => Promise<void>
    closeModal: () => void
    modalId?: string
  } = $props()

  let name = $state(initialData.name)
  let role = $state(initialData.role)
  let isSubmitting = $state(false)

  let isValid = $derived(name.trim().length > 0)

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm({ name: name.trim(), role })
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
  title="직원 정보 수정"
  description="이름과 역할을 변경할 수 있습니다"
>
  {#snippet body()}
    <form
      id="member-edit-form"
      class="flex flex-col gap-4"
      onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
    >
      <!-- 이름 -->
      <FormField label="이름" id="member-name" required>
        <input
          id="member-name"
          type="text"
          bind:value={name}
          placeholder="직원 이름"
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
    <Button variant="outlineSecondary" size="md" onclick={closeModal}>취소</Button>
    <Button
      type="submit"
      variant="primary"
      size="md"
      loading={isSubmitting}
      disabled={!isValid}
      onclick={handleSubmit}
    >
      저장
    </Button>
  {/snippet}
</BaseModal>
