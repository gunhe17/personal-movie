<!--
  CounselingLogsTable
  내가 진행한 상담 목록 테이블.
  - 내 정보 > 상담 이력 탭(인라인)과 /myInfo/counselingLogs(전체 목록)에서 공용
  - 행 클릭 시 해당 상담 케이스 상세로 이동
-->
<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '@common/components/Typography.svelte'
  import Table from '$lib/components/Table.svelte'

  interface Props {
    items: any[]
    /** 페이지처럼 남은 높이를 채워야 하면 flex 클래스를 넘긴다 */
    containerClass?: string
    bodyClass?: string
  }

  let { items, containerClass = '', bodyClass = '' }: Props = $props()

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    return dateStr.slice(0, 10)
  }
</script>

{#snippet programCell({
  item
}: {
  item: any
  index: number
  isChecked: boolean
})}
  <div class="min-w-0">
    <Typography
      variant="body-02-normal-medium"
      color="text-gray-800"
      className="truncate-safe"
    >
      {item.program_name || '-'}
    </Typography>
  </div>
{/snippet}

{#snippet periodCell({
  item
}: {
  item: any
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-regular" color="text-gray-600">
    {formatDate(item.created_at)}
  </Typography>
{/snippet}

{#snippet sessionsCell({
  item
}: {
  item: any
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-medium" color="text-gray-800">
    {item.completed_sessions}/{item.total_sessions}회
  </Typography>
{/snippet}

<Table
  {containerClass}
  {bodyClass}
  columns={[
    {
      key: 'program_name',
      label: '프로그램',
      width: '1.5fr',
      align: 'left',
      render: programCell as any
    },
    {
      key: 'created_at',
      label: '기간',
      width: '1fr',
      align: 'left',
      render: periodCell as any
    },
    {
      key: 'sessions',
      label: '회기 수',
      width: '1fr',
      align: 'left',
      render: sessionsCell as any
    }
  ]}
  data={items}
  keyField="case_id"
  onRowClick={(item) => goto(`/counseling/status/${item.case_id}`)}
  hoverEnabled
  rowHeight="h-[60px] shrink-0"
  headerClass="h-11! bg-gray-50 border-b border-gray-100"
  rowClass="border-gray-100 !py-0"
/>
