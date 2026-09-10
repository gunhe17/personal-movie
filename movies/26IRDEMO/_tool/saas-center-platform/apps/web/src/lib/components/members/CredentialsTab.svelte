<!--
  CredentialsTab
  멤버 상세의 '학력 · 경력 · 자격' 탭.

  - 본인 시점: 읽기 전용 + "myInfo에서 관리" 안내 링크 + legacy 영역
  - 다른 멤버 시점: verified 항목만 + legacy 숨김
  - 추가/수정/삭제 액션은 이 탭에서 제공하지 않음 (단일 소스: myInfo)
-->
<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { fade } from 'svelte/transition'

  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { getMemberCredentials } from '$lib/hooks/actions/member.action'
  import type { MemberCredentialsResponse } from '$lib/hooks/actions/member.action'

  import CertifiedExpertBadge from '$lib/features/credentials/components/CertifiedExpertBadge.svelte'
  import CredentialKindSection from '$lib/features/credentials/components/CredentialKindSection.svelte'
  import OverallGradeBadge from '$lib/features/credentials/components/OverallGradeBadge.svelte'
  import {
    groupCredentialsByKind,
    summarizeCredentials
  } from '$lib/features/credentials'
  interface Props {
    memberId: string
  }

  let { memberId }: Props = $props()

  const credentialsQuery = $derived(
    queryBuilder(getMemberCredentials, () => ({
      centerId: $centerId!,
      memberId
    }))
  )

  const data = $derived(
    credentialsQuery.data as MemberCredentialsResponse | undefined
  )
  const credentials = $derived(data?.structured ?? [])
  const legacy = $derived(data?.legacy)
  const isSelf = $derived(data?.is_self ?? false)
  const groups = $derived(groupCredentialsByKind(credentials))
  const summary = $derived(summarizeCredentials(credentials))

  // 종합 인증 등급: 자격 verified ≥1 AND 학력 verified ≥1
  // (백엔드 stats를 따로 안 받는 경로라 클라이언트에서 동일 정책으로 판정)
  const isCertified = $derived.by(() => {
    const verifiedCerts = credentials.filter(
      (c) =>
        c.credential_type === 'certification' &&
        c.verification.status === 'verified'
    )
    const verifiedEdus = credentials.filter(
      (c) =>
        c.credential_type === 'education' &&
        c.verification.status === 'verified'
    )
    return verifiedCerts.length > 0 && verifiedEdus.length > 0
  })

  // 헤더에 실제로 그릴 게 있는지 (배지 / 본인 링크)
  const hasHeaderContent = $derived(isSelf || credentials.length > 0)

  const hasLegacy = $derived(
    !!legacy &&
      ((legacy.educations?.length ?? 0) > 0 ||
        (legacy.careers?.length ?? 0) > 0 ||
        (legacy.certifications?.length ?? 0) > 0)
  )

  // 멤버 상세(읽기 전용)용 빈 섹션 문구 — myInfo의 "추가해주세요"와 구분
  const EMPTY_LABEL: Record<'education' | 'career' | 'certification', string> =
    {
      education: '인증된 학력이 없어요',
      career: '인증된 경력이 없어요',
      certification: '인증된 자격증이 없어요'
    }
</script>

{#snippet statusDot(dotClass: string, label: string, count: number)}
  <span class="flex items-center gap-1.5">
    <span class="w-1.5 h-1.5 rounded-full {dotClass}"></span>
    <Typography variant="body-02-normal-regular" color="text-gray-600">
      {label}
      {count}
    </Typography>
  </span>
{/snippet}

{#if credentialsQuery.isLoading}
  <div class="flex items-center justify-center py-10">
    <Typography variant="body-02-normal-regular" color="text-gray-400">
      불러오는 중...
    </Typography>
  </div>
{:else}
  <div in:fade class="flex flex-col">
    <!-- 헤더: 인증 배지 + 본인일 때 myInfo 링크 (상위 타이틀 없음).
         행 높이 24는 세 탭 공통(탭 전환 시 첫 줄 위치 고정) · 아래 gap 4.
         단, 표시할 내용이 없으면 렌더하지 않는다 — 빈 행을 남기면 첫 섹션이
         다른 탭보다 아래에서 시작해 상단 여백만 과하게 보인다. -->
    {#if hasHeaderContent}
      <header class="mb-1 flex h-6 shrink-0 items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          {#if isCertified}
            <CertifiedExpertBadge size="md" />
          {:else if credentials.length > 0}
            <OverallGradeBadge {credentials} />
          {/if}
        </div>
        {#if isSelf}
          <a
            href="/myInfo"
            class="inline-flex h-6 items-center gap-1 text-body-03-normal-medium text-primary-500 hover:text-primary-600 hover:underline"
          >
            내 정보에서 관리
            <span aria-hidden="true">→</span>
          </a>
        {/if}
      </header>
    {/if}

    <!-- 헤더 아래 컨텐츠: 영역 간 간격 24(gap-6) -->
    <div class="flex flex-col gap-6">
      <!-- 인증 현황 -->
      {#if summary.verified > 0 || summary.pending > 0 || summary.rejected > 0}
        <div
          class="flex items-center justify-end flex-wrap gap-x-3 gap-y-1 px-1"
        >
          {#if summary.verified > 0}
            {@render statusDot('bg-primary-500', '인증', summary.verified)}
          {/if}
          {#if summary.pending > 0}
            {@render statusDot('bg-amber-400', '대기', summary.pending)}
          {/if}
          {#if summary.rejected > 0}
            {@render statusDot('bg-red-400', '반려', summary.rejected)}
          {/if}
        </div>
      {/if}

      <!-- kind별 섹션 (읽기 전용, 비어 있어도 섹션은 표시) — 섹션 간 24 -->
      {#each groups as group (group.credential_type)}
        <CredentialKindSection
          {group}
          readOnly
          emptyLabel={EMPTY_LABEL[group.credential_type]}
        />
      {/each}

      <!-- legacy 영역 (본인일 때만, 데이터 있을 때만) -->
      {#if isSelf && hasLegacy && legacy}
        <section class="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
          <header class="flex items-center justify-between gap-2 flex-wrap">
            <Typography variant="body-01-semibold" color="text-gray-700">
              이전에 입력하신 정보
            </Typography>
            <Typography variant="body-03-medium" color="text-gray-500">
              새 형식으로 다시 등록하실 수 있어요
            </Typography>
          </header>

          {#if legacy.educations.length > 0}
            <div>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-1.5 block"
              >
                학력
              </Typography>
              <ul class="space-y-1">
                {#each legacy.educations as edu (edu)}
                  <li
                    class="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400"
                  >
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-600"
                    >
                      {edu}
                    </Typography>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if legacy.careers.length > 0}
            <div>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-1.5 block"
              >
                경력
              </Typography>
              <ul class="space-y-1">
                {#each legacy.careers as career (career)}
                  <li
                    class="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400"
                  >
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-600"
                    >
                      {career}
                    </Typography>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if legacy.certifications.length > 0}
            <div>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-1.5 block"
              >
                자격
              </Typography>
              <ul class="space-y-1">
                {#each legacy.certifications as cert (cert)}
                  <li
                    class="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400"
                  >
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-600"
                    >
                      {cert}
                    </Typography>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </div>
{/if}
