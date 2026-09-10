<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import FormField, { FIELD_INPUT_CLASS } from '$components/ui/FormField.svelte'
  import PasswordPolicyList, {
    passwordMeetsPolicy
  } from '$components/ui/PasswordPolicyList.svelte'

  let {
    onConfirm,
    closeModal
  }: {
    onConfirm: (data: { current_password: string; new_password: string }) => Promise<void>
    closeModal: () => void
    modalId?: string
  } = $props()

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let isSubmitting = $state(false)
  let errorMessage = $state<string | null>(null)

  // 정책 규칙은 PasswordPolicyList가 갖는다 (백엔드 password_policy.py와 동기).
  let policyOk = $derived(passwordMeetsPolicy(newPassword))
  let confirmMatches = $derived(newPassword.length > 0 && newPassword === confirmPassword)
  let differentFromCurrent = $derived(
    newPassword.length === 0 || currentPassword !== newPassword
  )

  let isValid = $derived(
    currentPassword.length > 0 && policyOk && confirmMatches && differentFromCurrent
  )

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    isSubmitting = true
    errorMessage = null
    try {
      await onConfirm({
        current_password: currentPassword,
        new_password: newPassword
      })
      closeModal()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      errorMessage = typeof detail === 'string' ? detail : '비밀번호 변경에 실패했습니다.'
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {closeModal}
  title="비밀번호 변경"
  description="변경 후 모든 세션이 만료되어 다시 로그인해야 합니다."
>
  {#snippet body()}
  <form
    class="flex flex-col gap-4"
    onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
  >
    <!-- 현재 비밀번호 -->
    <FormField label="현재 비밀번호" id="pw-current" required>
      <input
        id="pw-current"
        type="password"
        bind:value={currentPassword}
        autocomplete="current-password"
        class={FIELD_INPUT_CLASS}
      />
    </FormField>

    <!-- 새 비밀번호 -->
    <FormField label="새 비밀번호" id="pw-new" required>
      <input
        id="pw-new"
        type="password"
        bind:value={newPassword}
        autocomplete="new-password"
        class={FIELD_INPUT_CLASS}
      />
      <PasswordPolicyList
        value={newPassword}
        extra={[{ label: '현재와 다름', ok: differentFromCurrent }]}
      />
    </FormField>

    <!-- 새 비밀번호 확인 -->
    <FormField label="새 비밀번호 확인" id="pw-confirm" required>
      <input
        id="pw-confirm"
        type="password"
        bind:value={confirmPassword}
        autocomplete="new-password"
        class={FIELD_INPUT_CLASS}
      />
      {#if confirmPassword.length > 0 && !confirmMatches}
        <!-- 간격은 FormField의 gap이 준다 — 여기서 margin을 더하면 이중이 된다 -->
        <p class="text-label-02-normal-regular text-red-500">비밀번호가 일치하지 않습니다</p>
      {/if}
    </FormField>

    {#if errorMessage}
      <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-label-02-normal-regular text-red-700">
        {errorMessage}
      </div>
    {/if}

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
      비밀번호 변경
    </Button>
  {/snippet}
</BaseModal>
