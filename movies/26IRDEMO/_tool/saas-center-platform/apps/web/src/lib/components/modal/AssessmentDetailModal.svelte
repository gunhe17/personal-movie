<script lang="ts">
  import { queryBuilder } from '../../hooks/queries/builder'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import {
    getAssessmentDetail,
    type AssessmentDetail
  } from '../../hooks/actions/assessment.action'
  import { ASSESSMENT_DETAIL_STALE_TIME } from '../../features/assessment/manage/constants'

  interface Props {
    modalId?: string
    closeModal?: () => void
    /** 검사 마스터 id (CenterAssessment.assessment_id) */
    assessmentId: string
    /** 카드가 이미 아는 값 — 캐시가 비어 있을 때의 헤더 폴백 */
    titleKo?: string
    titleEn?: string
  }

  let {
    modalId = '',
    closeModal = () => {},
    assessmentId,
    titleKo = '',
    titleEn = ''
  }: Props = $props()

  // 서비스가 열기 전에 이미 받아둔다 — 여기선 캐시를 그대로 쓰고 다시 부르지 않는다
  // (재조회하면 열린 뒤 내용이 바뀌면서 높이가 다시 움직인다).
  const detailQuery = queryBuilder<AssessmentDetail, AssessmentDetail>(
    getAssessmentDetail,
    () => ({ assessmentId }),
    { staleTime: ASSESSMENT_DETAIL_STALE_TIME, refetchOnMount: false }
  )

  const detail = $derived(detailQuery.data)
  const isLoading = $derived(detailQuery.isLoading)

  // 어드민 '검사 특성'과 동일한 세 항목 (duration · age · description)
  const fields = $derived([
    {
      label: '소요 시간',
      value: detail?.duration ? `${detail.duration}분` : ''
    },
    { label: '대상 연령', value: detail?.age ?? '' },
    { label: '검사 설명', value: detail?.description ?? '' }
  ])
</script>

<!-- 조회 전용(footer 없음) — 본문 하단만 40 (Web_Design §Components>modal) -->
<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  bodyClass="p-5 pb-10"
  headerClass="px-5 py-4 items-start"
>
  {#snippet header()}
    <!-- 2줄 헤더: 타이틀(L, 20/Semibold) ↔ 부제(15/Regular gray-500) 간격 8 -->
    <div class="flex min-w-0 flex-col gap-2">
      <Typography variant="headline-02-normal-semibold" color="text-gray-900">
        {detail?.kor_name || titleKo}
      </Typography>
      {#if detail?.eng_name || titleEn}
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          {detail?.eng_name || titleEn}
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    {#if isLoading && !detail}
      <div class="space-y-3">
        {#each Array(3) as _}
          <div class="h-6 w-full animate-pulse rounded bg-gray-100"></div>
        {/each}
      </div>
    {:else}
      <!-- 관련 필드 묶음 세로 나열 = 12 -->
      <dl class="space-y-3">
        {#each fields as { label, value }}
          <div class="flex items-baseline gap-2">
            <dt class="w-20 shrink-0">
              <Typography
                variant="body-02-normal-medium"
                tag="span"
                color="text-title-subtitle">{label}</Typography
              >
            </dt>
            <dd class="min-w-0 flex-1">
              <Typography
                variant="body-01-reading-regular"
                tag="span"
                color="text-gray-800">{value || '-'}</Typography
              >
            </dd>
          </div>
        {/each}
      </dl>
    {/if}
  {/snippet}
</BaseModal>
