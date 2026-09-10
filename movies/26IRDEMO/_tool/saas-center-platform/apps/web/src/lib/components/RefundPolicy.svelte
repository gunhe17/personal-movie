<script lang="ts">
  import { slide } from 'svelte/transition'
  import Select from './Select.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  type PolicyType = {
    timing: string
    percent: number
  }

  export let policies: PolicyType[] = []

  const timingOptions: string[] = ['당일', '예약 전날', '2일 전', '3일 전']
  const percentOptions = ['0%', '10%', '20%', '30%', '50%', '100%']

  const addPolicy = () => {
    policies = [...policies, { timing: '', percent: 0 }]
  }

  const removePolicy = (index: number) => {
    policies = policies.filter((_, i) => i !== index)
  }

  let remainTimingsMap: string[]

  $: if (policies) {
    remainTimingsMap = timingOptions.filter(
      (option) => !policies.map((p) => p.timing).includes(option)
    )
  }
</script>

<div class="flex flex-col gap-3">
  {#each policies as policy, index (index)}
    <div
      transition:slide
      class="grid grid-cols-[140px_1fr_max-content_max-content_40px] items-center gap-3"
    >
      <!-- 기준 시점 -->
      <Select
        class="rounded-lg border border-gray-200 text-sm"
        bind:selected={policy.timing}
        options={remainTimingsMap}
      />
      <!-- 설명 -->
      <div class="text-sm text-gray-600 text-right">전체 금액의</div>

      <!-- 퍼센트 -->
      <Select
        placeholder="%"
        class="rounded-lg border border-gray-200 text-sm"
        bind:selected={policy.percent}
        options={percentOptions}
      />
      <div class="text-sm text-gray-600 text-right">환불</div>
      <!-- 환불 텍스트 / 삭제 -->
      <Tooltip text="삭제">
        <button
          class="text-sm text-gray-500 hover:text-status-danger"
          on:click={() => removePolicy(index)}
          aria-label="삭제"
        >
          ✕
        </button>
      </Tooltip>
    </div>
  {/each}
  <!-- 추가 버튼 -->
  <button
    on:click={addPolicy}
    class="
      h-12 rounded-lg border border-dashed
      border-primary-400 text-primary-500 text-body-01-normal-medium
      flex items-center justify-center gap-2
      hover:bg-primary-50 transition
    "
    disabled={policies.length >= timingOptions.length}
  >
    <span
      class="w-5 h-5 flex-center rounded-full bg-primary-100 text-primary-500"
    >
      +
    </span>
    추가
  </button>
</div>
