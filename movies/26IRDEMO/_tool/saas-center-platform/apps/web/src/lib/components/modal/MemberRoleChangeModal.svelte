<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface RoleOption {
    code: string
    name: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    memberName: string
    currentRoleName: string
    roles: RoleOption[]
    getRoleDisplayName: (role: RoleOption) => string
    onConfirm: (roleCode: string, roleName: string) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    memberName,
    currentRoleName,
    roles = [],
    getRoleDisplayName,
    onConfirm
  }: Props = $props()

  let selectedRoleCode = $state<string | null>(null)
  let isSubmitting = $state(false)

  const selectedRole = $derived(
    roles.find((r) => r.code === selectedRoleCode) ?? null
  )

  async function handleConfirm() {
    if (!selectedRole || isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm(selectedRole.code, selectedRole.name)
      closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  size="sm"
  bodyClass="px-5 pt-8 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center">
      <svg
        width="54"
        height="54"
        viewBox="0 0 54 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="27" cy="27" r="24" fill="#EFF6FF" />
        <path
          d="M20 27L24.5 31.5L34 22"
          stroke="#3B82F6"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mt-4 mb-1"
      >
        역할 변경
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="text-center"
      >
        {memberName}의 역할을 변경합니다.
      </Typography>
      <Typography
        variant="body-02-regular"
        color="text-gray-400"
        className="text-center mt-0.5"
      >
        현재 역할: {currentRoleName}
      </Typography>

      <div class="mt-5 w-full space-y-2">
        {#each roles as role (role.code)}
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors {selectedRoleCode ===
            role.code
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:bg-gray-50'}"
            onclick={() => (selectedRoleCode = role.code)}
          >
            <div
              class="flex h-5 w-5 items-center justify-center rounded-full border-2 {selectedRoleCode ===
              role.code
                ? 'border-border-active'
                : 'border-gray-300'}"
            >
              {#if selectedRoleCode === role.code}
                <div class="h-2.5 w-2.5 rounded-full bg-primary-500"></div>
              {/if}
            </div>
            <span
              class="text-body-01-normal-medium {selectedRoleCode === role.code
                ? 'text-primary-700'
                : 'text-gray-700'}"
            >
              {getRoleDisplayName(role)}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="grid w-full grid-cols-2 gap-3">
      <button
        type="button"
        onclick={closeModal}
        class="text-body-01-normal-medium h-11 w-full rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        취소
      </button>
      <button
        type="button"
        disabled={!selectedRole || isSubmitting}
        onclick={handleConfirm}
        class="text-body-01-normal-medium h-11 w-full rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {isSubmitting ? '변경 중...' : '변경'}
      </button>
    </div>
  {/snippet}
</BaseModal>
