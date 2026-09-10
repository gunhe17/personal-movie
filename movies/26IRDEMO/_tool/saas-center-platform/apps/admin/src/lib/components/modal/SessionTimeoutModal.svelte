<script lang="ts">
  import { onDestroy } from 'svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    initialSeconds?: number
    onExtend?: () => void
    onLogout?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    initialSeconds = 120,
    onExtend = () => {},
    onLogout = () => {}
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  const _initialSeconds = initialSeconds
  let remaining = $state(_initialSeconds)

  const display = $derived(() => {
    const min = Math.floor(remaining / 60)
    const sec = remaining % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  })

  const interval = setInterval(() => {
    remaining--
    if (remaining <= 0) {
      clearInterval(interval)
      onLogout()
    }
  }, 1000)

  onDestroy(() => clearInterval(interval))

  function handleExtend() {
    onExtend()
    closeModal()
  }

  function handleLogout() {
    onLogout()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="pt-8 pb-3 px-6"
  footerClass="px-6 py-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center text-center">
      <div
        class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100"
      >
        <svg
          class="h-6 w-6 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-2"
      >
        세션 만료 예정
      </Typography>
      <Typography variant="body-01-reading-regular" color="text-gray-600">
        보안을 위해 자동 로그아웃됩니다.
      </Typography>
      <div
        class="mt-3 font-mono text-2xl font-bold {remaining <= 30
          ? 'text-red-500'
          : 'text-amber-600'}"
      >
        {display()}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleLogout}
        class="flex items-center justify-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-gray-600">
          로그아웃
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleExtend}
        class="flex items-center justify-center h-11 w-full rounded-lg bg-primary-600 hover:bg-primary-700 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-white">
          세션 연장
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
