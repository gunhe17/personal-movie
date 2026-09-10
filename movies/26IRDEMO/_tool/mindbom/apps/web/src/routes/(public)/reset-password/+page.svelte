<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { resetPassword } from '$lib/services/api/auth'
  import AuthShell from '$components/ui/AuthShell.svelte'
  import AuthField from '$components/ui/AuthField.svelte'
  import Button from '$components/ui/Button.svelte'
  import PasswordPolicyList, {
    passwordMeetsPolicy
  } from '$components/ui/PasswordPolicyList.svelte'

  let token = $derived(page.url.searchParams.get('token') ?? '')
  let password = $state('')
  let passwordConfirm = $state('')
  let isLoading = $state(false)
  let error = $state('')
  let done = $state(false)

  // 정책 규칙은 PasswordPolicyList가 갖는다 (백엔드 password_policy.py와 동기).
  let policyOk = $derived(passwordMeetsPolicy(password))
  let confirmMatches = $derived(
    passwordConfirm.length > 0 && password === passwordConfirm
  )
  let isFormValid = $derived(policyOk && confirmMatches && Boolean(token))

  async function handleSubmit() {
    if (!isFormValid || isLoading) return

    error = ''
    isLoading = true
    try {
      await resetPassword(token, password)
      done = true
      // 2초 후 로그인 페이지로 이동
      setTimeout(() => goto('/login'), 2000)
    } catch (err: any) {
      error = err?.response?.data?.detail || '비밀번호 재설정에 실패했습니다.'
    } finally {
      isLoading = false
    }
  }
</script>

<AuthShell
  title="새 비밀번호 설정"
  description={token && !done ? '새로 사용하실 비밀번호를 입력해주세요.' : undefined}
>
  {#if !token}
    <div
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-02-medium text-red-700"
    >
      유효하지 않은 링크입니다. 비밀번호 찾기를 다시 요청해주세요.
    </div>
    <Button variant="primary" size="xl" fullWidth href="/forgot-password" class="mt-6">
      비밀번호 찾기로
    </Button>
  {:else if done}
    <div
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-body-02-medium text-green-700"
    >
      비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.
    </div>
  {:else}
    <form
      class="flex flex-col gap-5"
      onsubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <div>
        <AuthField
          id="password"
          label="새 비밀번호"
          type="password"
          autocomplete="new-password"
          required
          bind:value={password}
          placeholder="새 비밀번호를 입력해주세요"
        />
        <PasswordPolicyList value={password} />
      </div>

      <AuthField
        id="password-confirm"
        label="비밀번호 확인"
        type="password"
        autocomplete="new-password"
        required
        bind:value={passwordConfirm}
        placeholder="비밀번호를 다시 입력해주세요"
        error={passwordConfirm.length > 0 && !confirmMatches
          ? '비밀번호가 일치하지 않습니다'
          : undefined}
      />

      {#if error}
        <div
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-03-regular text-red-700"
        >
          {error}
        </div>
      {/if}

      <Button
        type="submit"
        variant="primary"
        size="xl"
        fullWidth
        loading={isLoading}
        disabled={!isFormValid}
      >
        {isLoading ? '변경 중...' : '비밀번호 변경'}
      </Button>
    </form>
  {/if}
</AuthShell>
