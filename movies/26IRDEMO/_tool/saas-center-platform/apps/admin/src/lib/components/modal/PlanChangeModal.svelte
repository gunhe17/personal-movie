<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import type { PlanConfigItem } from '$hooks/actions/platform-settings.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    currentPlan: string
    plans?: PlanConfigItem[]
    onConfirm?: (plan: string, reason: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    currentPlan,
    plans = [],
    onConfirm = () => {}
  }: Props = $props()

  /** API plans → 모달 선택지 (plan_order ASC, 비활성 제외) */
  const PLANS = $derived(
    plans.length > 0
      ? plans
          .filter(p => p.is_active)
          .sort((a, b) => a.plan_order - b.plan_order)
          .map(p => ({
            value: p.plan_type,
            label: p.label,
            price: p.price_monthly === 0 ? '무료' : `월 ${p.price_monthly.toLocaleString()}원`,
            desc: p.tagline || p.audience || '',
          }))
      : [
          { value: 'free', label: 'Free', price: '무료', desc: '기본 기능만 제공' },
          { value: 'starter', label: 'Starter', price: '월 29,000원', desc: 'AI 필드노트 포함' },
          { value: 'pro', label: 'Pro', price: '월 59,000원', desc: 'AI 에이전트 + 종단 분석' },
        ]
  )

  let selectedPlan = $state('')
  let reason = $state('')

  const isValid = $derived(selectedPlan && selectedPlan !== currentPlan)

  function handleConfirm() {
    if (!isValid) return
    onConfirm(selectedPlan, reason || '플랜 변경')
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showCloseButton={true}
  headerClass="px-6 py-4"
  bodyClass="px-6 py-4"
  footerClass="px-6 py-4"
>
  {#snippet header()}
    <Typography variant="headline-02-semibold" color="text-gray-800">플랜 변경</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">새 플랜 선택</label>
        <div class="grid grid-cols-2 gap-2">
          {#each PLANS as plan}
            <button
              type="button"
              class="rounded-lg border-2 p-3 text-left transition-colors
                {selectedPlan === plan.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                {plan.value === currentPlan ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
              disabled={plan.value === currentPlan}
              onclick={() => (selectedPlan = plan.value)}
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">{plan.label}</span>
                {#if plan.value === currentPlan}
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">현재</span>
                {/if}
              </div>
              <p class="mt-0.5 text-xs text-gray-500">{plan.price} · {plan.desc}</p>
            </button>
          {/each}
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5" for="reason">변경 사유</label>
        <input
          id="reason"
          type="text"
          placeholder="변경 사유를 입력하세요 (선택)"
          bind:value={reason}
          class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {#if selectedPlan && PLANS.findIndex(p => p.value === selectedPlan) < PLANS.findIndex(p => p.value === currentPlan)}
        <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p class="text-sm text-amber-700">
            다운그레이드 시 사용량이 새 플랜 한도를 초과하면 7일 유예 후 AI 기능이 제한됩니다.
          </p>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex items-center justify-center h-11 rounded-lg border border-gray-200 px-6 hover:border-gray-300 transition-colors"
    >
      <Typography variant="title-01-semibold" color="text-gray-600">취소</Typography>
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!isValid}
      class="flex items-center justify-center h-11 rounded-lg px-6 transition-colors
        {isValid ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
    >
      <Typography variant="title-01-semibold" color={isValid ? 'text-white' : 'text-gray-400'}>변경</Typography>
    </button>
  {/snippet}
</BaseModal>
