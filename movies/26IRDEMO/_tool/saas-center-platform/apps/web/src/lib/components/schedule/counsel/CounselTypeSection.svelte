<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import { type ProgramListItem } from '$root/src/lib/hooks/actions/program.action'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import ProgramRegisterModal from '../../modal/ProgramRegisterModal.svelte'
  import { modalStore } from '$root/src/lib/stores/modal'

  interface Props {
    programList: ProgramListItem[]
    selectedProgram: ProgramListItem | null
    onProgramSelect: (program: ProgramListItem) => void
    isLoading?: boolean
    /** 자체 라벨(제목) 노출 여부. 외부에서 라벨을 그릴 땐 false */
    showTitle?: boolean
  }

  let {
    programList = [],
    selectedProgram,
    onProgramSelect,
    isLoading = false,
    showTitle = true
  }: Props = $props()

  const openProgramRegisterModal = () => {
    modalStore.open({
      component: ProgramRegisterModal,
      props: {
        onSuccessAfterCreate: (created: ProgramListItem) => {
          // 등록된 프로그램을 바로 선택 (리스트 refetch를 기다리지 않고 폼 상태에 반영)
          onProgramSelect({
            id: created.id,
            name: created.name,
            program_type: created.program_type,
            price: created.price,
            duration_minutes: created.duration_minutes,
            is_active: created.is_active,
            members: []
          })
        }
      },
      options: {
        customWidth: 540
      }
    })
  }
</script>

<section>
  {#if showTitle}
    <Typography variant="title-01-normal-semibold" className="mb-3">
      프로그램 <span class="field-required">*</span>
    </Typography>
  {/if}
  {#if isLoading}
    <div class="flex flex-wrap gap-2">
      {#each Array(3) as _}
        <div class="h-12 w-32 rounded-lg bg-gray-100 animate-pulse"></div>
      {/each}
    </div>
  {:else if programList.length}
    <div transition:fade class="flex flex-wrap gap-2">
      {#each programList as item}
        <button
          type="button"
          onclick={() => onProgramSelect(item)}
          class="rounded-lg border h-12 px-4 text-sm transition-colors {selectedProgram?.id ===
          item.id
            ? 'border-primary-400 bg-primary-50 text-primary-600'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
        >
          {item.name} - {item.program_type === 'INDIVIDUAL' ? '개별' : '그룹'}
        </button>
      {/each}
      <button
        type="button"
        onclick={openProgramRegisterModal}
        class="flex items-center gap-2 rounded-lg border border-dashed border-border-strong h-12 px-5 text-body-02-normal-regular text-action-primary transition-colors hover:bg-gray-50"
      >
        <PlusIcon20 />
        추가
      </button>
    </div>
  {:else}
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-2"
      >
        등록된 프로그램이 없어요. 먼저 프로그램을 추가해주세요.
      </Typography>
      <button
        type="button"
        onclick={openProgramRegisterModal}
        class="flex items-center gap-2 text-body-02-normal-medium text-action-primary hover:text-action-primary-hover"
      >
        <PlusIcon20 />
        프로그램 추가
      </button>
    </div>
  {/if}
</section>
