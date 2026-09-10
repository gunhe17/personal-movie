<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BaseModal from './BaseModal.svelte'
  import AddSessionIcon40 from '../../assets/AddSessionIcon40.svelte'
  import TrashPrimaryIcon40 from './TrashPrimaryIcon40.svelte'

  type CancelChoice = 'supplement' | 'cancel_only'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onSelect?: (choice: CancelChoice) => void
  }

  let { modalId = '', closeModal = () => {}, onSelect }: Props = $props()

  function handleSelect(choice: CancelChoice) {
    onSelect?.(choice)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  showCloseButton={true}
  size="fit"
  bodyClass="p-5 pb-10"
  title="회기를 취소할게요"
>
  {#snippet body()}
    <div class="space-y-3">
      <!-- 보충 회기 추가 -->
      <button
        type="button"
        onclick={() => handleSelect('supplement')}
        class="w-full rounded-lg border-2 border-gray-200 px-4 h-[117px] py-6 bg-white text-left transition-colors hover:bg-primary-50 hover:border-primary-200"
      >
        <div class="flex items-start gap-4">
          <div class="shrink-0">
            <!-- 캘린더 + 플러스 아이콘 -->
            <AddSessionIcon40 />
          </div>
          <div>
            <Typography variant="body-01-normal-semibold" color="text-gray-800">
              보충 회기를 추가할게요
            </Typography>
            <Typography
              variant="body-02-reading-regular"
              color="text-gray-500"
              className="mt-[7px] whitespace-pre-line"
            >
              선택한 회기를 취소하고 마지막 회기 다음 주기에 1회기를 추가할게요
            </Typography>
          </div>
        </div>
      </button>

      <!-- 그냥 취소 -->
      <button
        type="button"
        onclick={() => handleSelect('cancel_only')}
        class="w-full rounded-lg border-2 border-gray-200 h-[117px] bg-white px-4 py-6 text-left transition-colors hover:bg-primary-50 hover:border-primary-200"
      >
        <div class="flex items-start gap-4">
          <div class="shrink-0">
            <!-- 캘린더 + X 아이콘 -->
            <div class="relative">
              <TrashPrimaryIcon40 />
            </div>
          </div>
          <div>
            <Typography variant="body-01-normal-bold" color="text-gray-800">
              그냥 취소할게요
            </Typography>
            <Typography
              variant="body-02-reading-regular"
              color="text-gray-500"
              className="mt-[7px] whitespace-pre-line"
            >
              별도 회기 추가 없이 취소만 할게요
            </Typography>
          </div>
        </div>
      </button>
    </div>
  {/snippet}
</BaseModal>
