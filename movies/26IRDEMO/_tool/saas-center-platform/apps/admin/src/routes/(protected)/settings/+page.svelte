<script lang="ts">
  import Typography from '$lib/components/Typography.svelte'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import Button from '$lib/components/Button.svelte'
  import Input from '$lib/components/Input.svelte'
  import Select from '$lib/components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { modalStore } from '$stores/modal'
  import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
  import {
    getPlatformSettings,
    patchPlatformSettings,
    getPlanConfigs,
    patchPlanConfig,
    type PlatformSettingsResponse,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'
  import PlanConfigEditModal from '$components/modal/PlanConfigEditModal.svelte'
  import { fade } from 'svelte/transition'

  const queryClient = useQueryClient()

  // ─── 데이터 조회 ───
  const settingsQuery = $derived(queryBuilder(getPlatformSettings, () => ({})))
  const plansQuery = $derived(queryBuilder(getPlanConfigs, () => ({})))

  const settings = $derived<PlatformSettingsResponse | null>(settingsQuery.data ?? null)
  const plans = $derived<PlanConfigItem[]>(plansQuery.data?.items ?? [])

  // ─── 시스템 설정 편집 상태 ───
  let editMode = $state(false)
  let trialDurationDaysStr = $state('365')
  let trialPlan = $state('pro')
  let creditCycleDaysStr = $state('30')
  let quotaGraceDaysStr = $state('7')
  let isSaving = $state(false)

  const trialPlanSelectOptions: SelectOptionType[] = $derived(
    plans.length > 0
      ? plans.map(p => ({ value: p.plan_type, title: p.label }))
      : [{ value: 'pro', title: 'Pro' }]
  )

  function startEdit() {
    if (!settings) return
    trialDurationDaysStr = String(settings.trial_duration_days)
    trialPlan = settings.trial_plan
    creditCycleDaysStr = String(settings.credit_cycle_days)
    quotaGraceDaysStr = String(settings.quota_grace_days)
    editMode = true
  }

  function cancelEdit() {
    editMode = false
  }

  async function saveSettings() {
    isSaving = true
    try {
      await patchPlatformSettings().request({
        trial_duration_days: Number(trialDurationDaysStr) || 365,
        trial_plan: trialPlan,
        credit_cycle_days: Number(creditCycleDaysStr) || 30,
        quota_grace_days: Number(quotaGraceDaysStr) || 7,
      })
      showSuccessSnackbar('설정이 저장되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['getPlatformSettings'], exact: false })
      editMode = false
    } catch (e: any) {
      showErrorSnackbar(e)
    } finally {
      isSaving = false
    }
  }

  // ─── 플랜 수정 ───
  async function editPlan(plan: PlanConfigItem) {
    const result = await modalStore.openWithPromise(PlanConfigEditModal, { plan, allPlans: plans }, { size: 'wide' })
    if (!result) return
    try {
      const updates = JSON.parse(result as string)
      await patchPlanConfig().request({ planType: plan.plan_type, ...updates })
      showSuccessSnackbar(`${plan.label} 플랜이 수정되었습니다.`)
      queryClient.invalidateQueries({ queryKey: ['getPlanConfigs'], exact: false })
    } catch (e: any) {
      showErrorSnackbar(e)
    }
  }

  // ─── UI 헬퍼 ───
  const planLabelMap = $derived(
    Object.fromEntries(plans.map(p => [p.plan_type, p.label])) as Record<string, string>
  )

  // 전체 플랜의 feature_labels를 통합하여 기능 배지 라벨 생성 (폴백 포함)
  const featureLabelMap = $derived.by(() => {
    const fallback: Record<string, string> = {
      ai_field_note: 'AI 필드노트',
      ai_agent: 'AI 에이전트',
      ai_case_analysis: '종단 분석',
      billing: '통합 청구',
      api_access: 'API 연동',
    }
    for (const p of plans) {
      if (p.feature_labels) Object.assign(fallback, p.feature_labels)
    }
    return fallback
  })

  function formatPrice(price: number): string {
    if (price === 0) return '-'
    return price.toLocaleString() + '원'
  }
</script>

<div in:fade class="p-6">
  <PageHeader title="플랫폼 설정" description="플랜, 무료 이용 기간, 크레딧 주기 등 시스템 전반 설정을 관리합니다" />

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- 시스템 설정 -->
    <div class="section-border p-6">
      <div class="flex items-center justify-between mb-5">
        <Typography variant="title-01-normal-semibold" tag="h2">시스템 설정</Typography>
        {#if !editMode}
          <Button color="stroke-secondary" size="sm" content="수정" onclick={startEdit} />
        {/if}
      </div>

      {#if !settings}
        <div class="flex items-center justify-center py-8">
          <Typography variant="body-01-reading-regular" color="text-gray-400">불러오는 중...</Typography>
        </div>
      {:else if editMode}
        <div class="space-y-4">
          <Input label="무료 이용 기본 기간 (일)" type="number" bind:value={trialDurationDaysStr} min="1" max="3650" />
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">무료 부여 플랜</label>
            <Select
              options={trialPlanSelectOptions}
              selected={trialPlan}
              on:change={(e) => { trialPlan = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail) }}
              class="h-[42px] rounded-lg"
            />
          </div>
          <Input label="크레딧 갱신 주기 (일)" type="number" bind:value={creditCycleDaysStr} min="1" max="365" />
          <Input label="쿼터 초과 유예 기간 (일)" type="number" bind:value={quotaGraceDaysStr} min="1" max="90" />
          <div class="flex justify-end gap-2 pt-2">
            <Button color="stroke-secondary" size="sm" content="취소" onclick={cancelEdit} disabled={isSaving} />
            <Button color="primary" size="sm" content="저장" onclick={saveSettings} disabled={isSaving} />
          </div>
        </div>
      {:else}
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">무료 이용 기본 기간</dt>
            <dd class="text-sm font-medium text-gray-800">{settings.trial_duration_days}일</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">무료 부여 플랜</dt>
            <dd class="text-sm font-medium text-gray-800">{planLabelMap[settings.trial_plan] ?? settings.trial_plan}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">크레딧 갱신 주기</dt>
            <dd class="text-sm font-medium text-gray-800">{settings.credit_cycle_days}일</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">쿼터 초과 유예 기간</dt>
            <dd class="text-sm font-medium text-gray-800">{settings.quota_grace_days}일</dd>
          </div>
        </dl>
      {/if}
    </div>

    <!-- 시스템 정보 -->
    <div class="section-border p-6">
      <Typography variant="title-01-normal-semibold" tag="h2" className="mb-5">시스템 정보</Typography>
      <dl class="space-y-3">
        <div class="flex justify-between">
          <dt class="text-sm text-gray-500">시스템명</dt>
          <dd class="text-sm font-medium text-gray-800">상담센터 SaaS</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-sm text-gray-500">버전</dt>
          <dd class="text-sm font-medium text-gray-800">0.0.1</dd>
        </div>
      </dl>
    </div>
  </div>

  <!-- 플랜 설정 -->
  <div class="section-border mt-6 p-6">
    <div class="flex items-center justify-between mb-5">
      <Typography variant="title-01-normal-semibold" tag="h2">플랜 설정</Typography>
    </div>

    {#if plans.length === 0}
      <div class="flex items-center justify-center py-8">
        <Typography variant="body-01-reading-regular" color="text-gray-400">불러오는 중...</Typography>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="py-3 px-3 text-left font-medium text-gray-500">플랜</th>
              <th class="py-3 px-3 text-left font-medium text-gray-500">표시명</th>
              <th class="py-3 px-3 text-right font-medium text-gray-500">월 가격</th>
              <th class="py-3 px-3 text-right font-medium text-gray-500">크레딧</th>
              <th class="py-3 px-3 text-left font-medium text-gray-500">기능</th>
              <th class="py-3 px-3 text-left font-medium text-gray-500">태그라인</th>
              <th class="py-3 px-3 text-center font-medium text-gray-500">순서</th>
              <th class="py-3 px-3 text-center font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {#each plans as plan}
              <tr class="border-b border-gray-50 hover:bg-gray-50/50">
                <td class="py-3 px-3">
                  <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600">
                    {plan.plan_type}
                  </span>
                </td>
                <td class="py-3 px-3 font-medium text-gray-800">{plan.label}</td>
                <td class="py-3 px-3 text-right text-gray-700">{formatPrice(plan.price_monthly)}</td>
                <td class="py-3 px-3 text-right text-gray-700">{plan.credit_limit.toLocaleString()}</td>
                <td class="py-3 px-3">
                  <div class="flex flex-wrap gap-1">
                    {#each plan.features as feature}
                      <span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600">
                        {featureLabelMap[feature] ?? feature}
                      </span>
                    {/each}
                    {#if plan.features.length === 0}
                      <span class="text-xs text-gray-400">-</span>
                    {/if}
                  </div>
                </td>
                <td class="py-3 px-3 text-gray-500 max-w-[160px] truncate">
                  {#if plan.tagline}
                    <span class="text-xs">{plan.tagline}</span>
                  {:else}
                    <span class="text-xs text-gray-300">-</span>
                  {/if}
                  {#if plan.is_recommended}
                    <span class="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">추천</span>
                  {/if}
                </td>
                <td class="py-3 px-3 text-center text-gray-600">{plan.plan_order}</td>
                <td class="py-3 px-3 text-center">
                  <button
                    type="button"
                    class="text-xs text-primary-500 hover:text-primary-600 font-medium"
                    onclick={() => editPlan(plan)}
                  >
                    수정
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
