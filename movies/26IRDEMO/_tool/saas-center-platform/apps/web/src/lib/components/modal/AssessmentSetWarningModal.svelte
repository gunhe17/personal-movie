<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import WarningIcon from '$lib/assets/WarningIcon.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    affectedSets?: string[] // 영향받는 세트 이름 목록
    onConfirm?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    affectedSets = [],
    onConfirm
  }: Props = $props()

  function handleCancel() {
    closeModal()
  }

  function handleConfirm() {
    onConfirm?.()
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  size="sm"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="flex w-full flex-col items-center">
      <WarningIcon width={54} height={54} className="text-yellow-500" />
      <Typography
        variant="headline-02-normal-semibold"
        color="text-gray-900"
        className="mt-3 text-center"
      >
        검사 세트에 포함된 검사가 있어요!
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="flex flex-col">
      <!-- 경고 박스 -->
      <div class="rounded-lg bg-orange-50 px-4 py-3">
        <Typography variant="body-02-medium" color="text-orange-500">
          운영 안함으로 지정한 검사가 아래 세트 구성에서 빠져요
        </Typography>

        <!-- 세트 목록 -->
        <div class="mt-2 space-y-1">
          {#each affectedSets as setName}
            <Typography variant="body-02-regular" color="text-gray-700">
              {setName}
            </Typography>
          {/each}
        </div>
      </div>

      <!-- 안내 텍스트 -->
      <Typography
        variant="body-03-regular"
        color="text-gray-400"
        className="mt-3"
      >
        변경 내용은 신규 접수부터 적용돼요.
      </Typography>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full gap-3">
      <Button
        class="h-11 flex-1 rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50"
        onclick={handleCancel}
      >
        <Typography variant="body-01-normal-medium" color="text-gray-700"
          >취소</Typography
        >
      </Button>
      <Button
        class="h-11 flex-1 rounded-lg bg-primary-500 transition-colors hover:bg-primary-600"
        onclick={handleConfirm}
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >적용</Typography
        >
      </Button>
    </div>
  {/snippet}
</BaseModal>
