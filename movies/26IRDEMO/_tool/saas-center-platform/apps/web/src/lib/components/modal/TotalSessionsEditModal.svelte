<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    modalId?: string
    initialValue: number
    /** 케이스에 이미 등록된 회기 수 — 이보다 작게 설정할 수 없다 */
    registeredCount: number
    onConfirm: (value: number) => Promise<void> | void
    closeModal?: () => void
  }

  let {
    modalId = '',
    initialValue,
    registeredCount,
    onConfirm,
    closeModal = () => {}
  }: Props = $props()

  // svelte-ignore state_referenced_locally — 모달 오픈 시점의 초기값 캡처가 의도
  let inputValue = $state(String(initialValue))
  let saving = $state(false)

  async function handleConfirm() {
    if (saving) return
    const value = Number(inputValue)
    if (!Number.isInteger(value) || value < 1 || value > 999) {
      snackbarStore.error('총회기는 1~999 사이 숫자로 입력해주세요')
      return
    }
    if (value < registeredCount) {
      snackbarStore.error(
        `등록된 회기 ${registeredCount}개보다 작게 설정할 수 없어요`
      )
      return
    }
    saving = true
    try {
      await onConfirm(value)
      closeModal()
    } catch {
      // 실패 스낵바는 onConfirm 쪽에서 처리 — 모달은 열어둔다
    } finally {
      saving = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  size="sm"
  showHeaderBorder={true}
  showFooterBorder={false}
  showCloseButton={true}
  title="총회기 수정"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col p-5 pb-7">
      <Typography
        variant="body-02-medium"
        color="text-gray-500"
        className="mb-3"
      >
        계약된 총회기 수를 입력해주세요.
      </Typography>
      <input
        type="number"
        min="1"
        max="999"
        bind:value={inputValue}
        onkeydown={(e) => e.key === 'Enter' && handleConfirm()}
        class="w-full rounded-lg border border-gray-200 px-2.5 py-3 text-sm text-gray-800 placeholder:text-placeholder outline-none focus:border-border-active"
        placeholder="총회기 수"
      />
      <Typography
        variant="body-03-regular"
        color="text-gray-500"
        className="mt-2"
      >
        현재 등록된 회기는 {registeredCount}개예요. 그보다 작게 설정할 수
        없어요.
      </Typography>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        type="button"
        onclick={handleConfirm}
        disabled={saving}
        class="flex-center h-11 rounded-lg bg-primary-500 px-5 hover:bg-primary-600 duration-200 disabled:opacity-50"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          저장
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
