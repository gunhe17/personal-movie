<!--
  MyCredentialsSection
  /myInfo 페이지의 "학력 · 경력 · 자격" 섹션.

  - 종합 인증 등급 배지
  - kind별 섹션 3개 (학력/경력/자격)
  - 항목 추가/수정/삭제/검증요청 액션
  - 모달은 라우트 폴더의 components/에서 주입
-->
<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'

  import { queryBuilder } from '$lib/hooks/queries/builder'

  import CertifiedExpertBadge from '$lib/features/credentials/components/CertifiedExpertBadge.svelte'
  import CredentialKindSection from '$lib/features/credentials/components/CredentialKindSection.svelte'
  import {
    buildMyCredentialsInput,
    createCredentialsService,
    groupCredentialsByKind,
    type CredentialItemVM
  } from '$lib/features/credentials'
  import type {
    Credential as CredentialItem,
    CredentialType,
    CredentialListResponse
  } from '$lib/hooks/actions/credential.action'

  import EducationCredentialModal from './EducationCredentialModal.svelte'
  import CareerCredentialModal from './CareerCredentialModal.svelte'
  import CertificationCredentialModal from './CertificationCredentialModal.svelte'

  interface Props {
    /** 이미 패딩된 패널 안에서 쓸 때 자체 패딩 제거 */
    bare?: boolean
  }
  let { bare = false }: Props = $props()

  const queryClient = useQueryClient()

  const credentialsQuery = $derived(
    queryBuilder(
      buildMyCredentialsInput().action,
      () => buildMyCredentialsInput().params
    )
  )

  const data = $derived(
    credentialsQuery.data as CredentialListResponse | undefined
  )
  const credentials = $derived<CredentialItem[]>(data?.items ?? [])
  const stats = $derived(data?.stats)
  const isCertified = $derived(stats?.is_certified ?? false)

  const groups = $derived(groupCredentialsByKind(credentials))

  const service = createCredentialsService({
    queryClient,
    modals: {
      education: EducationCredentialModal,
      career: CareerCredentialModal,
      certification: CertificationCredentialModal
    }
  })

  function handleAdd(credential_type: CredentialType) {
    service.openCreate(credential_type)
  }

  function handleEdit(item: CredentialItemVM) {
    service.openEdit(item.raw)
  }

  function handleDelete(item: CredentialItemVM) {
    service.openDelete(item.raw)
  }

  function handleRequestVerification(item: CredentialItemVM) {
    void service.executeRequestVerification(item.raw)
  }

  function handleAttachmentClick(item: CredentialItemVM) {
    if (!item.attachment) return
    void service.downloadAttachment(item.id, item.attachment.filename)
  }
</script>

<section class={bare ? '' : 'p-6'}>
  {#if isCertified}
    <header class="mb-4 flex items-center justify-between">
      <CertifiedExpertBadge size="md" />
    </header>
  {/if}

  {#if credentialsQuery.isLoading}
    <div class="flex items-center justify-center py-10 text-sm text-gray-400">
      불러오는 중...
    </div>
  {:else}
    <div class="flex flex-col gap-8">
      {#each groups as group (group.credential_type)}
        <CredentialKindSection
          {group}
          compactTitle
          onAdd={() => handleAdd(group.credential_type)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRequestVerification={handleRequestVerification}
          onAttachmentClick={handleAttachmentClick}
        />
      {/each}
    </div>
  {/if}
</section>
