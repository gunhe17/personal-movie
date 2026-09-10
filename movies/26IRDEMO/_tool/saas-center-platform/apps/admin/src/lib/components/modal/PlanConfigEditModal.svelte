<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Input from '$components/Input.svelte'
  import Textarea from '$components/Textarea.svelte'
  import Switch from '$components/Switch.svelte'
  import Select from '$components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import type { PlanConfigItem } from '$hooks/actions/platform-settings.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    plan: PlanConfigItem
    allPlans?: PlanConfigItem[]
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    plan,
    allPlans = [],
    _modalResolve = () => {},
    _modalReject = () => {},
  }: Props = $props()

  // ── 기본 설정 ──
  let label = $state(plan.label)
  let priceMonthlyStr = $state(String(plan.price_monthly))
  let creditLimitStr = $state(String(plan.credit_limit))
  let planOrderStr = $state(String(plan.plan_order))
  const priceMonthly = $derived(Number(priceMonthlyStr) || 0)
  const creditLimit = $derived(Number(creditLimitStr) || 0)
  const planOrder = $derived(Number(planOrderStr) || 0)

  // ── 센터 화면 표시 정보 ──
  let tagline = $state(plan.tagline ?? '')
  let audience = $state(plan.audience ?? '')
  let isRecommended = $state(plan.is_recommended ?? false)
  let baseFeaturesText = $state((plan.base_features ?? []).join('\n'))
  let additionsText = $state((plan.additions ?? []).join('\n'))
  let basePlan = $state(plan.base_plan ?? '')

  // ── 뱃지 색상 (프리셋 기반) ──
  const BADGE_PRESETS = [
    { name: '회색', bg: 'bg-gray-100', text: 'text-gray-600', preview: 'bg-gray-200' },
    { name: '파랑', bg: 'bg-blue-50', text: 'text-blue-600', preview: 'bg-blue-200' },
    { name: '보라', bg: 'bg-violet-50', text: 'text-violet-600', preview: 'bg-violet-200' },
    { name: '남색', bg: 'bg-indigo-50', text: 'text-indigo-600', preview: 'bg-indigo-200' },
    { name: '초록', bg: 'bg-emerald-50', text: 'text-emerald-600', preview: 'bg-emerald-200' },
    { name: '노랑', bg: 'bg-amber-50', text: 'text-amber-600', preview: 'bg-amber-200' },
    { name: '빨강', bg: 'bg-red-50', text: 'text-red-600', preview: 'bg-red-200' },
  ] as const

  // 현재 뱃지에 매칭되는 프리셋 인덱스 찾기
  function findPresetIndex(): number {
    const idx = BADGE_PRESETS.findIndex(p => p.bg === plan.badge_bg && p.text === plan.badge_text)
    return idx >= 0 ? idx : 0
  }
  let selectedBadgeIdx = $state(findPresetIndex())
  let badgeBg = $derived(BADGE_PRESETS[selectedBadgeIdx].bg)
  let badgeText = $derived(BADGE_PRESETS[selectedBadgeIdx].text)

  // ── AI 기능 토글 ──
  // 전체 플랜에서 사용 중인 기능 키를 수집하여 동적 목록 생성
  const allFeatureKeys = $derived.by(() => {
    const keys = new Set<string>()
    for (const p of allPlans) {
      for (const f of (p.features ?? [])) keys.add(f)
    }
    // 현재 플랜의 기능도 포함
    for (const f of (plan.features ?? [])) keys.add(f)
    return [...keys].sort()
  })

  // 기능 라벨/설명 폴백 — 전체 플랜의 feature_labels/descriptions를 통합
  const mergedLabels = $derived.by(() => {
    const result: Record<string, string> = {
      ai_field_note: 'AI 상담일지',
      ai_agent: 'AI 업무 도우미',
      ai_case_analysis: '내담자 변화 분석',
      billing: '통합 청구',
      api_access: '외부 연동',
    }
    for (const p of allPlans) {
      if (p.feature_labels) Object.assign(result, p.feature_labels)
    }
    return result
  })
  const mergedDescriptions = $derived.by(() => {
    const result: Record<string, string> = {
      ai_field_note: '상담 녹음을 AI가 듣고 상담일지를 자동으로 작성해 줍니다',
      ai_agent: '말로 지시하면 일정 잡기, 검사 접수, 내담자 찾기를 대신합니다',
      ai_case_analysis: '내담자의 회기별 변화를 자동으로 추적하고 요약합니다',
      billing: '바우처·수납을 한 곳에서 관리합니다',
      api_access: '외부 시스템과 데이터를 주고받을 수 있습니다',
    }
    for (const p of allPlans) {
      if (p.feature_descriptions) Object.assign(result, p.feature_descriptions)
    }
    return result
  })

  let selectedFeatures = $state(new Set(plan.features))

  function toggleFeature(f: string) {
    const next = new Set(selectedFeatures)
    if (next.has(f)) next.delete(f)
    else next.add(f)
    selectedFeatures = next
  }

  // ── 기능별 라벨/설명 (구조화 입력) ──
  const existingLabels = plan.feature_labels ?? {}
  const existingDescs = plan.feature_descriptions ?? {}

  let featureLabels: Record<string, string> = $state(
    Object.fromEntries(allFeatureKeys.map(k => [k, existingLabels[k] ?? mergedLabels[k] ?? '']))
  )
  let featureDescriptions: Record<string, string> = $state(
    Object.fromEntries(allFeatureKeys.map(k => [k, existingDescs[k] ?? mergedDescriptions[k] ?? '']))
  )

  // ── 하위 플랜 옵션 ──
  const basePlanOptions = $derived(
    allPlans
      .filter(p => p.plan_type !== plan.plan_type && p.plan_order < plan.plan_order)
      .sort((a, b) => a.plan_order - b.plan_order)
  )
  const basePlanSelectOptions: SelectOptionType[] = $derived([
    { value: '', title: '없음 (기본 플랜)' },
    ...basePlanOptions.map(bp => ({ value: bp.plan_type, title: bp.label }))
  ])

  // ── 미리보기 파생 데이터 ──
  const previewPriceLabel = $derived(
    priceMonthly === 0 ? '무료' : `₩${priceMonthly.toLocaleString()}`
  )
  const previewPriceSuffix = $derived(priceMonthly > 0 ? '/월' : '')
  const previewCreditLabel = $derived(
    creditLimit > 0 ? creditLimit.toLocaleString() : ''
  )
  const previewHasCredit = $derived(creditLimit > 0)
  const previewCreditHint = $derived.by(() => {
    if (creditLimit <= 0) return ''
    const sessions = Math.floor(creditLimit / 8)
    return `약 ${sessions}건 상담 분석`
  })
  const previewBaseFeatures = $derived(
    baseFeaturesText.split('\n').map(s => s.trim()).filter(Boolean)
  )
  const previewAdditions = $derived(
    additionsText.split('\n').map(s => s.trim()).filter(Boolean)
  )
  const previewBasePlanLabel = $derived.by(() => {
    if (!basePlan) return null
    const bp = allPlans.find(p => p.plan_type === basePlan)
    return bp?.label ?? basePlan
  })

  // ai_* 접두사로 AI 기능 / 운영 기능 자동 분류
  const previewAiFeatures = $derived(
    allFeatureKeys
      .filter(k => k.startsWith('ai_'))
      .map(k => ({
        key: k,
        label: featureLabels[k] || mergedLabels[k] || k,
        included: selectedFeatures.has(k),
      }))
  )
  const previewExtraFeatures = $derived(
    allFeatureKeys
      .filter(k => !k.startsWith('ai_') && selectedFeatures.has(k))
      .map(k => ({
        key: k,
        label: featureLabels[k] || mergedLabels[k] || k,
      }))
  )

  // ── 저장 ──
  const handleConfirm = () => {
    const features = [...selectedFeatures]
    const base_features = baseFeaturesText.split('\n').map(s => s.trim()).filter(Boolean)
    const additions = additionsText.split('\n').map(s => s.trim()).filter(Boolean)

    // 빈 값 제거
    const cleanLabels: Record<string, string> = {}
    const cleanDescs: Record<string, string> = {}
    for (const k of allFeatureKeys) {
      if (featureLabels[k]?.trim()) cleanLabels[k] = featureLabels[k].trim()
      if (featureDescriptions[k]?.trim()) cleanDescs[k] = featureDescriptions[k].trim()
    }

    const result = JSON.stringify({
      label,
      price_monthly: priceMonthly,
      credit_limit: creditLimit,
      plan_order: planOrder,
      features,
      tagline,
      audience,
      is_recommended: isRecommended,
      base_features,
      additions,
      base_plan: basePlan || null,
      badge_bg: badgeBg,
      badge_text: badgeText,
      feature_labels: cleanLabels,
      feature_descriptions: cleanDescs,
    })
    _modalResolve(result)
    closeModal()
  }

  const handleCancel = () => {
    _modalResolve(null)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={true}
  bodyClass="pt-6 pb-3 px-6"
  footerClass="px-6 py-5"
>
  {#snippet header()}
    <div class="px-6 pt-6">
      <Typography variant="headline-02-semibold" color="text-gray-800">
        {plan.plan_type.toUpperCase()} 플랜 설정
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="flex gap-6">
      <!-- 왼쪽: 편집 폼 -->
      <div class="flex-1 min-w-0 space-y-4">
      <!-- 기본 정보 -->
      <Input label="플랜명" bind:value={label} />

      <div class="grid grid-cols-2 gap-4">
        <Input label="월 가격 (원)" type="number" bind:value={priceMonthlyStr} min="0" />
        <Input label="크레딧 한도" type="number" bind:value={creditLimitStr} min="0" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <Input label="플랜 순서" type="number" bind:value={planOrderStr} min="0" />
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">뱃지 색상</label>
          <div class="flex items-center gap-1.5 h-[42px]">
            {#each BADGE_PRESETS as preset, idx}
              <button
                type="button"
                class="h-7 w-7 rounded-full border-2 transition-all {preset.preview} {selectedBadgeIdx === idx ? 'border-primary-500 scale-110 ring-2 ring-primary-200' : 'border-transparent hover:border-gray-300'}"
                title={preset.name}
                onclick={() => selectedBadgeIdx = idx}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <!-- 센터 화면 표시 정보 -->
      <div class="border-t border-gray-100 pt-4 mt-2">
        <span class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">센터 화면 표시 정보</span>

        <div class="space-y-3">
          <Input label="태그라인" bind:value={tagline} placeholder="예: AI로 업무 시간 절약" />
          <Input label="대상 고객" bind:value={audience} placeholder="예: 개인 상담사 · 소규모 센터" />
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">포함하는 하위 플랜</label>
              <Select
                options={basePlanSelectOptions}
                selected={basePlan}
                on:change={(e) => { basePlan = typeof e.detail === 'object' ? String(e.detail.value) : String(e.detail) }}
                class="h-[42px] rounded-lg"
              />
            </div>
            <div class="flex items-end pb-2">
              <div class="flex items-center gap-2.5">
                <Switch bind:checked={isRecommended} />
                <span class="text-sm text-gray-700">추천 플랜으로 표시</span>
              </div>
            </div>
          </div>
          <Textarea label="기본 포함 기능 설명" bind:value={baseFeaturesText} rows={3}
            placeholder="한 줄에 하나씩 입력&#10;예: 내담자·일정·상담 기록 관리" />
          <Textarea label="추가 혜택" bind:value={additionsText} rows={3}
            placeholder="한 줄에 하나씩 입력&#10;예: 상담 녹음을 AI가 자동 요약" />
        </div>
      </div>

      <!-- AI 기능 -->
      <div class="border-t border-gray-100 pt-4 mt-2">
        <span class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">AI 기능 설정</span>

        <div class="space-y-3">
          {#each allFeatureKeys as feature}
            {@const isActive = selectedFeatures.has(feature)}
            <div class="rounded-lg border {isActive ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100 bg-gray-50/50'} px-4 py-3 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2.5">
                  <Switch checked={isActive} onclick={() => toggleFeature(feature)} />
                  <span class="text-sm font-medium {isActive ? 'text-gray-800' : 'text-gray-400'}">
                    {mergedLabels[feature] ?? feature}
                  </span>
                </div>
                {#if isActive}
                  <span class="text-[10px] font-medium text-primary-500 bg-primary-50 rounded-full px-2 py-0.5">활성</span>
                {/if}
              </div>

              {#if isActive}
                <div class="ml-6.5 space-y-2">
                  <div>
                    <label class="block text-xs text-gray-500 mb-0.5">표시 이름</label>
                    <input
                      type="text"
                      bind:value={featureLabels[feature]}
                      placeholder={mergedLabels[feature] ?? feature}
                      class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-0.5">설명 문구</label>
                    <input
                      type="text"
                      bind:value={featureDescriptions[feature]}
                      placeholder={mergedDescriptions[feature] ?? ''}
                      class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      </div>

      <!-- 오른쪽: 미리보기 -->
      <div class="w-[300px] shrink-0 flex flex-col">
        <div class="sticky top-0">
          <span class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">센터 화면 미리보기</span>

          <!-- PlanCard 미리보기 -->
          <div class="rounded-xl border-2 flex flex-col {isRecommended ? 'border-primary-200' : 'border-gray-200'} relative">
            {#if isRecommended}
              <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                <span class="rounded-full bg-primary-500 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">추천</span>
              </div>
            {/if}

            <div class="px-4 py-4 flex flex-col flex-1">
              <!-- 플랜명 + 뱃지 -->
              <div class="flex items-center gap-2 mb-0.5 h-7">
                <h3 class="text-sm font-medium text-gray-900">{label || plan.plan_type}</h3>
                <span class="rounded-full px-2 py-0.5 text-[11px] font-medium {badgeBg} {badgeText}">
                  {label || plan.plan_type}
                </span>
              </div>
              <p class="text-xs text-gray-400 mb-2">{tagline || '태그라인을 입력하세요'}</p>

              <!-- 가격 -->
              <div class="mb-0.5">
                <span class="text-xl font-bold tabular-nums text-gray-900">{previewPriceLabel}</span>
                {#if previewPriceSuffix}
                  <span class="text-xs text-gray-400">{previewPriceSuffix}</span>
                {/if}
              </div>

              <!-- 대상 -->
              <p class="text-xs text-gray-500 mb-3">{audience || '대상 고객을 입력하세요'}</p>

              <!-- 크레딧 정보 -->
              <div class="mb-3 pb-3 border-b border-gray-100">
                {#if previewHasCredit}
                  <p class="text-sm font-medium text-gray-900 mb-0.5">
                    월 <span class="tabular-nums">{previewCreditLabel}</span> 크레딧
                  </p>
                  <p class="text-xs text-gray-500">{previewCreditHint}</p>
                {:else}
                  <p class="text-sm font-medium text-gray-500 mb-0.5">AI 크레딧 미포함</p>
                  <p class="text-xs text-gray-400">유료 플랜부터 제공</p>
                {/if}
              </div>

              <!-- 포함 기능 -->
              <div class="flex-1 space-y-1.5">
                {#if previewAdditions.length > 0}
                  {#if previewBasePlanLabel}
                    <p class="text-[11px] text-gray-400 mb-1">{previewBasePlanLabel}의 모든 기능 +</p>
                  {/if}
                  {#each previewAdditions as addition}
                    <div class="flex items-center gap-1.5">
                      <div class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <svg class="h-2 w-2 text-primary-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      <span class="text-xs text-gray-700">{addition}</span>
                    </div>
                  {/each}
                {:else}
                  {#each previewBaseFeatures as base}
                    <div class="flex items-center gap-1.5">
                      <div class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <svg class="h-2 w-2 text-gray-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      <span class="text-xs text-gray-600">{base}</span>
                    </div>
                  {/each}
                {/if}

                <!-- AI 기능 -->
                {#each previewAiFeatures as feat}
                  <div class="flex items-center gap-1.5">
                    {#if feat.included}
                      <div class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <svg class="h-2 w-2 text-primary-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                    {:else}
                      <div class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <svg class="h-2 w-2 text-gray-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M18 12H6" />
                        </svg>
                      </div>
                    {/if}
                    <span class="text-xs {feat.included ? 'text-gray-700' : 'text-gray-300'}">{feat.label}</span>
                  </div>
                {/each}
                {#each previewExtraFeatures as feat}
                  <div class="flex items-center gap-1.5">
                    <div class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <svg class="h-2 w-2 text-primary-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <span class="text-xs text-gray-700">{feat.label}</span>
                  </div>
                {/each}
              </div>

              <!-- CTA 미리보기 -->
              <div class="pt-3 mt-3 border-t border-gray-100">
                <div class="w-full rounded-lg h-9 flex items-center justify-center text-xs font-medium
                  {isRecommended ? 'bg-primary-500 text-white' : 'bg-gray-500 text-white'}">
                  {label || plan.plan_type}로 변경 요청
                </div>
              </div>
            </div>
          </div>

          <p class="mt-2 text-[11px] text-gray-400 text-center">센터 구독 관리 페이지에 표시되는 모습</p>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleCancel}
        class="flex items-center justify-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="flex items-center justify-center h-11 w-full rounded-lg transition-colors bg-primary-400 hover:bg-primary-300 text-white"
      >
        <Typography variant="title-01-semibold" color="text-white">
          저장
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
