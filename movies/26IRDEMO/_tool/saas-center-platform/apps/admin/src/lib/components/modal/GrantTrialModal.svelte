<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
    /** 체험 플랜 라벨 (API 기반, 기본값 'Pro') */
    trialPlanLabel?: string
    /** 체험 크레딧 한도 (API 기반, 기본값 2500) */
    trialCreditLimit?: number
    /** 기본 체험 기간 (API 기반, 기본값 365) */
    defaultDurationDays?: number
  }

  let {
    modalId = '',
    closeModal = () => {},
    _modalResolve = () => {},
    _modalReject = () => {},
    trialPlanLabel = 'Pro',
    trialCreditLimit = 2500,
    defaultDurationDays = 365,
  }: Props = $props()

  let durationDays = $state(defaultDurationDays)

  const handleConfirm = () => {
    _modalResolve(String(durationDays))
    closeModal()
  }

  const handleCancel = () => {
    _modalResolve(null)
    closeModal()
  }

  const presets = [
    { label: '7일', value: 7 },
    { label: '14일', value: 14 },
    { label: '30일', value: 30 },
    { label: '90일', value: 90 },
    { label: '365일', value: 365 },
  ]
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
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        무료 이용 부여
      </Typography>
      <Typography variant="body-01-reading-regular" color="text-gray-600" className="mb-5">
        {trialPlanLabel} 기능과 크레딧 {trialCreditLimit.toLocaleString()}을 부여합니다.
      </Typography>

      <div class="w-full text-left">
        <label for="trial-duration-input" class="block text-sm font-medium text-gray-700 mb-1.5">이용 기간</label>
        <div class="flex flex-wrap gap-2 mb-3">
          {#each presets as preset}
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm border transition-colors {durationDays === preset.value ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
              onclick={() => durationDays = preset.value}
            >
              {preset.label}
            </button>
          {/each}
        </div>
        <div class="flex items-center gap-2">
          <input
            id="trial-duration-input"
            type="number"
            bind:value={durationDays}
            min="1"
            max="3650"
            class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-500 shrink-0">일</span>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleCancel}
        class="flex items-center justify-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="flex items-center justify-center h-11 w-full rounded-lg transition-colors bg-primary-400 hover:bg-primary-300 text-white"
      >
        <Typography variant="title-01-semibold" color="text-white">
          부여
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
