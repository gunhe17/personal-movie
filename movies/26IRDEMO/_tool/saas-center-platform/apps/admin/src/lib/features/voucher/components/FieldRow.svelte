<script lang="ts">
  // 확정 폼의 단일 필드 행 — 라벨(+필수) · 출처칩(PDF 근거) · 값 편집기(children).
  // 사업 메타 필드와 정규화 record 축이 같은 문법을 쓰게 하는 통일 껍데기.
  import type { Snippet } from 'svelte'

  let {
    label,
    required = false,
    source = null,
    active = false,
    onSource,
    children
  }: {
    label: string
    required?: boolean
    source?: string | null
    active?: boolean
    onSource?: () => void
    children: Snippet
  } = $props()
</script>

<!-- 하위 입력에 포커스가 들어오면(focusin 버블) 근거로 이동 — 칩 클릭과 동일 -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div onfocusin={() => onSource?.()}>
  <div class="mb-1.5 flex items-center justify-between gap-2">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="text-[17px] font-semibold text-gray-900">
      {label}{#if required}<span class="text-negative"> *</span>{/if}
    </label>
    {#if source}
      <button
        type="button"
        onclick={() => onSource?.()}
        class="shrink-0 rounded px-2 py-1 font-mono text-xs font-medium hover:bg-primary-100 {active
          ? 'bg-primary-100 text-primary-700'
          : 'bg-primary-50 text-primary-600'}"
      >
        출처 {source} →
      </button>
    {/if}
  </div>
  {@render children()}
</div>
