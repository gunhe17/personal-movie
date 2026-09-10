<script lang="ts">
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { institutionStore } from '$lib/stores/institution.store'
  import { signup } from '$lib/services/api/auth'
  import AuthShell from '$components/ui/AuthShell.svelte'
  import AuthField from '$components/ui/AuthField.svelte'
  import Button from '$components/ui/Button.svelte'
  import PasswordPolicyList, {
    passwordMeetsPolicy
  } from '$components/ui/PasswordPolicyList.svelte'

  let email = $state('')
  let password = $state('')
  let passwordConfirm = $state('')
  let name = $state('')
  let institutionName = $state('')
  let isLoading = $state(false)
  let error = $state('')

  // 정책 규칙은 PasswordPolicyList가 갖는다 (백엔드 password_policy.py와 동기).
  let policyOk = $derived(passwordMeetsPolicy(password))
  let confirmMatches = $derived(
    passwordConfirm.length > 0 && password === passwordConfirm
  )

  let isFormValid = $derived(
    Boolean(email?.trim()) &&
      Boolean(name?.trim()) &&
      Boolean(institutionName?.trim()) &&
      policyOk &&
      confirmMatches
  )

  async function handleSubmit() {
    if (!isFormValid || isLoading) return

    error = ''
    isLoading = true
    try {
      const result = await signup({
        email: email.trim(),
        password,
        name: name.trim(),
        institution_name: institutionName.trim()
      })

      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          institution_id: result.institution.id
        })
      })

      auth.login(result.user)
      institutionStore.hydrate({
        currentInstitutionId: result.institution.id,
        institutions: result.institutions.map((m) => ({
          id: m.institution_id,
          name: m.institution_name,
          role: m.role
        }))
      })

      goto('/dashboard')
    } catch (err: any) {
      error =
        err?.response?.data?.detail || '회원가입에 실패했습니다. 다시 시도해주세요.'
    } finally {
      isLoading = false
    }
  }
</script>

<AuthShell title="회원가입" description="새 기관 관리자 계정을 생성합니다." wide>
  <form
    class="flex flex-col gap-5"
    onsubmit={(e) => {
      e.preventDefault()
      handleSubmit()
    }}
  >
    <AuthField
      id="email"
      label="이메일"
      type="email"
      autocomplete="email"
      required
      bind:value={email}
      placeholder="이메일을 입력해주세요"
    />

    <AuthField
      id="name"
      label="이름"
      autocomplete="name"
      required
      bind:value={name}
      placeholder="이름을 입력해주세요"
    />

    <AuthField
      id="institution"
      label="기관명"
      autocomplete="organization"
      required
      bind:value={institutionName}
      placeholder="소속 기관명을 입력해주세요"
    />

    <div>
      <AuthField
        id="password"
        label="비밀번호"
        type="password"
        autocomplete="new-password"
        required
        bind:value={password}
        placeholder="비밀번호를 입력해주세요"
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
      {isLoading ? '가입 중...' : '가입'}
    </Button>
  </form>

  <p class="mt-6 text-center text-body-03-regular text-gray-500">
    이미 계정이 있으신가요?
    <a href="/login" class="text-primary-500 hover:underline">로그인</a>
  </p>

  {#snippet footer()}
    <a href="/terms" class="hover:text-gray-500">이용약관</a>
    <span aria-hidden="true">|</span>
    <a href="/privacy" class="hover:text-gray-500">개인정보처리방침</a>
  {/snippet}
</AuthShell>
