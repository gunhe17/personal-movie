<script lang="ts">
  import EyeOffIcon24 from '../../assets/EyeOffIcon24.svelte'
  import LockGrayIcon24 from '../../assets/LockGrayIcon24.svelte'
  import SecretOnIcon32 from '../../assets/SecretOnIcon32.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    _modalResolve = () => {},
    _modalReject = () => {}
  }: Props = $props()

  let selected = $state<'masking' | 'lockscreen' | null>(null)

  // 선택 신호는 외곽선만 진다(Figma 7170:23092) — 아이콘·라벨·설명은 상태와 무관하게 같은 색이다.
  const cardBase =
    'flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-colors duration-200'
  // 흰 면(모달 본문) 위 카드이므로 비선택 외곽선은 border-default(gray-200) —
  // Web_Design.md §Colors '카드 외곽선 — 깔린 배경이 정한다'.
  const cardBorder = (on: boolean) =>
    on
      ? 'border-semantic-notice'
      : 'border-border-default hover:border-border-strong'

  const handleConfirm = () => {
    if (!selected) return
    _modalResolve(selected)
    closeModal()
  }

  const handleCancel = () => {
    _modalResolve(null)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="px-5 pt-8 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center text-center">
      <!-- 시크릿 모드 아이콘 -->
      <div
        class="mb-4 flex size-13 items-center justify-center rounded-full bg-trans-bg-orange"
      >
        <SecretOnIcon32 />
      </div>

      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
        className="mb-3"
      >
        시크릿 모드를 활성화 할게요
      </Typography>

      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className="mb-6"
      >
        상황에 맞게 원하는 모드를 사용해보세요
      </Typography>

      <!-- 선택지 카드 -->
      <div class="flex w-full items-stretch gap-2">
        <!-- 마스킹 -->
        <button
          type="button"
          onclick={() => (selected = 'masking')}
          class="{cardBase} {cardBorder(selected === 'masking')}"
        >
          <span class="text-icon-secondary">
            <EyeOffIcon24 />
          </span>
          <div class="flex flex-col items-center gap-2">
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              마스킹
            </Typography>
            <Typography variant="body-03-reading-regular" color="text-gray-600">
              이름, 연락처 등 민감한<br />정보가 ***로 표시돼요
            </Typography>
          </div>
        </button>

        <!-- 화면 잠금 -->
        <button
          type="button"
          onclick={() => (selected = 'lockscreen')}
          class="{cardBase} {cardBorder(selected === 'lockscreen')}"
        >
          <span class="text-icon-secondary">
            <LockGrayIcon24 />
          </span>
          <div class="flex flex-col items-center gap-2">
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              화면 잠금
            </Typography>
            <Typography variant="body-03-reading-regular" color="text-gray-600">
              화면 전체를 잠금 처리하여<br />접근을 차단해요
            </Typography>
          </div>
        </button>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="grid w-full grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleCancel}
        class="flex-center h-11 w-full rounded-lg border border-border-default duration-200 hover:border-border-strong"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          닫기
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!selected}
        class="flex-center h-11 w-full rounded-lg bg-semantic-notice duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          활성화
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
