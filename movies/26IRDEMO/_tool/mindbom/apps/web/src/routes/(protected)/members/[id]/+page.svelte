<script lang="ts">
  import { examTypeLabel } from '$lib/features/examination/common/exam-visual'
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { get, patch } from '$lib/services/api/instances'
  import {
    institutionId,
    requireInstitutionId
  } from '$lib/stores/institution.store'
  import { modalStore, modalUtils } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import MemberEditModal from '$lib/features/members/components/MemberEditModal.svelte'
  import ExamStatusPill from '$lib/features/examination/common/components/ExamStatusPill.svelte'
  import { examProgressPath } from '$lib/features/examination/common/exam-route'
  import { isSupportedExamType } from '$lib/features/examination/core/registry'
  import Button from '$components/ui/Button.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import EmptyState from '$components/ui/EmptyState.svelte'
  import DetailPageHeader from '$components/ui/DetailPageHeader.svelte'
  import ProfileCard from '$components/ui/ProfileCard.svelte'
  import InlineDivider from '$components/ui/InlineDivider.svelte'
  import SectionTitle from '$components/ui/SectionTitle.svelte'
  import DescriptionList, {
    type DescriptionItem
  } from '$components/ui/DescriptionList.svelte'
  import DataTable, {
    type DataTableColumn
  } from '$components/ui/DataTable.svelte'
  import type { ExamStatus } from '$lib/features/examination/common/constants'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { maskName } from '$lib/utils/masking'

  interface MemberDetail {
    id: string
    institution_id: string
    account_id: string
    name: string
    role: string
    email: string | null
    license_number: string | null
    is_active: boolean
    created_at: string
    updated_at: string
  }

  interface ExamSummary {
    id: string
    exam_type: string
    status: string
    client_id: string
    client_name: string | null
    created_at: string
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원'
  }
  let member = $state<MemberDetail | null>(null)
  let exams = $state<ExamSummary[]>([])
  let isLoading = $state(true)

  let memberId = $derived(page.params.id ?? '')

  $effect(() => {
    const instId = $institutionId
    if (!instId || !memberId) return
    loadMember(instId, memberId)
  })

  async function loadMember(instId: string, mId: string) {
    isLoading = true
    try {
      const [memberRes, examRes] = await Promise.all([
        get<MemberDetail>(`/institutions/${instId}/members/${mId}`),
        get<{ items: ExamSummary[] }>(`/institutions/${instId}/examinations`, {
          examiner_id: mId,
          size: 50
        }).catch(() => ({ items: [] }))
      ])
      member = memberRes
      exams = examRes.items ?? []
    } catch {
      member = null
    } finally {
      isLoading = false
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  function openEditModal() {
    if (!member) return
    modalStore.open({
      component: MemberEditModal,
      props: {
        initialData: { name: member.name, role: member.role },
        onConfirm: async (data: { name: string; role: string }) => {
          const instId = requireInstitutionId()
          await patch(`/institutions/${instId}/members/${memberId}`, data)
          snackbarStore.success('직원 정보가 수정되었습니다.')
          loadMember(instId, memberId)
        }
      },
      options: { size: 'md' }
    })
  }

  async function handleToggleStatus() {
    if (!member) return
    const next = !member.is_active
    const verbing = next ? '활성화' : '비활성화'
    const confirmed = await modalUtils.confirm(
      `${member.name} 직원을 ${verbing}하시겠습니까?`,
      `${verbing} 확인`,
      { confirmText: verbing, cancelText: '취소' }
    )
    if (!confirmed) return
    try {
      const instId = requireInstitutionId()
      await patch(`/institutions/${instId}/members/${memberId}`, {
        is_active: next
      })
      snackbarStore.success(`${member.name} 직원이 ${verbing}되었습니다.`)
      loadMember(instId, memberId)
    } catch {
      snackbarStore.error(`${verbing}에 실패했습니다.`)
    }
  }

  // 스니펫 안에서는 `{#if member}`의 null 좁힘이 닿지 않는다 — 값으로 뽑아 쓴다.
  let displayName = $derived(
    member
      ? secretModeStore.enabled
        ? maskName(member.name)
        : member.name
      : ''
  )
  let isActive = $derived(member?.is_active === true)
  let roleLabel = $derived(
    member ? (ROLE_LABELS[member.role] ?? member.role) : null
  )

  /**
   * 기본 정보 — 이름·역할·상태는 카드 헤더(아바타 아래)가 이미 보여주므로 뺀다.
   * 값이 없어도 '-'로 자리를 지킨다(레이블 열 폭이 흔들리지 않게).
   */
  let infoItems = $derived<DescriptionItem[]>(
    member
      ? [
          { label: '이메일', value: member.email },
          { label: '자격증 번호', value: member.license_number },
          { label: '등록일', value: formatDate(member.created_at) },
          { label: '수정일', value: formatDate(member.updated_at) }
        ]
      : []
  )

  /**
   * 검사 행 클릭 — 검사 목록과 같은 규약으로 진행 화면에 직행한다.
   * (`/examinations/{id}` 상세 페이지는 진입점이 없어 삭제했다.)
   */
  function openExam(item: ExamSummary) {
    if (!isSupportedExamType(item.exam_type)) {
      snackbarStore.info(
        `${item.exam_type.toUpperCase()} 검사 화면은 준비 중입니다.`
      )
      return
    }
    goto(examProgressPath(item.id, item.exam_type))
  }

  const examColumns: DataTableColumn[] = [
    {
      key: 'exam_type',
      label: '검사 유형',
      width: 'minmax(160px, 1.2fr)',
      render: typeCell
    },
    {
      key: 'client_name',
      label: '내담자',
      width: 'minmax(120px, 1fr)',
      render: clientCell
    },
    { key: 'status', label: '상태', width: '140px', render: statusCell },
    { key: 'created_at', label: '등록일', width: '120px', render: dateCell }
  ]
</script>

{#snippet statusValue()}
  <span
    class="inline-flex items-center gap-1.5 text-body-02-normal-regular {isActive
      ? 'text-green-700'
      : 'text-gray-500'}"
  >
    <span
      class="h-2 w-2 rounded-full {isActive ? 'bg-green-500' : 'bg-gray-300'}"
    ></span>
    {isActive ? '활성' : '비활성'}
  </span>
{/snippet}

{#snippet typeCell({ item }: { item: ExamSummary })}
  <span class="truncate text-body-02-normal-semibold text-gray-900">
    {examTypeLabel(item.exam_type)}
  </span>
{/snippet}

{#snippet clientCell({ item }: { item: ExamSummary })}
  <span class="truncate text-body-02-normal-regular text-gray-600">
    {item.client_name
      ? secretModeStore.enabled
        ? maskName(item.client_name)
        : item.client_name
      : '-'}
  </span>
{/snippet}

{#snippet statusCell({ item }: { item: ExamSummary })}
  <ExamStatusPill status={item.status as ExamStatus} />
{/snippet}

{#snippet dateCell({ item }: { item: ExamSummary })}
  <span class="text-body-02-normal-regular text-gray-500">
    {formatDate(item.created_at)}
  </span>
{/snippet}

<!--
  한 화면에 담는다 — 페이지는 스크롤하지 않고 좌/우 카드 내부에서만 스크롤한다
  (리스트 페이지와 동일). xl 미만에서는 2분할이 풀리므로 페이지 스크롤을 허용한다.

  우측 여백을 두지 않는다 — 우측 이력 패널이 화면 끝까지 차야 표가 열을 넉넉히 쓴다.
-->
<div
  in:fade
  class="flex flex-col p-4 pt-3 md:p-6 md:pr-0 lg:p-8 lg:pt-3 xl:h-full xl:min-h-0"
>
  {#if isLoading}
    <div class="flex h-60 items-center justify-center">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
      ></div>
    </div>
  {:else if !member}
    <div
      class="mr-4 rounded-2xl border border-gray-200 bg-white md:mr-6 lg:mr-8"
    >
      <EmptyState
        icon="person_off"
        title="직원을 찾을 수 없습니다"
        description="삭제되었거나 접근 권한이 없는 직원입니다"
      >
        {#snippet actions()}
          <Button variant="outlineSecondary" size="md" href="/members"
            >목록으로</Button
          >
        {/snippet}
      </EmptyState>
    </div>
  {:else}
    <!-- 이름은 좌측 ProfileCard가 보여준다 — 여기서는 목록으로 돌아가는 길만 -->
    <DetailPageHeader backHref="/members" backLabel="직원 목록" />

    <!-- 2분할 — 좌측 요약(460 고정) / 우측 이력. 정본 §2분할 콘텐츠, gap 16. -->
    <div
      class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[460px_1fr] xl:grid-rows-[minmax(0,1fr)]"
    >
      <!-- ===== 좌측: 프로필 ===== -->
      <ProfileCard name={displayName} role="counselor" class="max-xl:h-auto">
        {#snippet headerAction()}
          <button
            onclick={openEditModal}
            class="flex items-center gap-1 text-body-02-normal-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <Icon name="edit" size="sm" />
            수정
          </button>
        {/snippet}

        {#snippet subline()}
          {#if roleLabel}
            <span class="text-body-02-normal-regular text-gray-600"
              >{roleLabel}</span
            >
            <InlineDivider />
          {/if}
          {@render statusValue()}
        {/snippet}

        <div class="border-t border-gray-100 pt-6">
          <DescriptionList items={infoItems} />
        </div>

        <div class="mt-6 border-t border-gray-100 pt-6">
          <Button
            variant={isActive ? 'outlineCaution' : 'outlineSecondary'}
            size="md"
            fullWidth
            icon={isActive ? 'lock' : 'lock_open'}
            onclick={handleToggleStatus}
          >
            {isActive ? '비활성화' : '활성화'}
          </Button>
        </div>
      </ProfileCard>

      <!-- ===== 우측: 담당 검사 이력 ===== -->
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6"
      >
        <SectionTitle
          title="담당 검사 이력"
          count="총 {exams.length}건"
          class="shrink-0"
        />
        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200"
        >
          <DataTable
            class="flex-1"
            columns={examColumns}
            data={exams}
            onRowClick={openExam}
          >
            {#snippet empty()}
              <EmptyState icon="assignment" title="담당한 검사가 없습니다" />
            {/snippet}
          </DataTable>
        </div>
      </section>
    </div>
  {/if}
</div>
