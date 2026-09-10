<script lang="ts">
  import type { SessionCardResponseType } from '$lib/stores/sessionStatus_local'

  import { modalStore } from '$lib/stores/modal'
  import Table from '$lib/components/Table.svelte'
  import QuickThunderIcon from '$lib/assets/QuickThunderIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import AssessmentSendModal from '../modal/AssessmentSendModal.svelte'
  import AssessmentSendHistoryModal from '../modal/AssessmentSendHistoryModal.svelte'

  interface Props {
    items: SessionCardResponseType[]
    onCheckChange?: (selectedIds: string[]) => void
    onSendComplete?: () => void
  }

  let { items = [], onCheckChange, onSendComplete }: Props = $props()

  let selectedIds = $state<string[]>([])

  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayOfWeek = days[date.getDay()]
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} (${dayOfWeek}) ${hours}:${minutes}`
  }

  function handleCheckChange(ids: string[]) {
    onCheckChange?.(ids)
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

  const onClickAssessmentSendHistory = () => {
    modalStore.open({
      component: AssessmentSendHistoryModal,
      props: {
        sessionId: '456'
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
  <button>
    <Typography
      variant="body-02-medium"
      className="underline"
      color="text-etc-gray"
    >
      {item.assessment_code}
    </Typography>
  </button>
{/snippet}

{#snippet renderDate({ item }: { item: SessionCardResponseType })}
  <span class="text-body-02-normal-regular text-gray-600">
    {formatDate(item.applied_at)}
  </span>
{/snippet}

{#snippet renderDeadline({ item }: { item: SessionCardResponseType })}
  <span class="text-body-02-normal-regular text-gray-600">
    {formatDateTime(item.applied_at)}
  </span>
{/snippet}

{#snippet renderStatus({ item }: { item: SessionCardResponseType })}
  <div class="flex-center">
    <button
      class="w-fit px-3.5 py-[5px]"
      onclick={() => {
        onClickAssessmentSendHistory()
      }}
    >
      <Typography
        variant="body-02-medium"
        className="underline"
        color="text-etc-gray"
      >
        전송기록보기
      </Typography>
    </button>
  </div>
{/snippet}

{#snippet renderActions({ item }: { item: SessionCardResponseType })}
  <button
    onclick={() => onClickSendAssessmentButton(item)}
    class="flex-center mx-auto h-10 w-[70px] gap-2 rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50"
  >
    <Typography variant="title-01-semibold" color="text-gray-400"
      >재전송</Typography
    >
  </button>
{/snippet}

<Table
  columns={[
    { key: 'assessment_code', label: '검사 코드', width: '80px' },
    {
      key: 'client',
      label: '내담자/담당자',
      width: '1.5fr',
      render: renderClient
    },
    {
      key: 'assessment_code',
      label: '검사 코드',
      width: '1.5fr',
      render: renderAssessments
    },
    {
      key: 'applied_at',
      label: '접수일',
      width: '1.5fr',
      render: renderDate
    },
    {
      key: 'deadline',
      label: '마감일',
      width: '1.5fr',
      render: renderDeadline
    },
    {
      key: 'session_status',
      label: '전송 내역',
      width: '1.5fr',
      headerClass: 'flex-center',
      render: renderStatus
    },
    {
      key: 'actions',
      label: '',
      width: '1fr',
      render: renderActions
    }
  ]}
  data={items}
  keyField="uid"
  showCheckbox={true}
  bind:selectedIds
  onCheckChange={handleCheckChange}
/>
