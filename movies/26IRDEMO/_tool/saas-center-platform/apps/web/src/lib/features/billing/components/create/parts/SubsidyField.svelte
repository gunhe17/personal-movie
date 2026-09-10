<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  let {
    value = $bindable(0),
    placeholder = '0',
    error = null,
    warning = null
  } = $props<{
    /** 청구서 단위 바우처 지원금 (원) */
    value?: number
    placeholder?: string
    /** 차단 경고 (입력 박스 테두리도 빨강) */
    error?: string | null
    /** 비차단 안내 (노란색) */
    warning?: string | null
  }>()

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    const raw = target.value.replace(/[^0-9]/g, '')
    value = raw ? parseInt(raw, 10) : 0
  }
</script>

<div>
  <span class="field-label mb-2">
    바우처 지원금
    <span class="text-body-03-normal-regular text-body-subtle">(선택)</span>
  </span>
  <div
    class="flex h-12 items-center gap-2 rounded-lg border bg-white px-3 transition-colors focus-within:border-border-active {error
      ? 'border-status-danger'
      : 'border-input-border'}"
  >
    <input
      type="text"
      value={value > 0 ? value.toLocaleString() : ''}
      oninput={handleInput}
      {placeholder}
      class="h-full flex-1 bg-transparent text-right text-body-01-normal-regular text-body-default placeholder:text-placeholder focus:outline-none"
    />
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      tag="span">원</Typography
    >
  </div>
  {#if error}
    <p class="mt-2 text-body-03-reading-regular text-status-danger">{error}</p>
  {:else if warning}
    <p class="mt-2 text-body-03-reading-regular text-status-warning">
      {warning}
    </p>
  {/if}
</div>
