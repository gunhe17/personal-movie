<script lang="ts">
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientSearchDropdown from '$lib/components/searchInput/ClientSearchDropdown.svelte'
  import type { ClientListItem } from '$lib/hooks/actions/client.action'

  let { client = $bindable(null), locked = false } = $props<{
    client?: ClientListItem | null
    /** 내담자 변경 불가 모드 (세션/패키지에서 사용) */
    locked?: boolean
  }>()

  let searchQuery = $state('')
</script>

<div>
  <span class="field-label mb-2">
    내담자 <span class="field-required">*</span>
  </span>
  {#if locked}
    <!-- 고를 수 없는 값은 입력 안에 두지 않는다 — 이미 정해진 대상이므로 읽기 표기.
         최소 단위 = 아바타 + 이름 + [생년월일 | 성별] (Web_Design.md §client) -->
    <div class="flex min-h-8 items-center gap-2">
      <ClientAvatar
        profileImageUrl={client?.profile_image_url}
        name={client?.name ?? ''}
        gender={client?.gender}
        sizeClass="size-8"
        textClass="text-body-03-normal-medium"
      />
      <Typography variant="body-01-normal-medium" color="text-body-strong">
        {client?.name ?? '-'}
      </Typography>
      <ClientBirthGender
        birthDate={client?.birth_date}
        gender={client?.gender}
        color="text-body-subtle"
      />
    </div>
  {:else}
    <ClientSearchDropdown
      bind:searchQuery
      selected={client}
      showDelete
      size="md"
      onClientSelect={(c) => (client = c)}
      onClientDelete={() => {
        client = null
        searchQuery = ''
      }}
    />
  {/if}
</div>
