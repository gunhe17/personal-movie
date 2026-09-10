<script lang="ts">
  import { forgotPassword } from '$lib/services/api/auth'
  import AuthShell from '$components/ui/AuthShell.svelte'
  import AuthField from '$components/ui/AuthField.svelte'
  import Button from '$components/ui/Button.svelte'

  let email = $state('')
  let isLoading = $state(false)
  let submitted = $state(false)
  let message = $state('')

  let isFormValid = $derived(Boolean(email?.trim()))

  async function handleSubmit() {
    if (!isFormValid || isLoading) return

    isLoading = true
    try {
      const result = await forgotPassword(email.trim())
      message = result.message
    } catch (err: any) {
      // enumeration 방지를 위해 백엔드는 항상 동일 메시지를 반환하지만,
      // 네트워크 오류 등으로 실패한 경우에도 동일하게 처리
      message = '입력하신 이메일이 등록되어 있다면 재설정 링크를 발송했습니다. 메일함을 확인해주세요.'
    } finally {
      isLoading = false
      submitted = true
    }
  }
</script>

<AuthShell
  title="비밀번호 찾기"
  description="가입하신 이메일을 입력하시면 재설정 링크를 보내드립니다."
>
  {#if submitted}
    <div
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-body-02-medium text-green-700"
    >
      {message}
    </div>
    <Button variant="primary" size="xl" fullWidth href="/login" class="mt-6">
      로그인 페이지로
    </Button>
  {:else}
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

      <Button
        type="submit"
        variant="primary"
        size="xl"
        fullWidth
        loading={isLoading}
        disabled={!isFormValid}
      >
        {isLoading ? '요청 중...' : '재설정 링크 받기'}
      </Button>
    </form>

    <p class="mt-6 text-center text-body-03-regular text-gray-500">
      <a href="/login" class="text-primary-500 hover:underline">로그인 페이지로 돌아가기</a>
    </p>
  {/if}
</AuthShell>
