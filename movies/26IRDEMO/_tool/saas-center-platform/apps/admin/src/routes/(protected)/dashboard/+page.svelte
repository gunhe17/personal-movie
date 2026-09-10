<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import { auth } from '$lib/stores/auth'
  import { queryBuilder } from '$hooks/queries/builder'
  import { getCenterList } from '$hooks/actions/center.action'
  import { getApplicationList } from '$hooks/actions/application.action'
  import { getInquiryList } from '$hooks/actions/inquiry.action'
  import { getCSMemoList } from '$hooks/actions/cs-memo.action'
  import { getAuditLogList } from '$hooks/actions/audit-log.action'
  import { getAdminAccountList } from '$hooks/actions/admin-account.action'
  import { getSubscriptionStats } from '$hooks/actions/subscription.action'
  import { formatDate } from '$lib/utils/format'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { createDashboardService } from '$lib/features/dashboard/dashboard-service'
  import StatCard from './components/StatCard.svelte'
  import DashboardWidget from './components/DashboardWidget.svelte'

  const user = $derived($auth.user)
  const queryClient = useQueryClient()
  const service = createDashboardService({ queryClient })

  // ── 숫자 카드 쿼리 ──
  const totalCentersQuery = $derived(
    queryBuilder(getCenterList, () => ({ size: 1 }))
  )
  const activeCentersQuery = $derived(
    queryBuilder(getCenterList, () => ({ is_active: true, size: 1 }))
  )
  const pendingAppsQuery = $derived(
    queryBuilder(getApplicationList, () => ({ status: 'pending', size: 1 }))
  )
  const pendingInquiriesQuery = $derived(
    queryBuilder(getInquiryList, () => ({ status: 'pending', size: 1 }))
  )
  const todayStr = new Date().toISOString().slice(0, 10)
  const csMemosQuery = $derived(
    queryBuilder(getCSMemoList, () => ({
      date_from: todayStr,
      date_to: todayStr,
      sort_order: 'desc',
      size: 100
    }))
  )
  const adminAccountsQuery = $derived(
    queryBuilder(getAdminAccountList, () => ({ size: 1 }))
  )
  const subscriptionStatsQuery = $derived(
    queryBuilder(getSubscriptionStats)
  )

  // ── 위젯 쿼리 ──
  const recentAppsQuery = $derived(
    queryBuilder(getApplicationList, () => ({ status: 'pending', size: 5 }))
  )
  const recentInquiriesQuery = $derived(
    queryBuilder(getInquiryList, () => ({ status: 'pending', size: 5 }))
  )
  const recentAuditLogsQuery = $derived(
    queryBuilder(getAuditLogList, () => ({ size: 5 }))
  )

  // ── 오늘 CS 메모 (백엔드에서 날짜 필터링됨) ──
  const todayMemos = $derived(csMemosQuery.data?.items ?? [])

  const INQUIRY_TYPE_LABELS: Record<string, string> = {
    general: '일반',
    technical: '기술',
    feature_request: '기능요청',
    other: '기타'
  }

  const MEMO_TYPE_LABELS: Record<string, string> = {
    inquiry: '문의',
    complaint: '불만',
    request: '요청',
    other: '기타'
  }
</script>

