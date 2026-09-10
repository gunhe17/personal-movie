<script lang="ts">
  import { examTypeLabel } from '$lib/features/examination/common/exam-visual'
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { get } from '$lib/services/api/instances'
  import { institutionId } from '$lib/stores/institution.store'
  import { requireInstitutionId } from '$lib/stores/institution.store'
  import { modalStore, modalUtils } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { patch } from '$lib/services/api/instances'
  import ClientFormModal from '$lib/features/clients/components/ClientFormModal.svelte'
  import ExamStatusPill from '$lib/features/examination/common/components/ExamStatusPill.svelte'
  import Button from '$components/ui/Button.svelte'
  import Card from '$components/ui/Card.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import EmptyState from '$components/ui/EmptyState.svelte'
  import DetailPageHeader from '$components/ui/DetailPageHeader.svelte'
  import ProfileCard from '$components/ui/ProfileCard.svelte'
  import InlineDivider from '$components/ui/InlineDivider.svelte'
  import Tabs from '$components/ui/Tabs.svelte'
  import SectionTitle from '$components/ui/SectionTitle.svelte'
  import DescriptionList, {
    type DescriptionItem
  } from '$components/ui/DescriptionList.svelte'
  import DataTable, {
    type DataTableColumn
  } from '$components/ui/DataTable.svelte'
  import type { ExamStatus } from '$lib/features/examination/common/constants'
  import type { ClientFormData } from '$lib/features/clients/types'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { maskName, maskPhone, maskEmail } from '$lib/utils/masking'
  import { reportService } from '$lib/features/report/report-service'
  import {
    SELECTABLE_STATUSES,
    REPORT_STATUS_CONFIG
  } from '$lib/features/report/constants'
  import type { ComprehensiveReportSummary } from '$lib/features/report/types'

  interface ClientDetail {
    id: string
    institution_id: string
    name: string
    birth_date: string | null
    gender: string | null
    phone: string | null
    email: string | null
    education_level: string | null
    occupation: string | null
    referral_source: string | null
    status: string
    note: string | null
    created_at: string
    updated_at: string
  }

  interface ExamSummary {
    id: string
    exam_type: string
    status: string
    examiner_name: string | null
    battery_id: string | null
    created_at: string
  }

  interface BatteryGroup {
    battery_id: string
    exams: ExamSummary[]
    selectableExams: ExamSummary[]
  }

  const GENDER_LABELS: Record<string, string> = { male: '남성', female: '여성' }
  const REFERRAL_LABELS: Record<string, string> = {
    hospital: '병원',
    school: '학교',
    self: '자발적',
    other: '기타'
  }
  let client = $state<ClientDetail | null>(null)
  let exams = $state<ExamSummary[]>([])
  let reports = $state<ComprehensiveReportSummary[]>([])
  let isLoading = $state(true)


  let clientId = $derived(page.params.id ?? '')

  // 배터리(그룹) 묶기 — 2건 이상 묶인 배터리만 그룹으로 노출
  let batteries = $derived.by((): BatteryGroup[] => {
    const map = new Map<string, ExamSummary[]>()
    for (const e of exams) {
      if (!e.battery_id) continue
      const arr = map.get(e.battery_id) ?? []
      arr.push(e)
      map.set(e.battery_id, arr)
    }
    return [...map.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([battery_id, list]) => ({
        battery_id,
        exams: list,
        selectableExams: list.filter((e) => SELECTABLE_STATUSES.has(e.status))
      }))
  })
  $effect(() => {
    const instId = $institutionId
    if (!instId || !clientId) return
    loadClient(instId, clientId)
  })

  async function loadClient(instId: string, cId: string) {
    isLoading = true
    try {
      const [clientRes, examRes, reportRes] = await Promise.all([
        get<ClientDetail>(`/institutions/${instId}/clients/${cId}`),
        get<{ items: ExamSummary[] }>(`/institutions/${instId}/examinations`, {
          client_id: cId,
          size: 50
        }).catch(() => ({ items: [] })),
        reportService.list(instId, cId).catch(() => ({ items: [], total: 0 }))
      ])
      client = clientRes
      exams = examRes.items ?? []
      reports = reportRes.items ?? []
    } catch {
      client = null
    } finally {
      isLoading = false
    }
  }

  /**
   * 종합보고서 진입 — 배터리(묶음) 단위로만 연다.
   *
   * 예전엔 표에서 검사를 체크해 임의 조합을 만들 수 있었으나 없앴다.
   * "무엇을 묶을지"는 묶음이 정하는 것이지 화면에서 그때그때 고를 일이 아니다
   * (docs/온톨로지/검사축-구현방안.md §5.5 — 묶음 소유는 플랫폼 case).
   * battery_id는 그 case의 자리표이므로, case_id 전환 시 여기만 바꾸면 된다.
   */
  function startBatteryReport(group: BatteryGroup) {
    const ids = group.selectableExams.map((e) => e.id)
    if (ids.length < 2) return
    goto(`/examinations/${ids[0]}/report?ids=${ids.join(',')}`)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  function calculateAge(birthDate: string | null): string {
    if (!birthDate) return '-'
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return `${age}세`
  }

  function openEditModal() {
    if (!client) return
    modalStore.open({
      component: ClientFormModal,
      props: {
        title: '내담자 수정',
        initialData: {
          name: client.name,
          birth_date: client.birth_date ?? undefined,
          gender: client.gender ?? undefined,
          phone: client.phone ?? undefined,
          email: client.email ?? undefined,
          education_level: client.education_level ?? undefined,
          occupation: client.occupation ?? undefined,
          referral_source: client.referral_source ?? undefined,
          note: client.note ?? undefined
        },
        onConfirm: async (data: ClientFormData) => {
          const instId = requireInstitutionId()
          await patch(`/institutions/${instId}/clients/${clientId}`, data)
          snackbarStore.success('내담자 정보가 수정되었습니다.')
          loadClient(instId, clientId)
        }
      },
      options: { size: 'lg' }
    })
  }

  async function handleToggleStatus() {
    if (!client) return
    const next = client.status === 'active' ? 'inactive' : 'active'
    const verbing = next === 'inactive' ? '비활성화' : '활성화'
    const confirmed = await modalUtils.confirm(
      `이 내담자를 ${verbing}하시겠습니까?`,
      `${verbing} 확인`,
      { confirmText: verbing, cancelText: '취소' }
    )
    if (!confirmed) return
    try {
      const instId = requireInstitutionId()
      await patch(`/institutions/${instId}/clients/${clientId}`, {
        status: next
      })
      snackbarStore.success(`내담자가 ${verbing}되었습니다.`)
      loadClient(instId, clientId)
    } catch {
      snackbarStore.error(`${verbing}에 실패했습니다.`)
    }
  }

  // 스니펫 안에서는 `{#if client}`의 null 좁힘이 닿지 않는다 — 값으로 뽑아 쓴다.
  let isActive = $derived(client?.status === 'active')

  let activeTab = $state('exams')
  let tabs = $derived([
    { value: 'exams', label: '검사 이력', count: exams.length },
    { value: 'reports', label: '종합보고서', count: reports.length }
  ])

  let displayName = $derived(
    client
      ? secretModeStore.enabled
        ? maskName(client.name)
        : client.name
      : ''
  )
  // 스니펫 안에서는 `{#if client}`의 null 좁힘이 닿지 않아 값으로 뽑아둔다.
  let birthLine = $derived(
    client?.birth_date
      ? `${formatDate(client.birth_date)} (${calculateAge(client.birth_date)})`
      : null
  )
  let genderLabel = $derived(
    client?.gender ? (GENDER_LABELS[client.gender] ?? client.gender) : null
  )
  let note = $derived(client?.note ?? null)

  /**
   * 기본 정보 — 값이 없어도 '-'로 자리를 지킨다(레이블 열 폭이 흔들리지 않게).
   * 이름·상태·생년월일·성별은 카드 헤더(아바타 아래)가 이미 보여주므로 여기서 뺀다.
   */
  let infoItems = $derived<DescriptionItem[]>(
    client
      ? [
          {
            label: '연락처',
            value: client.phone
              ? secretModeStore.enabled
                ? maskPhone(client.phone)
                : client.phone
              : null
          },
          {
            label: '이메일',
            value: client.email
              ? secretModeStore.enabled
                ? maskEmail(client.email)
                : client.email
              : null
          },
          {
            label: '의뢰 경로',
            value: client.referral_source
              ? (REFERRAL_LABELS[client.referral_source] ??
                client.referral_source)
              : null
          },
          { label: '학력', value: client.education_level },
          { label: '직업', value: client.occupation },
          ...(client.note ? [{ label: '비고', value: client.note }] : []),
          { label: '등록일', value: formatDate(client.created_at) },
          { label: '수정일', value: formatDate(client.updated_at) }
        ]
      : []
  )

  const examColumns: DataTableColumn[] = [
    {
      key: 'exam_type',
      label: '검사 유형',
      width: 'minmax(160px, 1.2fr)',
      render: typeCell
    },
    { key: 'examiner_name', label: '검사자', width: 'minmax(120px, 1fr)' },
    { key: 'status', label: '상태', width: '140px', render: examStatusCell },
    { key: 'created_at', label: '등록일', width: '120px', render: examDateCell }
  ]

  const reportColumns: DataTableColumn[] = [
    {
      key: 'title',
      label: '제목',
      width: 'minmax(200px, 2fr)',
      render: reportTitleCell
    },
    {
      key: 'exam_count',
      label: '검사 수',
      width: '100px',
      render: reportCountCell
    },
    { key: 'status', label: '상태', width: '140px', render: reportStatusCell },
    {
      key: 'updated_at',
      label: '수정일',
      width: '120px',
      render: reportDateCell
    }
  ]
</script>

{#snippet statusValue()}
  <span
    class="inline-flex items-center gap-1.5 text-body-01-normal-regular {isActive
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
  <span class="flex min-w-0 items-center gap-1.5">
    <span class="truncate text-body-02-normal-semibold text-gray-900">
      {examTypeLabel(item.exam_type)}
    </span>
    {#if item.battery_id}
      <span
        class="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-caption-01-normal-medium text-primary-600"
        title="복합 검사 배터리"
      >
        배터리
      </span>
    {/if}
  </span>
{/snippet}

{#snippet examStatusCell({ item }: { item: ExamSummary })}
  <ExamStatusPill status={item.status as ExamStatus} />
{/snippet}

{#snippet examDateCell({ item }: { item: ExamSummary })}
  <span class="text-body-02-normal-regular text-gray-500"
    >{formatDate(item.created_at)}</span
  >
{/snippet}

{#snippet reportTitleCell({ item }: { item: ComprehensiveReportSummary })}
  <span class="truncate text-body-02-normal-semibold text-gray-900">
    {item.title ?? '종합 심리평가 보고서'}
  </span>
{/snippet}

{#snippet reportCountCell({ item }: { item: ComprehensiveReportSummary })}
  <span class="text-body-02-normal-regular text-gray-600"
    >{item.exam_count}건</span
  >
{/snippet}

{#snippet reportStatusCell({ item }: { item: ComprehensiveReportSummary })}
  {@const cfg = REPORT_STATUS_CONFIG[item.status] ?? {
    label: item.status,
    dot: 'bg-gray-400',
    text: 'text-gray-600'
  }}
  <span
    class="inline-flex items-center gap-1.5 text-label-01-normal-semibold {cfg.text}"
  >
    <span class="h-2 w-2 rounded-full {cfg.dot}"></span>
    {cfg.label}
  </span>
{/snippet}

{#snippet reportDateCell({ item }: { item: ComprehensiveReportSummary })}
  <span class="text-body-02-normal-regular text-gray-500"
    >{formatDate(item.updated_at)}</span
  >
{/snippet}

<!--
  한 화면에 담는다 — 페이지는 스크롤하지 않고 좌/우 카드 내부에서만 스크롤한다
  (리스트 페이지와 동일). xl 미만에서는 2분할이 풀리므로 페이지 스크롤을 허용한다.

  우측 여백(pr)과 max-width를 두지 않는다 — 우측 탭 패널이 화면 끝까지 차야
  표가 열을 넉넉히 쓴다. 좌·상·하 여백만 셸과의 간격으로 남긴다.
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
  {:else if !client}
    <div
      class="mr-4 rounded-2xl border border-gray-200 bg-white md:mr-6 lg:mr-8"
    >
      <EmptyState
        icon="person_off"
        title="내담자를 찾을 수 없습니다"
        description="삭제되었거나 접근 권한이 없는 내담자입니다"
      >
        {#snippet actions()}
          <Button variant="outlineSecondary" size="md" href="/clients"
            >목록으로</Button
          >
        {/snippet}
      </EmptyState>
    </div>
  {:else}
    <!-- 이름은 좌측 ProfileCard가 보여준다 — 여기서는 목록으로 돌아가는 길만 -->
    <DetailPageHeader backHref="/clients" backLabel="내담자 목록" />

    <!--
      2분할 — 좌측 요약(460 고정) / 우측 이력. 정본 §2분할 콘텐츠, gap 16.
      좁은 화면에서는 세로로 쌓고, 그때는 높이 고정을 풀어 페이지가 스크롤되게 한다.
    -->
    <div
      class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[460px_1fr] xl:grid-rows-[minmax(0,1fr)]"
    >
      <!-- ===== 좌측: 프로필 ===== -->
      <ProfileCard
        name={displayName}
        gender={client.gender}
        role="client"
        class="max-xl:h-auto"
      >
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
          {#if birthLine}
            <span class="text-body-02-normal-regular text-gray-600"
              >{birthLine}</span
            >
            <InlineDivider />
          {/if}
          {#if genderLabel}
            <span class="text-body-02-normal-regular text-gray-600"
              >{genderLabel}</span
            >
            <InlineDivider />
          {/if}
          {@render statusValue()}
        {/snippet}

        <div class="border-t border-gray-100 pt-6">
          <DescriptionList items={infoItems} />
        </div>

        {#if note}
          <div class="mt-6">
            <p class="mb-2 text-body-02-normal-medium text-gray-600">비고</p>
            <p
              class="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-body-02-normal-regular text-gray-800"
            >
              {note}
            </p>
          </div>
        {/if}

        <!-- 활성/비활성 전환은 파괴적이지 않지만 되돌리는 액션이라 카드 맨 아래 -->
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

      <!-- ===== 우측: 탭 패널 ===== -->
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 pt-3"
      >
        <Tabs
          {tabs}
          selected={activeTab}
          onChange={(v) => (activeTab = v)}
          fixedWidth={false}
          class="shrink-0"
        />

        <div class="flex min-h-0 flex-1 flex-col pt-4">
          {#if activeTab === 'exams'}
            <!-- 배터리 — 검사 이력의 맥락이라 같은 탭 위쪽에 둔다 -->
            {#if batteries.length > 0}
              <div class="mb-4 shrink-0">
                <SectionTitle
                  title="검사 배터리"
                  description="함께 등록된 검사 묶음입니다. 모두 확인완료되면 배터리 단위로 종합보고서를 작성할 수 있습니다."
                />
                <div class="flex flex-col gap-2">
                  {#each batteries as bat (bat.battery_id)}
                    {@const ready = bat.selectableExams.length >= 2}
                    <div
                      class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        {#each bat.exams as e (e.id)}
                          <span
                            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1"
                          >
                            <span
                              class="text-label-01-normal-medium text-gray-800"
                            >
                              {examTypeLabel(e.exam_type)}
                            </span>
                            <ExamStatusPill
                              status={e.status as ExamStatus}
                              size="xs"
                            />
                          </span>
                        {/each}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="description"
                        disabled={!ready}
                        onclick={() => startBatteryReport(bat)}
                        class="shrink-0"
                      >
                        종합보고서 작성
                      </Button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div
              class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200"
            >
              <DataTable
                class="flex-1"
                columns={examColumns}
                data={exams}
              >
                {#snippet empty()}
                  <EmptyState
                    icon="assignment"
                    title="등록된 검사가 없습니다"
                    description="새 검사를 등록해보세요"
                  />
                {/snippet}
              </DataTable>
            </div>
          {:else}
            <div
              class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200"
            >
              <DataTable
                class="flex-1"
                columns={reportColumns}
                data={reports}
                onRowClick={(r) => goto(`/clients/${clientId}/reports/${r.id}`)}
              >
                {#snippet empty()}
                  <EmptyState
                    icon="description"
                    title="작성된 종합보고서가 없습니다"
                    description="검사 배터리의 검사가 2건 이상 확인완료되면 작성할 수 있습니다"
                  />
                {/snippet}
              </DataTable>
            </div>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>
