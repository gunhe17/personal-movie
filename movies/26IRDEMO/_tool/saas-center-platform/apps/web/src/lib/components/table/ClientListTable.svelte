<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import ActiveToggle from '$lib/components/common/ActiveToggle.svelte'
  import { dateToString } from '../../utils/date'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName, maskPhone } from '$lib/utils/maskingHandler'
  import type { TableColumn } from '../Table.svelte'
  import type { ClientCardVM } from '../../features/clients/view-model'
  import Table from '../Table.svelte'
  import { goto } from '$app/navigation'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { formatPhoneNumber } from '../../utils/stringConverter'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    filteredClients: ClientCardVM[]
    onStatusChange?: (clientId: string, status: string, name?: string) => void
    /** 화면 높이에 맞춰 계산된 행 높이(px). 모든 페이지 공통. 기본 80 */
    rowHeightPx?: number
  }

  let { filteredClients, onStatusChange, rowHeightPx = 80 }: Props = $props()

  const isActiveRow = (item: ClientCardVM) =>
    item.status.toUpperCase() === 'ACTIVE'

  // 비활성 딤드는 '행'이 아니라 '상태 칸을 뺀 셀들'에 준다.
  // 상태 칸의 토글이 딤드에 함께 흐려지면 켜짐/꺼짐을 읽을 수 없다 —
  // 비활성을 알리는 건 딤드고, 되돌리는 손잡이는 또렷해야 한다.
  const dimIfInactive = (item: ClientCardVM) =>
    isActiveRow(item) ? '' : 'opacity-50'

  const columns: TableColumn<ClientCardVM>[] = [
    {
      key: 'name',
      label: '내담자',
      width: 'minmax(220px, 2fr)',
      cellClass: dimIfInactive,
      render: nameCell
    },
    {
      key: 'phone',
      label: '연락처',
      width: '1.5fr',
      cellClass: dimIfInactive,
      render: phoneCell
    },
    {
      key: 'memo',
      label: '메모',
      width: '2fr',
      cellClass: dimIfInactive,
      render: memoCell
    },
    {
      key: 'voucher',
      label: '바우처',
      width: 'minmax(140px, 1.5fr)',
      cellClass: dimIfInactive,
      render: voucherCell
    },
    {
      key: 'createdAt',
      label: '등록일',
      width: '150px',
      cellClass: dimIfInactive,
      render: createdCell
    },
    {
      key: 'code',
      label: '내담자 코드',
      width: '110px',
      cellClass: dimIfInactive,
      render: codeCell
    },
    {
      key: 'status',
      label: '상태',
      width: 'minmax(130px, 1fr)',
      align: 'center',
      stopPropagation: true,
      render: statusCell
    }
  ]
</script>

