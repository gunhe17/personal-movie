<script lang="ts">
  import WarningIcon54 from '../../assets/WarningIcon54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    title?: string
    description?: string
    missingItems?: string[]
    incompleteItems?: string[]
    cancelText?: string
    confirmText?: string
    closeModal?: () => void
    onConfirm?: () => void
  }

  let {
    modalId = '',
    title = '완료 처리할까요?',
    description = '보고서가 작성되지 않은 검사가 있어요.',
    missingItems = [],
    incompleteItems = [],
    cancelText = '닫기',
    confirmText = '확인',
    closeModal = () => {},
    onConfirm = () => {}
  }: Props = $props()

  const handleSubmit = () => {
    onConfirm()
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
    <div class="flex flex-col items-center">
      <div class="mb-4">
        <WarningIcon54 />
      </div>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        {title}
      </Typography>
      <div class="mb-1 text-center">
        {#each description.split('\n') as line}
          <Typography
            variant="body-02-reading-regular"
            color="text-gray-500"
            tag="p"
          >
            {line}
          </Typography>
        {/each}
      </div>

      {#if incompleteItems.length > 0 || missingItems.length > 0}
        <div class="mt-4 w-full flex flex-col gap-3">
          {#if incompleteItems.length > 0}
            <div class="w-full rounded-lg bg-status-danger-bg px-4 py-3">
              <Typography
                variant="body-02-reading-regular"
                color="text-etc-red-pink"
                className="mb-2"
              >
                미완료 검사
              </Typography>
              <ul class="flex flex-col gap-1">
                {#each incompleteItems as item}
                  <li class="flex items-center gap-2">
                    <span class="h-1 w-1 shrink-0 rounded-full bg-red-400"
                    ></span>
                    <Typography
                      variant="body-02-reading-regular"
                      color="text-gray-700"
                    >
                      {item}
                    </Typography>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if missingItems.length > 0}
            <div class="w-full rounded-lg bg-gray-50 px-4 py-3">
              <Typography
                variant="body-02-reading-regular"
                color="text-gray-500"
                className="mb-2"
              >
                보고서 미작성 검사
              </Typography>
              <ul class="flex flex-col gap-1">
                {#each missingItems as item}
                  <li class="flex items-center gap-2">
                    <span class="h-1 w-1 shrink-0 rounded-full bg-gray-400"
                    ></span>
                    <Typography
                      variant="body-02-reading-regular"
                      color="text-gray-700"
                    >
                      {item}
                    </Typography>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        onclick={() => closeModal()}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          {cancelText}
        </Typography>
      </button>
      <button
        onclick={handleSubmit}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:bg-gray-50 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-etc-red-pink">
          {confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
