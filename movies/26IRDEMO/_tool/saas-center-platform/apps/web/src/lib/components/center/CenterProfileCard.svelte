<script lang="ts">
  import { emptyValueLabel } from '$lib/utils/stringConverter'
  import CameraIcon from '$lib/assets/CameraIcon.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import GroupIcon from '$lib/assets/GroupIcon.svelte'
  import ClientIcon24 from '$lib/assets/ClientIcon24.svelte'
  import Center24Icon from '$lib/assets/Center24Icon.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import { CENTER_EDIT_RULE } from '$lib/features/center/permissions'
  import { goto } from '$app/navigation'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { getMemberList } from '$lib/hooks/actions/member.action'
  import { getClientList } from '$lib/hooks/actions/client.action'
  import type { MemberListResponse } from '$lib/hooks/actions/member.action'
  import type { ClientListResponse } from '$lib/hooks/actions/client.action'
  import type { CenterDetailResponse } from '$lib/hooks/actions/center.action'
  import {
    formatOpenDate,
    buildMemberCountInput,
    buildClientCountInput
  } from '$lib/features/center/info'

  interface Props {
    center: CenterDetailResponse
    onEdit?: () => void
  }

  let { center, onEdit }: Props = $props()

  // ── 운영 현황 통계 (카드 자체 쿼리) ──
  const memberCountQuery = $derived(
    queryBuilder(getMemberList, () => buildMemberCountInput($centerId!), {
      enabled: !!$centerId
    })
  )
  const clientCountQuery = $derived(
    queryBuilder(getClientList, () => buildClientCountInput($centerId!), {
      enabled: !!$centerId
    })
  )

  const memberCount = $derived(
    (memberCountQuery.data as MemberListResponse | undefined)?.total ?? null
  )
  const clientCount = $derived(
    (clientCountQuery.data as ClientListResponse | undefined)?.total ?? null
  )

  const stats = $derived([
    {
      label: '구성원',
      value: memberCount,
      unit: '명',
      icon: GroupIcon,
      href: '/member'
    },
    {
      label: '내담자',
      value: clientCount,
      unit: '명',
      icon: ClientIcon24,
      href: '/clients'
    }
  ])

  const openDate = $derived(formatOpenDate(center.created_at))

  // 기본 정보 행 (빈값은 회색 처리)
  const fullAddress = $derived.by(() => {
    const a = center.address?.address
    if (!a) return ''
    const detail = center.address?.detail
    return detail ? `${a} ${detail}` : a
  })
  const infoRows = $derived([
    {
      label: '대표자명',
      value: center.representative_name || '',
      empty: !center.representative_name
    },
    {
      label: '사업자번호',
      value: center.business_registration_number || '',
      empty: !center.business_registration_number
    },
    { label: '주소', value: fullAddress, empty: !fullAddress },
    { label: '전화번호', value: center.phone || '', empty: !center.phone }
  ])

  // 센터 코드 복사 (클릭 시점 = 클라이언트 전용)
  const copyCode = async () => {
    if (!center.code) return
    try {
      await navigator.clipboard.writeText(center.code)
      snackbarStore.success('센터 코드를 복사했어요')
    } catch {
      snackbarStore.error('복사에 실패했어요')
    }
  }
</script>

<section
  class="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_2px_6px_rgba(204,204,204,0.15)]"
>
  <!-- 헤더: 로고 + 수정 / 센터명 + 코드 + 개설일 (고정) -->
  <div class="shrink-0">
    <div class="flex items-start justify-between">
      <div class="flex-center h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
        {#if center.logo_url}
          <img
            src={center.logo_url}
            alt="센터 로고"
            class="h-full w-full rounded-lg object-cover"
          />
        {:else}
          <CameraIcon />
        {/if}
      </div>
      {#if onEdit}
        <PermissionGuard rule={CENTER_EDIT_RULE}>
          <button
            onclick={onEdit}
            aria-label="수정"
            class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
          >
            <EditIcon class="h-full w-auto" />
            <span class="text-body-02-normal-medium">수정</span>
          </button>
        </PermissionGuard>
      {/if}
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <Typography variant="headline-02-normal-semibold" color="text-gray-900">
        {center.name}
      </Typography>
      {#if center.code}
        <Tooltip text="센터 코드 복사">
          <button
            onclick={copyCode}
            class="rounded-[4px] border border-gray-200 px-2 py-1.5 text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="센터 코드 복사"
          >
            <Typography variant="label-01-normal-medium" color="text-gray-600">
              #{center.code}
            </Typography>
          </button>
        </Tooltip>
      {/if}
    </div>
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-500"
      className="mt-2 block"
    >
      {openDate} 개설
    </Typography>
  </div>

  <!-- 본문 (스크롤) -->
  <ScrollFadeArea class="-mx-6 mt-6 px-6" bounceArrow deps={[center, stats]}>
    <!-- 데이터 (기본 정보 + 센터 소개) -->
    <div class="border-t border-gray-100 pt-6">
      <dl
        class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
      >
        {#each infoRows as row (row.label)}
          <Typography variant="body-01-normal-regular" color="text-gray-600">
            {row.label}
          </Typography>
          <Typography
            variant="body-01-normal-regular"
            color={row.empty ? 'text-gray-400' : 'text-gray-900'}
          >
            {row.empty ? emptyValueLabel(row.label) : row.value}
          </Typography>
        {/each}
      </dl>
    </div>
  </ScrollFadeArea>

  <!-- 하단 고정 — 운영 현황·공간 관리는 기본 정보와 달리 스크롤되지 않는다.
       카드 아래 여백이 비는 대신 이 블록이 밑선을 잡아 준다. -->
  <div class="shrink-0">
    <!-- 운영 현황 (구성원 활동 지표와 동일 규격) -->
    <div class="mt-8">
      <div class="grid grid-cols-2 gap-2">
        {#each stats as stat (stat.label)}
          {@const Icon = stat.icon}
          <button
            type="button"
            onclick={() => goto(stat.href)}
            class="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
          >
            <span class="shrink-0 [&>svg]:h-7 [&>svg]:w-7">
              <Icon />
            </span>
            <div class="min-w-0 flex-1">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="block truncate-safe"
              >
                {stat.label}
              </Typography>
              <div class="mt-3 flex items-baseline gap-1">
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-gray-900"
                >
                  {stat.value ?? '-'}
                </Typography>
                {#if stat.value !== null}
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-700"
                  >
                    {stat.unit}
                  </Typography>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- 공간 관리 진입점 — 상담실은 지표가 아니라 '관리하는 대상'이라
       숫자 타일이 아닌 이동 버튼으로 둔다 -->
    <div class="mt-6">
      <button
        type="button"
        onclick={() => goto('/center/room')}
        class="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 transition-colors hover:bg-gray-50"
      >
        <span class="flex items-center gap-2">
          <span class="flex shrink-0 [&>svg]:h-5 [&>svg]:w-5">
            <Center24Icon />
          </span>
          <Typography variant="body-01-normal-medium" color="text-gray-700">
            공간 관리
          </Typography>
        </span>
        <span class="flex shrink-0 -rotate-90 text-gray-400">
          <ArrowDownIcon20 color="currentColor" />
        </span>
      </button>
    </div>
  </div>
</section>