<!-- 비활성 표시는 배지가 아니라 **토글(off) + 나머지 셀 딤드** 둘로만 한다.
     배지를 함께 두면 같은 사실을 세 번 말하게 되고, 토글 옆 pill이 토글의
     시각적 무게를 나눠 가져 "끄고 켜는 자리"가 흐려진다 -->
{#snippet statusCell({ item }: { item: ClientCardVM })}
  <div class="flex items-center justify-center">
    <ActiveToggle
      active={isActiveRow(item)}
      onToggle={(next) =>
        onStatusChange?.(item.id, next ? 'ACTIVE' : 'INACTIVE', item.name)}
    />
  </div>
{/snippet}
{#snippet createdCell({ item }: { item: ClientCardVM })}
  <Typography variant="body-01-normal-regular" color="text-gray-800" tag="span">
    {item.createdAtDate}
  </Typography>
{/snippet}
<!-- 내담자 코드 = 식별자. 이름(속성) 셀에서 분리한 전용 칼럼 -->
{#snippet codeCell({ item }: { item: ClientCardVM })}
  {#if item.code}
    <BadgeRectangle label={item.code} size="sm" />
  {:else}
    <Typography variant="body-01-normal-regular" color="text-gray-400"
      >-</Typography
    >
  {/if}
{/snippet}
{#snippet nameCell({ item }: { item: ClientCardVM })}
  <div class="flex min-w-0 items-center gap-3">
    <ClientAvatar
      profileImageUrl={item.profileImageUrl}
      name={$isSecretMode ? maskName(item.name) : item.name}
      gender={item.gender}
      sizeClass="h-10 w-10"
      textClass="text-[15px]"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <!-- min-w-0 = 이름만 줄어들고 배지는 온전히 남는다.
             (flex 자식의 min-width 기본값 auto라 이게 없으면 이름이 안 줄고 배지가 잘린다) -->
        <Typography
          variant="title-01-normal-semibold"
          color="text-gray-800"
          className="min-w-0 truncate-safe"
          tag="span"
        >
          {$isSecretMode ? maskName(item.name) : item.name}
        </Typography>
        {#if item.isGuardian}
          <BadgeRectangle label="보호자" size="sm" class="shrink-0" />
        {/if}
      </div>
      <ClientBirthGender
        birthDate={dateToString(item.birth, 'YYYY-MM-DD') || null}
        gender={item.gender}
      />
    </div>
  </div>
{/snippet}
{#snippet phoneCell({ item }: { item: ClientCardVM })}
  <Typography
    variant="body-01-normal-regular"
    color="text-gray-800"
    className="truncate-safe"
    tag="span"
  >
    {$isSecretMode ? '***-****-****' : formatPhoneNumber(item.phone) || '-'}
  </Typography>
{/snippet}
{#snippet memoCell({ item }: { item: ClientCardVM })}
  <Typography
    variant="body-01-normal-regular"
    color={item.memo ? 'text-gray-800' : 'text-gray-400'}
    className="block w-full truncate-safe"
    tag="span"
  >
    {$isSecretMode ? '***' : item.memo || '메모가 없습니다'}
  </Typography>
{/snippet}
{#snippet voucherCell({ item }: { item: ClientCardVM })}
  {#if item.voucherPrimary}
    <div class="flex items-center gap-1.5 overflow-hidden">
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="truncate-safe"
        tag="span"
      >
        {item.voucherPrimary.name}
      </Typography>
      <Typography
        variant="body-03-normal-regular"
        color="text-primary-500"
        className="shrink-0 whitespace-nowrap"
        tag="span"
      >
        잔여 {item.voucherPrimary.remaining}회
      </Typography>
      {#if item.voucherCount > 1}
        {#snippet voucherList()}
          <div class="flex min-w-40 flex-col gap-1.5 py-0.5 text-left">
            {#each item.vouchers as v, i (v.name + i)}
              <div
                class="flex items-center justify-between gap-3 whitespace-nowrap"
              >
                <span class="text-body-03-normal-medium text-white"
                  >{v.name}</span
                >
                <span class="text-body-03-normal-regular text-gray-300">
                  잔여 {v.remaining}/{v.total}회
                </span>
              </div>
            {/each}
          </div>
        {/snippet}
        <Tooltip placement="bottom" content={voucherList}>
          <span
            class="shrink-0 whitespace-nowrap text-body-02-normal-regular text-gray-400"
          >
            외 {item.voucherCount - 1}개
          </span>
        </Tooltip>
      {/if}
    </div>
  {:else}
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-400"
      tag="span"
    >
      -
    </Typography>
  {/if}
{/snippet}

<div
  class="flex flex-col h-full rounded-2xl border border-gray-200 overflow-hidden"
  style="--row-h: {rowHeightPx}px"
>
  <Table
    {columns}
    data={filteredClients}
    onRowClick={(row) => goto(`/clients/${row.id}`)}
    headerClass="bg-white border-b border-gray-200"
    bodyClass="flex-1 min-h-0 overflow-auto"
    containerClass="flex-1 min-h-0"
    hoverEnabled={true}
    rowHeight="h-[var(--row-h)] shrink-0"
    rowClass="border-gray-100 !py-0"
  />
</div>
