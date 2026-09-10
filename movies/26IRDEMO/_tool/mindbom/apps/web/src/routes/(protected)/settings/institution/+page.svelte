<script lang="ts">
  import { fade } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { institutionId } from '$lib/stores/institution.store'
  import { get } from '$lib/services/api/instances'
  import Card from '$components/ui/Card.svelte'
  import PageTitleSection from '$components/ui/PageTitleSection.svelte'
  import SectionTitle from '$components/ui/SectionTitle.svelte'
  import DescriptionList, {
    type DescriptionItem
  } from '$components/ui/DescriptionList.svelte'

  interface InstitutionInfo {
    id: string
    name: string
    institution_type: string | null
    created_at: string
  }

  const INSTITUTION_TYPE_LABELS: Record<string, string> = {
    counseling_center: '상담센터',
    hospital: '병원',
    clinic: '클리닉',
    school: '학교',
    research: '연구기관',
  }

  let institution = $state<InstitutionInfo | null>(null)
  let isAuthorized = $state(false)

  onMount(() => {
    // admin 외에는 본인 설정으로 리다이렉트
    if ($auth.user && $auth.user.role !== 'admin') {
      goto('/settings/me')
      return
    }
    isAuthorized = true
  })

  $effect(() => {
    const instId = $institutionId
    if (!instId || !isAuthorized) return
    get<InstitutionInfo>(`/institutions/${instId}`).then((data) => {
      institution = data
    }).catch(() => {})
  })

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  let infoItems = $derived<DescriptionItem[]>([
    { label: '기관명', value: institution?.name },
    {
      label: '기관 유형',
      value: institution?.institution_type
        ? (INSTITUTION_TYPE_LABELS[institution.institution_type] ??
          institution.institution_type)
        : null
    },
    { label: '기관 ID', value: institution?.id },
    { label: '등록일', value: formatDate(institution?.created_at) }
  ])
</script>

{#if isAuthorized}
  <!-- 설정은 정보 카드만 있어 한 화면 고정을 쓰지 않는다 — 페이지가 스크롤한다. -->
  <div in:fade class="max-w-200 p-4 md:p-6 lg:p-8">
    <PageTitleSection title="기관 설정" description="기관 정보를 관리합니다" />

    <Card>
      <SectionTitle title="기관 정보" />
      <DescriptionList items={infoItems} />
    </Card>
  </div>
{/if}
