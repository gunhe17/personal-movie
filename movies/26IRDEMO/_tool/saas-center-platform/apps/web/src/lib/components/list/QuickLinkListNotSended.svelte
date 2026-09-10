<script lang="ts">
  import { modalStore } from '$lib/stores/modal'
  import type {
    SessionCardResponseType,
    SessionStatusType
  } from '$lib/stores/sessionStatus_local'

  import Table from '../Table.svelte'
  import SendPlaneIcon from '$lib/assets/SendPlaneIcon.svelte'
  import QuickThunderIcon from '$lib/assets/QuickThunderIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import AssessmentSendModal from '../modal/AssessmentSendModal.svelte'

  interface Props {
    items: SessionCardResponseType[]
    onSend?: (id: string) => void
    onCheckChange?: (selectedIds: string[]) => void
    onSendComplete?: () => void
  }

  let { items = [], onSend, onCheckChange, onSendComplete }: Props = $props()

  let selectedIds = $state<string[]>([])

  const statusLabels: Record<SessionStatusType, string> = {
    beforeSend: '미전송',
    inProgress: '재전송',
    reviewed: '재전송',
    not_reviewed: '재전송',
    gradingRequired: '재전송',
    gradingFinished: '재전송',
    reportFinished: '재전송',
    reportRejected: '재전송'
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function handleCheckChange(ids: string[]) {
    onCheckChange?.(ids)
  }

  function handleSend(id: string) {
    onSend?.(id)
  }

  const onClickSendAssessmentButton = (
    sessionInfo: SessionCardResponseType
  ) => {
    modalStore.open({
      component: AssessmentSendModal,
      props: {
        sessionInfo,
        onSendComplete
      },
      options: {
        customWidth: 540,
        desktopOnly: true
      }
    })
  }
</script>

{#snippet renderClient({ item }: { item: SessionCardResponseType })}
  <div class="flex items-center gap-3 min-w-0">
    <QuickThunderIcon />
    <div class="flex flex-col gap-2 min-w-0">
      <Typography
        variant="title-02-semibold"
        color="text-gray-900"
        className="truncate-safe">{item.child.child_name}</Typography
      >
      <Typography
        variant="title-02-regular"
        color="text-gray-900"
        className="truncate-safe"
      >
        {item.expert.expert_name}
      </Typography>
    </div>
  </div>
{/snippet}

{#snippet renderAssessments({ item }: { item: SessionCardResponseType })}
  <div class="flex flex-wrap items-center gap-1">
    <!-- 패키지가 있으면 표시 -->
    {#if item.package_name}
      <div class="rounded-lg border border-primary-100 bg-primary-50 p-2">
        <Typography variant="body-03-medium" color="text-primary-500">
          {item.package_name}
        </Typography>
      </div>
    {/if}

    <!-- 개별 검사가 있으면 표시 -->
    {#if item.assessments && item.assessments.length > 0}
      <!-- 패키지가 있을 때는 + 기호 표시 -->
      {#if item.package_name}
        <span class="text-body-03-normal-medium text-gray-400">+</span>
      {/if}

      <div
        class="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-2"
      >
        <Typography variant="body-03-medium" color="text-gray-600">
          {item.assessments[0].assessment_id}
        </Typography>
        {#if item.assessments.length > 1}
          <Typography variant="body-03-medium" color="text-gray-600">
            외 {item.assessments.length - 1}
          </Typography>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet renderStatus({ item }: { item: SessionCardResponseType })}
  <div class="flex w-fit rounded-sm bg-trans-bg-gray px-3.5 py-[5px]">
    <Typography variant="body-02-medium" color="text-etc-gray">
      {statusLabels[item.session_status]}
    </Typography>
  </div>
{/snippet}

{#snippet renderDate({ item }: { item: SessionCardResponseType })}
  <span class="text-body-02-normal-regular text-gray-600">
    {formatDate(item.applied_at)}
  </span>
{/snippet}

{#snippet renderActions({ item }: { item: SessionCardResponseType })}
  <button
    onclick={() => onClickSendAssessmentButton(item)}
    class="flex h-10 w-30 items-center justify-center gap-2 rounded-lg bg-primary-500 transition-colors hover:bg-blue-700"
  >
    <SendPlaneIcon />
    <Typography variant="title-02-semibold" color="text-white">전송</Typography>
  </button>
{/snippet}

<Table
  columns={[
    { key: 'assessment_code', label: '검사 코드', width: '80px' },
    {
      key: 'client',
      label: '내담자/담당자',
      width: '140px',
      render: renderClient
    },
    {
      key: 'assessments',
      label: '검사 종류',
      width: '1fr',
      render: renderAssessments
    },
    { key: 'applied_at', label: '접수일', width: '150px', render: renderDate },
    {
      key: 'session_status',
      label: '상태',
      width: '80px',
      render: renderStatus
    },
    { key: 'actions', label: '링크', width: '140px', render: renderActions }
  ]}
  data={items}
  keyField="session_id"
  showCheckbox={true}
  bind:selectedIds
  onCheckChange={handleCheckChange}
/>