<div in:fade class="flex flex-col p-6 lg:h-screen">
  <PageHeader
    title="대시보드"
    description="안녕하세요, {user?.name || '관리자'}님"
  />

  <!-- 숫자 카드 6개 -->
  <div class="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
    <StatCard
      label="전체 센터"
      value={totalCentersQuery.data?.total}
      isPending={totalCentersQuery.isPending}
      icon="building"
      colorBg="bg-primary-50"
      colorText="text-primary-600"
      href="/center/manage"
    />
    <StatCard
      label="활성 센터"
      value={activeCentersQuery.data?.total}
      isPending={activeCentersQuery.isPending}
      icon="check-circle"
      colorBg="bg-green-50"
      colorText="text-green-600"
      href="/center/manage?status=active"
    />
    <StatCard
      label="대기 중인 신청"
      value={pendingAppsQuery.data?.total}
      isPending={pendingAppsQuery.isPending}
      alert={(pendingAppsQuery.data?.total ?? 0) > 0}
      icon="clock"
      colorBg="bg-amber-50"
      colorText="text-amber-600"
      href="/center/applications?status=pending"
    />
    <StatCard
      label="미답변 문의"
      value={pendingInquiriesQuery.data?.total}
      isPending={pendingInquiriesQuery.isPending}
      alert={(pendingInquiriesQuery.data?.total ?? 0) > 0}
      icon="chat"
      colorBg="bg-red-50"
      colorText="text-red-500"
      href="/inquiries?status=pending"
    />
    <StatCard
      label="오늘 CS 메모"
      value={csMemosQuery.isPending ? undefined : todayMemos.length}
      isPending={csMemosQuery.isPending}
      icon="memo"
      colorBg="bg-blue-50"
      colorText="text-blue-600"
      href="/cs-memos"
    />
    <StatCard
      label="어드민 계정"
      value={adminAccountsQuery.data?.total}
      isPending={adminAccountsQuery.isPending}
      icon="user-shield"
      colorBg="bg-purple-50"
      colorText="text-purple-600"
      href="/account/admins"
    />
  </div>

  <!-- 구독 통계 -->
  {#if subscriptionStatsQuery.data}
    {@const ss = subscriptionStatsQuery.data}
    <div class="mb-5 flex items-center gap-3">
      <a href="/subscription/manage" class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors">
        <span class="text-gray-500">구독</span>
        <span class="font-semibold text-gray-800">{ss.total}개</span>
        <span class="mx-1 text-gray-300">|</span>
        {#each [['free', 'Free', 'text-gray-600'], ['starter', 'Starter', 'text-blue-600'], ['pro', 'Pro', 'text-purple-600'], ['enterprise', 'Ent', 'text-amber-600']] as [key, label, color]}
          {#if (ss.by_plan?.[key] ?? 0) > 0}
            <span class="text-xs {color}">{label} {ss.by_plan[key]}</span>
          {/if}
        {/each}
        {#if ss.quota_exceeded_count > 0}
          <span class="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            초과 {ss.quota_exceeded_count}
          </span>
        {/if}
      </a>
    </div>
  {/if}

  <!-- 위젯 2×2 그리드 — 남은 높이 채우기 -->
  <div
    class="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2 lg:grid-rows-2"
  >
    <!-- 대기 중인 센터 신청 -->
    <DashboardWidget
      title="대기 중인 센터 신청"
      badgeCount={recentAppsQuery.data?.total}
      badgeColor="amber"
      href="/center/applications?status=pending"
      isPending={recentAppsQuery.isPending}
      hasData={!!recentAppsQuery.data?.items?.length}
      emptyMessage="대기 중인 신청이 없습니다"
    >
      {#snippet children()}
        <table class="w-full text-sm">
          <thead class="sticky top-0">
            <tr class="border-b border-gray-50 bg-gray-50/60">
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                센터명
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                신청자
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                신청일
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each recentAppsQuery.data?.items ?? [] as app}
              <tr
                class="cursor-pointer transition-colors hover:bg-gray-50/80"
                onclick={() => service.openApplicationDetail(app)}
              >
                <td class="px-5 py-3 font-medium text-gray-800">
                  {app.center_name}
                </td>
                <td class="px-5 py-3 text-gray-600">{app.applicant_name}</td>
                <td class="px-5 py-3 text-gray-400">
                  {formatDate(app.created_at, 'YYYY-MM-DD HH:mm')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/snippet}
    </DashboardWidget>

    <!-- 미답변 문의 -->
    <DashboardWidget
      title="미답변 문의"
      badgeCount={recentInquiriesQuery.data?.total}
      badgeColor="red"
      href="/inquiries?status=pending"
      isPending={recentInquiriesQuery.isPending}
      hasData={!!recentInquiriesQuery.data?.items?.length}
      emptyMessage="미답변 문의가 없습니다"
    >
      {#snippet children()}
        <table class="w-full text-sm">
          <thead class="sticky top-0">
            <tr class="border-b border-gray-50 bg-gray-50/60">
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                제목
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                센터
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                유형
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                접수일
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each recentInquiriesQuery.data?.items ?? [] as inq}
              <tr
                class="cursor-pointer transition-colors hover:bg-gray-50/80"
                onclick={() => service.openInquiryDetail(inq)}
              >
                <td
                  class="max-w-32 truncate px-5 py-3 font-medium text-gray-800"
                >
                  {inq.subject}
                </td>
                <td class="px-5 py-3 text-gray-600">
                  {inq.center_name ?? '—'}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                  >
                    {INQUIRY_TYPE_LABELS[inq.inquiry_type] ?? inq.inquiry_type}
                  </span>
                </td>
                <td class="px-5 py-3 text-gray-400">
                  {formatDate(inq.created_at, 'YYYY-MM-DD HH:mm')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/snippet}
    </DashboardWidget>

    <!-- 오늘 CS 메모 -->
    <DashboardWidget
      title="오늘 CS 메모"
      badgeCount={todayMemos.length}
      badgeColor="blue"
      href="/cs-memos"
      isPending={csMemosQuery.isPending}
      hasData={todayMemos.length > 0}
      emptyMessage="오늘 작성된 메모가 없습니다"
    >
      {#snippet children()}
        <table class="w-full text-sm">
          <thead class="sticky top-0">
            <tr class="border-b border-gray-50 bg-gray-50/60">
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                제목
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                유형
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                센터
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                작성자
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each todayMemos as memo}
              <tr
                class="cursor-pointer transition-colors hover:bg-gray-50/80"
                onclick={() => service.openMemoDetail(memo)}
              >
                <td
                  class="max-w-32 truncate px-5 py-3 font-medium text-gray-800"
                >
                  {memo.title}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
                  >
                    {MEMO_TYPE_LABELS[memo.memo_type] ?? memo.memo_type}
                  </span>
                </td>
                <td class="px-5 py-3 text-gray-500">
                  {memo.center_name ?? '—'}
                </td>
                <td class="px-5 py-3 text-gray-400">
                  {memo.created_by_name ?? '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/snippet}
    </DashboardWidget>

    <!-- 최근 감사 로그 -->
    <DashboardWidget
      title="최근 감사 로그"
      href="/audit-logs"
      isPending={recentAuditLogsQuery.isPending}
      hasData={!!recentAuditLogsQuery.data?.items?.length}
      emptyMessage="감사 로그가 없습니다"
    >
      {#snippet children()}
        <table class="w-full text-sm">
          <thead class="sticky top-0">
            <tr class="border-b border-gray-50 bg-gray-50/60">
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                내용
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                행위자
              </th>
              <th
                class="px-5 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                시각
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each recentAuditLogsQuery.data?.items ?? [] as log}
              <tr class="transition-colors hover:bg-gray-50/80">
                <td class="max-w-32 truncate px-5 py-3 text-gray-700">
                  {log.summary}
                </td>
                <td class="max-w-32 truncate px-5 py-3 text-gray-500">
                  {log.admin_email}
                </td>
                <td class="px-5 py-3 tabular-nums text-gray-400">
                  {formatDate(log.created_at, 'YYYY-MM-DD HH:mm')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/snippet}
    </DashboardWidget>
  </div>
</div>
