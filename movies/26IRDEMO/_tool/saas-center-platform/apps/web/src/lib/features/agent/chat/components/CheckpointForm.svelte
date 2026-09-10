<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { FormFieldDef } from '../types'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import SendButton from './SendButton.svelte'
  import Select from '$lib/components/Select.svelte'
  import DateSelect from '$lib/components/searchInput/DateSelect.svelte'
  import DateTimeSelect from './DateTimeSelect.svelte'

  interface Props {
    fields: FormFieldDef[]
    title?: string
    onSubmit: (formData: Record<string, unknown>) => void
    onCancel?: () => void
  }

  let { fields, title, onSubmit, onCancel }: Props = $props()

  // 타입별 값 — 최종값은 fieldValue()가 조합 (상담 등록 폼과 동일 컴포넌트)
  let values = $state<Record<string, string>>({}) // text/number/textarea/select/datetime("YYYY-MM-DD HH:MM")
  let dateObjs = $state<Record<string, Date | null>>({}) // date — DateSelect(Date)
  let invalid = $state<Set<string>>(new Set())
  let submitting = $state(false)
  let formEl: HTMLFormElement | undefined = $state()

  $effect(() => {
    const v: Record<string, string> = {},
      d: Record<string, Date | null> = {}
    for (const f of fields) {
      v[f.name] = ''
      d[f.name] = null
    }
    values = v
    dateObjs = d
  })

  onMount(async () => {
    await tick()
    formEl?.querySelector<HTMLElement>('input, textarea, button')?.focus()
  })

  function josa(w: string, a: string, b: string): string {
    const c = w.charCodeAt(w.length - 1)
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? a : b
  }
  const ph = (f: FormFieldDef) =>
    f.type === 'select'
      ? `${f.label}${josa(f.label, '을', '를')} 선택해주세요`
      : `${f.label}${josa(f.label, '을', '를')} 입력해주세요`

  const fmtDate = (d: Date | null): string =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : ''

  function fieldValue(f: FormFieldDef): string {
    if (f.type === 'datetime') return values[f.name] ?? ''
    if (f.type === 'date') return fmtDate(dateObjs[f.name])
    return values[f.name] ?? ''
  }

  function clearInvalid(name: string) {
    if (invalid.has(name)) {
      const n = new Set(invalid)
      n.delete(name)
      invalid = n
    }
  }

  function handleSubmit() {
    if (submitting) return
    const missing = new Set<string>()
    for (const f of fields)
      if (f.required && !fieldValue(f).trim()) missing.add(f.name)
    if (missing.size > 0) {
      invalid = missing
      return
    }
    invalid = new Set()
    submitting = true
    const out: Record<string, string> = {}
    for (const f of fields) out[f.name] = fieldValue(f)
    onSubmit(out)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const nativeCls = (name: string) =>
    `w-full text-body-03-normal-regular text-gray-800 bg-white border rounded-lg px-4 py-2.5 outline-none transition-colors placeholder:text-placeholder ${
      invalid.has(name)
        ? 'border-red-400'
        : 'border-gray-200 focus:border-border-active'
    }`
</script>

<form
  class="w-full"
  bind:this={formEl}
  onsubmit={(e) => {
    e.preventDefault()
    handleSubmit()
  }}
  onkeydown={handleKeydown}
>
  <!-- 헤더: 제목 + 닫기 -->
  <div class="flex items-center justify-between pb-4 border-b border-gray-100">
    <p class="text-body-01-normal-semibold text-gray-800">
      {title ?? '정보를 입력해주세요'}
    </p>
    {#if onCancel}
      <Tooltip text="닫기">
        <button
          type="button"
          onclick={onCancel}
          aria-label="닫기"
          class="shrink-0 h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </Tooltip>
    {/if}
  </div>

  <!-- 필드: 라벨(좌) + 입력(우) -->
  <div class="pt-4 space-y-3">
    {#each fields as field (field.name)}
      <div class="flex items-center gap-4">
        <label
          for={field.name}
          class="shrink-0 w-20 text-label-01-normal-regular text-gray-700"
        >
          {field.label}{#if field.required}<span class="text-status-danger">
              *</span
            >{/if}
        </label>
        <div
          class="flex-1 min-w-0 rounded-lg {invalid.has(field.name)
            ? 'ring-1 ring-red-400'
            : ''}"
        >
          {#if field.type === 'select' && field.choices}
            <Select
              options={field.choices}
              placeholder={ph(field)}
              showActiveHighlight={true}
              selected={values[field.name] || undefined}
              on:change={(e) => {
                values[field.name] = String((e as CustomEvent).detail)
                clearInvalid(field.name)
              }}
            />
          {:else if field.type === 'datetime'}
            <DateTimeSelect
              bind:value={values[field.name]}
              onChange={() => clearInvalid(field.name)}
              className="w-full"
            />
          {:else if field.type === 'date'}
            <DateSelect
              bind:selectedDate={dateObjs[field.name]}
              className="h-11 w-full"
              onChangeDate={() => clearInvalid(field.name)}
            />
          {:else if field.type === 'textarea'}
            <textarea
              id={field.name}
              name={field.name}
              rows="3"
              placeholder={ph(field)}
              bind:value={values[field.name]}
              oninput={() => clearInvalid(field.name)}
              class="{nativeCls(field.name)} resize-none px-3 py-3.5"
            ></textarea>
          {:else}
            <input
              id={field.name}
              name={field.name}
              type={field.type === 'number' ? 'number' : 'text'}
              placeholder={ph(field)}
              bind:value={values[field.name]}
              oninput={() => clearInvalid(field.name)}
              class={nativeCls(field.name)}
            />
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- 전송 (우하단) -->
  <div class="flex justify-end pt-4">
    <SendButton type="submit" disabled={submitting} />
  </div>
</form>
