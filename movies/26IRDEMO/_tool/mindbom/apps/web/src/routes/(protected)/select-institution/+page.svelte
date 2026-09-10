<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { institutionStore } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import AuthShell from '$components/ui/AuthShell.svelte'
  import Icon from '$components/ui/Icon.svelte'

  type Role = 'admin' | 'clinician' | 'researcher'
  type Membership = { id: string; name: string; role?: Role }

  let memberships = $state<Membership[]>([])
  let switching = $state<string | null>(null)

  const ROLE_LABEL: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원',
  }

  onMount(async () => {
    const unsub = institutionStore.subscribe((s) => {
      memberships = s.institutions.map((i: any) => ({
        id: i.id,
        name: i.name,
        role: i.role,
      }))
    })
    unsub()

    // 새로고침으로 store가 비어있는 경우 /auth/me로 복구
    if (memberships.length === 0) {
      try {
        const { get } = await import('$lib/services/api/instances')
        const me = await get<{
          institutions: Array<{
            institution_id: string
            institution_name: string
            role: 'admin' | 'clinician' | 'researcher'
          }>
        }>('/auth/me')
        memberships = me.institutions.map((m) => ({
          id: m.institution_id,
          name: m.institution_name,
          role: m.role,
        }))
        institutionStore.setInstitutions(
          memberships.map((m) => ({ id: m.id, name: m.name, role: m.role }))
        )
      } catch {
        await auth.logout()
        goto('/login', { replaceState: true })
        return
      }
    }

    if (memberships.length <= 1) {
      goto('/dashboard', { replaceState: true })
    }
  })

  async function selectInstitution(id: string) {
    if (switching) return
    switching = id
    try {
      await institutionStore.selectInstitution(id)
      goto('/dashboard')
    } catch (err: any) {
      snackbarStore.error(err?.message || '기관 전환에 실패했습니다.')
      switching = null
    }
  }

  async function handleLogout() {
    await auth.logout()
    goto('/login')
  }
</script>

<AuthShell title="기관 선택" description="접속할 기관을 선택해주세요.">
  <div class="flex flex-col gap-2">
    {#each memberships as m (m.id)}
      <button
        type="button"
        onclick={() => selectInstitution(m.id)}
        disabled={switching !== null}
        class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div class="min-w-0">
          <p class="truncate text-body-02-normal-semibold text-gray-900">{m.name}</p>
          {#if m.role}
            <p class="mt-0.5 text-body-03-normal-regular text-gray-500">
              {ROLE_LABEL[m.role] ?? m.role}
            </p>
          {/if}
        </div>
        {#if switching === m.id}
          <div
            class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
          ></div>
        {:else}
          <Icon name="chevron_right" size="sm" class="text-gray-400" />
        {/if}
      </button>
    {/each}
  </div>

  <button
    type="button"
    onclick={handleLogout}
    class="mt-6 w-full text-center text-body-03-regular text-gray-500 transition-colors hover:text-gray-700"
  >
    다른 계정으로 로그인
  </button>
</AuthShell>
