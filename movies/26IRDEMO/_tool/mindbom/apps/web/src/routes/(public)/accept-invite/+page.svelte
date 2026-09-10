<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { auth } from '$lib/stores/auth'
  import { institutionStore } from '$lib/stores/institution.store'
  import {
    verifyInvitation,
    acceptInvitation,
    type InvitationVerifyResponse,
  } from '$lib/services/api/invitations'
  import AuthShell from '$components/ui/AuthShell.svelte'
  import AuthField from '$components/ui/AuthField.svelte'
  import Button from '$components/ui/Button.svelte'
  import PasswordPolicyList, {
    passwordMeetsPolicy
  } from '$components/ui/PasswordPolicyList.svelte'

  let token = $derived(page.url.searchParams.get('token') ?? '')

  let verifyState = $state<'loading' | 'ok' | 'invalid'>('loading')
  let verifyError = $state('')
  let preview = $state<InvitationVerifyResponse | null>(null)

  let password = $state('')
  let passwordConfirm = $state('')
  let isSubmitting = $state(false)
  let submitError = $state('')

  // 정책 규칙은 PasswordPolicyList가 갖는다 (백엔드 password_policy.py와 동기).
  // 기존 계정이면 새 비밀번호를 만드는 게 아니라 기존 것을 확인하는 것이라 검사하지 않는다.
  let policyOk = $derived(passwordMeetsPolicy(password))
  let confirmMatches = $derived(passwordConfirm.length > 0 && password === passwordConfirm)

  let isFormValid = $derived(
    Boolean(token) &&
    Boolean(preview) &&
    Boolean(password) &&
    (preview?.account_exists ? password.length > 0 : (policyOk && confirmMatches))
  )

  const ROLE_LABEL: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원',
  }

  onMount(async () => {
    if (!token) {
      verifyState = 'invalid'
      verifyError = '유효하지 않은 링크입니다.'
      return
    }
    try {
      preview = await verifyInvitation(token)
      verifyState = 'ok'
    } catch (err: any) {
      verifyState = 'invalid'
      verifyError = err?.response?.data?.detail || '유효하지 않거나 만료된 초대 링크입니다.'
    }
  })

  async function handleSubmit() {
    if (!isFormValid || isSubmitting) return
    submitError = ''
    isSubmitting = true
    try {
      const result = await acceptInvitation(token, password)

      // 쿠키 저장 (institution_id는 수락한 기관 — 자동 로그인 컨텍스트)
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          institution_id: result.institution.id,
        }),
      })

      auth.login(result.user)
      institutionStore.hydrate({
        currentInstitutionId: result.institution.id,
        institutions: result.institutions.map((m) => ({
          id: m.institution_id,
          name: m.institution_name,
        })),
      })

      if (result.requires_institution_choice) {
        goto('/select-institution')
      } else {
        goto('/dashboard')
      }
    } catch (err: any) {
      submitError = err?.response?.data?.detail || '가입 처리에 실패했습니다.'
    } finally {
      isSubmitting = false
    }
  }
</script>

<AuthShell title="초대 수락" wide>
  {#if verifyState === 'loading'}
    <div class="flex h-32 items-center justify-center">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
      ></div>
    </div>
  {:else if verifyState === 'invalid'}
    <div
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-02-medium text-red-700"
    >
      {verifyError}
    </div>
    <Button variant="primary" size="xl" fullWidth href="/login" class="mt-6">
      로그인 페이지로
    </Button>
  {:else if preview}
    <div class="space-y-1 text-body-03-regular text-gray-500">
      <p>
        <strong class="text-gray-900">{preview.institution_name}</strong>의
        <strong class="text-gray-900">{ROLE_LABEL[preview.role] ?? preview.role}</strong>로
        초대받았습니다.
      </p>
      <p>이메일: <span class="text-gray-900">{preview.email}</span></p>
    </div>

    {#if preview.account_exists}
      <div
        class="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-body-03-regular text-blue-700"
      >
        이미 가입된 이메일입니다. 기존 비밀번호를 입력하시면 본 기관에 추가로 가입됩니다.
      </div>
    {/if}

    <form
      class="mt-6 flex flex-col gap-5"
      onsubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
    >
      <div>
        <AuthField
          id="password"
          label={preview.account_exists ? '기존 비밀번호' : '비밀번호'}
          type="password"
          autocomplete={preview.account_exists ? 'current-password' : 'new-password'}
          required
          bind:value={password}
          placeholder={preview.account_exists
            ? '기존 비밀번호를 입력해주세요'
            : '새 비밀번호를 입력해주세요'}
        />
        <!-- 기존 계정은 새 비밀번호를 만드는 게 아니라 확인하는 것이라 규칙을 띄우지 않는다 -->
        {#if !preview.account_exists}
          <PasswordPolicyList value={password} />
        {/if}
      </div>

      {#if !preview.account_exists}
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
      {/if}

      {#if submitError}
        <div
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-03-regular text-red-700"
        >
          {submitError}
        </div>
      {/if}

      <Button
        type="submit"
        variant="primary"
        size="xl"
        fullWidth
        loading={isSubmitting}
        disabled={!isFormValid}
      >
        {isSubmitting ? '가입 중...' : '가입 완료'}
      </Button>
    </form>
  {/if}

  {#snippet footer()}
    <a href="/terms" class="hover:text-gray-500">이용약관</a>
    <span aria-hidden="true">|</span>
    <a href="/privacy" class="hover:text-gray-500">개인정보처리방침</a>
  {/snippet}
</AuthShell>
