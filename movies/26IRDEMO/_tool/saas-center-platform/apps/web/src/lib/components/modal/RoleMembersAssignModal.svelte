<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import CloseGrayCircle16Icon from '$lib/assets/CloseGrayCircle16Icon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface AssignableMember {
    id: string
    name: string
    email: string
    roleCode: string
    roleName: string
    isActive: boolean
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    roleName?: string
    members?: AssignableMember[]
    currentMemberId?: string | null
    onConfirm?: (
      selectedMembers: AssignableMember[],
      controls: { closeModal: () => void }
    ) => Promise<boolean | void> | boolean | void
  }

  let {
    modalId = '',
    closeModal = () => {},
    roleName = '',
    members = [],
    currentMemberId = null,
    onConfirm = () => {}
  }: Props = $props()

  let query = $state('')
  let stagedSelectedIds = $state<string[]>([])
  let selectedIds = $state<string[]>([])
  let isSubmitting = $state(false)

  const isSearchMode = $derived(query.trim().length > 0)

  const filteredMembers = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) =>
      `${m.name} ${m.email}`.toLowerCase().includes(q)
    )
  })

  const stagedMembers = $derived.by(() =>
    members.filter((m) => stagedSelectedIds.includes(m.id))
  )

  const selectedMembers = $derived.by(() =>
    members.filter((m) => selectedIds.includes(m.id))
  )

  function toggleStagedMember(id: string, checked: boolean) {
    if (id === currentMemberId) return
    if (checked) {
      if (!stagedSelectedIds.includes(id)) {
        stagedSelectedIds = [...stagedSelectedIds, id]
      }
      return
    }
    stagedSelectedIds = stagedSelectedIds.filter((v) => v !== id)
  }

  function confirmStagedSelection() {
    selectedIds = [...stagedSelectedIds]
    query = ''
  }

  function removeSelected(id: string) {
    selectedIds = selectedIds.filter((v) => v !== id)
    stagedSelectedIds = stagedSelectedIds.filter((v) => v !== id)
  }

  async function handleConfirm() {
    if (selectedMembers.length === 0 || isSubmitting) return
    isSubmitting = true
    try {
      const shouldClose = await onConfirm?.(selectedMembers, { closeModal })
      if (shouldClose !== false) closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showCloseButton={false}
  showHeaderBorder={true}
  showFooterBorder={false}
  size="lg"
  bodyClass="p-0"
  headerClass="px-5 py-4"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet header()}
    <div class="w-full flex items-start justify-between">
      <div>
        <Typography
          variant="headline-02-normal-semibold"
          color="text-body-strong">구성원을 추가할게요</Typography
        >
        <Typography
          variant="body-02-regular"
          color="text-gray-500"
          className="mt-1"
        >
          역할에 배정할 구성원을 선택해주세요
        </Typography>
      </div>
      <Tooltip text="닫기">
        <button
          onclick={closeModal}
          class="text-gray-400 hover:text-gray-600"
          aria-label="close"
        >
          <CloseGrayCircle16Icon />
        </button>
      </Tooltip>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7">
      <label
        for="assign-member-query"
        class="text-body-03-normal-medium text-gray-600">이름</label
      >
      <div
        class="mt-2 h-11 rounded-lg border border-gray-200 px-3 flex items-center gap-2"
      >
        <input
          id="assign-member-query"
          type="text"
          bind:value={query}
          placeholder="이름 검색해주세요"
          class="w-full outline-none bg-transparent text-body-02-normal-regular placeholder:text-placeholder"
        />
        <SearchIcon />
      </div>

      {#if isSearchMode}
        <div class="mt-3 rounded-lg border border-gray-200 overflow-hidden">
          <div class="max-h-48 overflow-y-auto">
            {#if filteredMembers.length === 0}
              <div
                class="px-4 py-6 text-body-02-normal-regular text-gray-400 text-center"
              >
                검색 결과가 없습니다
              </div>
            {:else}
              {#each filteredMembers as member}
                <div
                  class="grid grid-cols-[1fr_24px] min-h-13 px-3 items-center border-b border-gray-100 last:border-b-0"
                  class:bg-gray-50={stagedSelectedIds.includes(member.id)}
                  class:bg-white={!stagedSelectedIds.includes(member.id)}
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <p
                      class="text-body-02-normal-medium truncate-safe"
                      class:text-blue-500={stagedSelectedIds.includes(
                        member.id
                      )}
                      class:text-gray-800={!stagedSelectedIds.includes(
                        member.id
                      )}
                    >
                      {member.name}
                      {#if member.id === currentMemberId}
                        <span
                          class="text-body-03-normal-medium text-gray-400 ml-1"
                          >(나)</span
                        >
                      {/if}
                    </p>
                    <p
                      class="text-body-02-normal-regular text-gray-500 truncate-safe"
                    >
                      {member.email}
                    </p>
                  </div>
                  <Checkbox
                    id={`assign-${member.id}`}
                    checked={stagedSelectedIds.includes(member.id)}
                    onchange={(checked) =>
                      toggleStagedMember(member.id, checked)}
                    disabled={member.id === currentMemberId}
                    boxClass="h-4 w-4"
                    containerClass="h-4 w-4"
                  />
                </div>
              {/each}
            {/if}
          </div>

          <div
            class="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-100"
          >
            <div class="flex flex-wrap gap-1.5">
              {#each stagedMembers as member}
                <button
                  type="button"
                  onclick={() => toggleStagedMember(member.id, false)}
                  class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-body-03-normal-medium text-blue-500"
                >
                  {member.name}
                  <span
                    class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-blue-300 text-caption-01-normal-medium leading-none text-blue-400"
                    >x</span
                  >
                </button>
              {/each}
            </div>
            <button
              type="button"
              onclick={confirmStagedSelection}
              disabled={stagedMembers.length === 0}
              class="h-8 min-w-11 rounded-lg bg-gray-100 px-3 text-body-03-normal-medium text-gray-600 disabled:bg-gray-100 disabled:text-gray-300"
            >
              확인
            </button>
          </div>
        </div>
      {:else if selectedMembers.length > 0}
        <div class="mt-4 rounded-lg border border-gray-200 overflow-hidden">
          <div
            class="grid grid-cols-[1fr_1.4fr_1fr_32px] h-9 bg-gray-50 px-3 items-center"
          >
            <span class="text-body-03-normal-medium text-gray-500">이름</span>
            <span class="text-body-03-normal-medium text-gray-500">이메일</span>
            <span class="text-body-03-normal-medium text-gray-500"
              >현재 역할</span
            >
            <span></span>
          </div>
          <div class="max-h-48 overflow-y-auto">
            {#each selectedMembers as member}
              <div
                class="grid grid-cols-[1fr_1.4fr_1fr_32px] min-h-11 px-3 items-center border-t border-gray-100"
              >
                <span
                  class="text-body-02-normal-regular text-gray-800 truncate-safe"
                  >{member.name}</span
                >
                <span
                  class="text-body-02-normal-regular text-gray-600 truncate-safe"
                  >{member.email}</span
                >
                <span
                  class="text-body-02-normal-regular text-gray-600 truncate-safe"
                  >{member.roleName}</span
                >
                <Tooltip text="제거">
                  <button
                    type="button"
                    onclick={() => removeSelected(member.id)}
                    class="text-gray-300 hover:text-gray-500"
                    aria-label="remove"
                  >
                    <CloseGrayCircle16Icon />
                  </button>
                </Tooltip>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="mt-4 h-31 bg-white"></div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    {#if !isSearchMode}
      <button
        type="button"
        disabled={selectedMembers.length === 0 || isSubmitting}
        onclick={handleConfirm}
        class="h-11 min-w-24 rounded-lg bg-primary-500 px-4 text-body-01-normal-medium text-white disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        {isSubmitting ? '처리 중...' : '추가'}
      </button>
    {/if}
  {/snippet}
</BaseModal>
