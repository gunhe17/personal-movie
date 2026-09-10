<style>
  .accept-spinner {
    animation: accept-spin 0.9s linear infinite;
  }
  .accept-spinner-wrap {
    display: inline-flex;
    height: 3.5rem;
    width: 3.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--color-primary-50, #ecfdf5);
    animation: accept-pulse 2s ease-in-out infinite;
  }
  .accept-check-wrap {
    display: inline-flex;
    height: 3.5rem;
    width: 3.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--color-primary-100, #d1fae5);
    animation: accept-check-in 0.45s ease-out both;
  }
  .accept-check {
    animation: accept-check-pop 0.4s 0.12s ease-out both;
  }
  @keyframes accept-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes accept-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.92;
      transform: scale(1.02);
    }
  }
  @keyframes accept-check-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes accept-check-pop {
    from {
      opacity: 0;
      transform: scale(0.4);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { decodeInvitationToken } from '$lib/features/accept-invitation/token'
  import { acceptMemberInvitation } from '$lib/hooks/actions/member.action'
  import { centerStore } from '$lib/stores/center.store'
  import { permissionStore } from '$lib/stores/permission.store'
  import { getCenters } from '$lib/hooks/actions/center.action'

  const token = $derived(page.url.searchParams.get('token') ?? '')
  const payload = $derived(decodeInvitationToken(token))

  /** 로그인/회원가입 후 돌아올 URL (쿼리 token 유지) */
  const redirectToWithToken = $derived(
    token
      ? '/accept-invitation?token=' + encodeURIComponent(token)
      : '/accept-invitation'
  )

  let status = $state<
    'idle' | 'accepting' | 'success' | 'redirecting' | 'error'
  >('idle')
  let errorMessage = $state('')
  let successTimer: ReturnType<typeof setTimeout> | null = null
  let redirectTimer: ReturnType<typeof setTimeout> | null = null

  const centerLabel = $derived(payload?.centerName ?? '센터')
  const roleLabel = $derived(
    payload?.roleName ? `${payload.roleName}(으)로 초대됨` : '멤버로 초대됨'
  )
  const centerInitial = $derived(
    payload?.centerName ? (payload.centerName.trim()[0] ?? '초') : '초'
  )

  onMount(() => {
    if (!token) {
      status = 'error'
      errorMessage = '초대 링크가 올바르지 않습니다. 토큰이 없습니다.'
      return
    }
    if (!payload) {
      status = 'error'
      errorMessage = '유효하지 않은 초대 링크입니다.'
      return
    }

    const unsubscribe = auth.subscribe(async (state) => {
      if (!state.isAuthenticated || state.isLoading || status !== 'idle') return

      status = 'accepting'
      errorMessage = ''

      try {
        // 이미 해당 센터 소속인지 확인 (새로고침 시 중복 수락 방지)
        let res = await getCenters().request({ limit: 100 })
        let centers = res.centers ?? []
        const alreadyMember = centers.some((c) => c.id === payload!.centerId)

        if (!alreadyMember) {
          await acceptMemberInvitation().request({
            centerId: payload.centerId,
            invitationId: payload.invitationId
          })
          snackbarStore.success('초대를 수락했습니다.')
          // 수락 직후 센터 목록 다시 조회 (신규 가입 시 첫 getCenters()는 빈 배열)
          res = await getCenters().request({ limit: 100 })
          centers = res.centers ?? []
        }

        // URL 토큰의 centerId로 현재 센터 설정 후 스토리지/권한 반영
        if (centers.length > 0) centerStore.setCenters(centers)
        centerStore.setCurrentCenterId(payload.centerId)
        await permissionStore.load()

        status = 'success'
        successTimer = setTimeout(() => {
          status = 'redirecting'
          redirectTimer = setTimeout(() => goto('/dashboard'), 1200)
        }, 2000)
      } catch (err) {
        console.error('[accept-invitation] accept failed', err)
        status = 'error'
        errorMessage =
          err instanceof Error ? err.message : '초대 수락에 실패했습니다.'
      }
    })

    return () => {
      if (successTimer) clearTimeout(successTimer)
      if (redirectTimer) clearTimeout(redirectTimer)
      unsubscribe()
    }
  })
</script>

<div
  class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12"
>
  {#if !token}
    <div
      class="w-full max-w-md rounded-lg border border-red-100 bg-status-danger-bg/80 p-8 text-center shadow-sm"
    >
      <p class="text-body-02-normal-regular text-red-700">{errorMessage}</p>
      <a
        href="/login"
        class="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-body-02-normal-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
      >
        로그인 페이지로 이동
      </a>
    </div>
  {:else if !payload}
    <div
      class="w-full max-w-md rounded-lg border border-red-100 bg-status-danger-bg/80 p-8 text-center shadow-sm"
    >
      <p class="text-body-02-normal-regular text-red-700">{errorMessage}</p>
      <p class="mt-2 text-body-03-normal-regular text-red-600/80">
        링크가 만료되었거나 잘못된 주소일 수 있습니다.
      </p>
      <a
        href="/login"
        class="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-body-02-normal-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
      >
        로그인 페이지로 이동
      </a>
    </div>
  {:else if status === 'accepting' || status === 'success' || status === 'redirecting'}
    <div
      class="accept-invitation-card w-full max-w-md rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm"
      in:fly={{ y: 12, duration: 320, easing: (t) => t * (2 - t) }}
      out:fade={{ duration: 200 }}
    >
      {#key status}
        <div
          class="accept-invitation-state"
          in:fly={{
            y: 8,
            duration: 280,
            delay: 80,
            easing: (t) => t * (2 - t)
          }}
          out:fade={{ duration: 180 }}
        >
          {#if status === 'accepting'}
            <div class="accept-spinner-wrap">
              <svg
                class="accept-spinner h-7 w-7 text-primary-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p class="mt-5 text-body-01-normal-semibold text-gray-800">
              {centerLabel}에 멤버로 등록하고 있습니다
            </p>
            <p class="mt-1 text-body-03-normal-regular text-gray-500">
              잠시만 기다려 주세요.
            </p>
          {:else if status === 'success'}
            <div class="accept-check-wrap">
              <svg
                class="accept-check h-8 w-8 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p class="mt-5 text-headline-02-semibold text-gray-800">
              초대가 승낙되었습니다
            </p>
            <p class="mt-2 text-body-02-normal-regular text-gray-600">
              이제 {centerLabel}에 소속되어 이용하실 수 있습니다.
            </p>
          {:else}
            <div class="accept-spinner-wrap">
              <svg
                class="accept-spinner h-7 w-7 text-primary-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p class="mt-5 text-body-01-normal-semibold text-gray-800">
              홈으로 이동하는 중...
            </p>
          {/if}
        </div>
      {/key}
    </div>
  {:else if status === 'error'}
    <div
      class="w-full max-w-md rounded-lg border border-red-100 bg-status-danger-bg/80 p-8 text-center shadow-sm"
    >
      <p class="text-body-02-normal-regular text-red-700">{errorMessage}</p>
      <p class="mt-2 text-body-03-normal-regular text-red-600/80">
        다시 시도해 보시거나, 초대를 보내신 센터에 문의해 주세요.
      </p>
      <a
        href={redirectToWithToken}
        class="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-body-02-normal-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
      >
        초대 페이지로 돌아가기
      </a>
    </div>
  {:else if status === 'idle'}
    <div class="flex w-full max-w-md flex-col">
      <div
        class="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-8 py-10 shadow-sm"
      >
        <div
          class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-600 text-2xl font-bold text-white"
        >
          {centerInitial}
        </div>
        <h1 class="mt-5 text-center text-headline-01-normal-bold text-gray-800">
          {centerLabel}에서 초대가 도착했습니다
        </h1>
        <span
          class="mt-3 inline-flex rounded-full bg-primary-50 px-4 py-1.5 text-body-03-normal-medium text-primary-700"
        >
          {roleLabel}
        </span>

        <div class="mt-8 w-full border-t border-gray-200 pt-8">
          <p class="text-center text-body-02-normal-regular text-gray-500">
            계속하려면 로그인이 필요합니다
          </p>
        </div>

        <div class="mt-6 flex w-full flex-col gap-3">
          <a
            href={'/login?redirectTo=' +
              encodeURIComponent(redirectToWithToken)}
            class="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-4 transition hover:bg-gray-100 hover:border-gray-300"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-body-02-normal-semibold text-gray-800">로그인</p>
              <p class="text-body-03-reading-regular text-gray-500">
                이미 계정이 있어요
              </p>
            </div>
            <svg
              class="h-5 w-5 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>

          <a
            href={'/signup?redirectTo=' +
              encodeURIComponent(redirectToWithToken) +
              (payload?.inviteeEmail
                ? '&email=' + encodeURIComponent(payload.inviteeEmail)
                : '')}
            class="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-4 transition hover:bg-gray-100 hover:border-gray-300"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-body-02-normal-semibold text-gray-800">회원가입</p>
              <p class="text-body-03-reading-regular text-gray-500">
                처음 오셨나요?
              </p>
            </div>
            <svg
              class="h-5 w-5 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>
