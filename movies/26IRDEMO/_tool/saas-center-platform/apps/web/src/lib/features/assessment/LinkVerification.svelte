<style>
  .verification {
    padding-top: 48px;
  }
  .verification.exiting {
    animation: depart 180ms ease-in both;
    pointer-events: none;
  }
  .eyebrow {
    color: var(--color-primary-500);
    margin-bottom: 16px;
  }
  .verification-stage {
    position: relative;
    height: 140px;
    display: flex;
    align-items: center;
    margin-top: 32px;
  }
  .digits {
    width: 100%;
    transition:
      opacity 200ms ease,
      transform 280ms ease;
  }
  .digits.leaving {
    pointer-events: none;
  }
  .digits.leaving :global(input) {
    animation: digit-out 240ms ease-in both;
  }
  .digits.leaving :global(input:nth-child(2)) {
    animation-delay: 35ms;
  }
  .digits.leaving :global(input:nth-child(3)) {
    animation-delay: 70ms;
  }
  .digits.leaving :global(input:nth-child(4)) {
    animation-delay: 105ms;
  }
  .success {
    position: absolute;
    inset: 0;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 12px;
    pointer-events: none;
  }
  .success-icon {
    animation: arrive 480ms cubic-bezier(0.2, 0.8, 0.2, 1) 160ms both;
  }
  .success p {
    color: var(--color-body-default);
    animation: caption-in 240ms ease-out 320ms both;
  }
  .feedback {
    min-height: 64px;
    color: var(--color-body-subtle);
  }
  .feedback [role='alert'] {
    color: var(--color-status-danger);
  }
  .help {
    margin-top: 32px;
    color: var(--color-body-subtle);
  }
  @keyframes arrive {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.4);
    }
    65% {
      opacity: 1;
      transform: translateY(-4px) scale(1.12);
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes digit-out {
    to {
      opacity: 0;
      transform: translateY(-20px) scale(0.85);
    }
  }
  @keyframes caption-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes depart {
    to {
      opacity: 0;
      transform: translateY(-12px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .success-icon,
    .success p,
    .verification.exiting,
    .digits.leaving :global(input) {
      animation: none;
    }
    .digits.leaving {
      visibility: hidden;
    }
    .digits {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import VerificationCodeInput from '$lib/components/common/VerificationCodeInput.svelte'
  import CircleCheckSolidIcon from '$lib/assets/CircleCheckSolidIcon.svelte'
  let {
    verify,
    onVerified
  }: { verify: (code: string) => Promise<void>; onVerified: () => void } =
    $props()
  let code = $state('')
  let stage = $state<'input' | 'loading' | 'success'>('input')
  let exiting = $state(false)
  let error = $state('')
  let lastAttempt = ''
  let disposed = false
  onMount(() => () => {
    disposed = true
  })

  async function submit(automatic = false) {
    if (
      stage !== 'input' ||
      code.length !== 4 ||
      (automatic && code === lastAttempt)
    )
      return
    lastAttempt = code
    stage = 'loading'
    error = ''
    try {
      await verify(code)
      if (disposed) return
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur()
      stage = 'success'
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise((resolve) => setTimeout(resolve, 720))
        if (disposed) return
        exiting = true
        await new Promise((resolve) => setTimeout(resolve, 180))
      }
      if (!disposed) onVerified()
    } catch (cause) {
      if (disposed) return
      stage = 'input'
      error =
        cause instanceof Error
          ? cause.message
          : '연결을 확인하고 다시 시도해주세요.'
    }
  }
</script>

<section class="verification" class:exiting aria-label="바로링크 인증">
  <p class="eyebrow text-body-02-normal-medium">안전하게 시작해요</p>
  <Typography
    tag="h1"
    variant="headline-01-reading-semibold"
    color="text-title-default"
    >문자로 받은 번호<br />네 자리를 입력해주세요</Typography
  >
  <Typography
    variant="body-02-reading-regular"
    color="text-body-subtle"
    className="mt-4"
    >보내드린 바로링크와 같은 문자에 있는<br />인증번호를 확인해주세요.</Typography
  >
  <div class="verification-stage" aria-busy={stage === 'loading'}>
    <div class:leaving={stage === 'success'} class="digits">
      <VerificationCodeInput
        disabled={stage !== 'input'}
        invalid={!!error}
        describedBy="verification-feedback"
        onChange={(value) => {
          code = value
          error = ''
        }}
        onComplete={() => submit(true)}
        onSubmit={() => submit()}
      />
    </div>
    {#if stage === 'success'}
      <div class="success" role="status" aria-label="인증 완료">
        <div class="success-icon" aria-hidden="true">
          <CircleCheckSolidIcon class="h-20 w-20 text-primary-500" />
        </div>
        <p>확인됐어요</p>
      </div>
    {/if}
  </div>
  <div
    id="verification-feedback"
    class="feedback text-body-03-reading-regular"
    aria-live="polite"
  >
    {#if error}<p role="alert">{error}</p>{:else if stage === 'loading'}<p>
        번호를 확인하고 있어요…
      </p>{:else if stage === 'input'}<p>
        네 자리를 입력하면 자동으로 확인해요.
      </p>{/if}
  </div>
  {#if stage !== 'success'}<Button
      size="xl"
      class="w-full"
      onclick={() => submit()}
      loading={stage === 'loading'}
      disabled={stage === 'loading' || code.length !== 4}
      >{stage === 'loading' ? '확인 중' : error ? '다시 확인' : '확인'}</Button
    >{/if}
  <p class="help text-body-03-reading-regular">
    번호가 맞지 않나요?<br />새 링크를 받았다면 가장 최근 문자를 확인해주세요.
  </p>
</section>
