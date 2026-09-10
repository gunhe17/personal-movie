<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getNestedValue,
    formatDate,
    formatGender,
    formatPhone
  } from '../tool-columns'
  import SendButton from './SendButton.svelte'

  interface Props {
    options: unknown[]
    onSelect: (item: unknown) => void
    onCancel?: () => void
  }

  let { options, onSelect, onCancel }: Props = $props()

  let activeIndex = $state(0)
  let listEl: HTMLDivElement | undefined = $state()
  let freeText = $state('')

  onMount(() => {
    listEl?.focus()
  })

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(activeIndex + 1, options.length - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(activeIndex - 1, 0)
        break
      case 'Enter':
        e.preventDefault()
        if (options[activeIndex] != null) {
          onSelect(options[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onCancel?.()
        break
    }
  }

  function handleFreeTextSubmit() {
    const text = freeText.trim()
    if (text) {
      onSelect(text)
      freeText = ''
    }
  }

  function handleFreeTextKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFreeTextSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    }
  }

  /** 선택지 한 줄 요약 — tool-columns 포맷터 사용 */
  /** id 키는 제외하고 사용자 친화적 필드만 표시 */
  const HIDDEN_KEYS = /\bid\b/

  const SUMMARY_KEYS: { key: string; fmt?: (v: unknown) => string }[] = [
    { key: 'name' },
    { key: 'person.name' },
    { key: 'client.name' },
    { key: 'member.name' },
    { key: 'title' },
    { key: 'code' },
    { key: 'client.code' },
    { key: 'birth_date', fmt: formatDate },
    { key: 'client.birth_date', fmt: formatDate },
    { key: 'gender', fmt: formatGender },
    { key: 'phone', fmt: formatPhone }
  ]

  function summarize(item: unknown): string {
    if (item == null) return ''
    if (typeof item === 'string') return item
    if (typeof item !== 'object') return String(item)

    const obj = item as Record<string, unknown>

    // HITL checkpoint 형식 — {label, value}면 label 그대로 표시
    if (typeof obj.label === 'string' && 'value' in obj) {
      return obj.label
    }

    const parts: string[] = []

    for (const { key, fmt } of SUMMARY_KEYS) {
      const raw = getNestedValue(obj, key)
      if (raw == null || raw === '') continue
      parts.push(fmt ? fmt(raw) : String(raw))
      if (parts.length >= 4) break
    }

    if (parts.length > 0) return parts.join(' / ')
    // fallback: id 키 제외하고 값만 나열
    const fallback = Object.entries(obj)
      .filter(([k]) => !HIDDEN_KEYS.test(k))
      .map(([, v]) => String(v))
      .slice(0, 4)
    return fallback.length > 0
      ? fallback.join(' / ')
      : JSON.stringify(obj).slice(0, 80)
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="listbox"
  tabindex="0"
  class="my-1 outline-none"
  bind:this={listEl}
  onkeydown={handleKeydown}
>
  <div class="flex flex-col gap-1">
    {#each options as opt, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        role="option"
        aria-selected={i === activeIndex}
        class="py-3 px-3 cursor-pointer rounded-lg transition-colors {i ===
        activeIndex
          ? 'bg-gray-100'
          : 'hover:bg-gray-50'}"
        onclick={() => onSelect(opt)}
        onmouseenter={() => (activeIndex = i)}
      >
        <span class="text-body-02-normal-regular text-gray-800">
          <span class="font-medium">{i + 1}.</span>
          <span class="ml-1">{summarize(opt)}</span>
        </span>
      </div>
    {/each}
  </div>

  <!-- 직접 입력 + 전송 버튼 — Frame 디자인 -->
  <div class="mt-4 flex items-center gap-3">
    <input
      type="text"
      placeholder="직접 입력"
      class="flex-1 text-body-03-normal-regular text-gray-800 border border-gray-200 rounded-lg px-2.5 py-2.5 outline-none placeholder:text-placeholder focus:border-border-active transition-colors"
      bind:value={freeText}
      onkeydown={handleFreeTextKeydown}
    />
    <SendButton disabled={!freeText.trim()} onClick={handleFreeTextSubmit} />
  </div>
</div>
