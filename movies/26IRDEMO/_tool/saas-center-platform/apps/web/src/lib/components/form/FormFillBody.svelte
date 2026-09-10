<script lang="ts">
  import {
    normalizedOptions,
    orderedFieldKeys
  } from '$lib/features/form/template/schema-utils'

  // 서식 작성 본문 — 원본 PNG 위 오버레이 + 목록 폴백. 모달과 게스트 링크가 공유한다.
  // 배경 이미지 URL 은 소비자가 주입한다(모달=프록시, 게스트 링크=토큰 프록시).
  interface Props {
    schema: { pages?: any[]; fields?: Record<string, any>; elements?: any[] }
    answers: Record<string, string | string[]>
    pageImageUrl: (no: number) => string
  }

  let { schema, answers = $bindable(), pageImageUrl }: Props = $props()

  const pages = $derived(schema?.pages ?? [])
  const elements = $derived(schema?.elements ?? [])
  const fields = $derived(schema?.fields ?? {})
  const fieldOrder = $derived(schema ? orderedFieldKeys(schema as any) : [])
  const canOverlay = $derived(
    pages.length > 0 && !!pages[0]?.image && elements.length > 0
  )
  const elementsOf = (no: number) =>
    elements.filter((e: any) => (e.page ?? 1) === no && Array.isArray(e.rect))

  let overlay = $state(true)
  let zoom = $state(1)
  const setZoom = (z: number) => (zoom = Math.min(4, Math.max(0.5, z)))
  function onWheel(e: WheelEvent) {
    if (!(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }

  function toggleCheckbox(fieldId: string, option: string) {
    const current = (answers[fieldId] as string[]) || []
    answers[fieldId] = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option]
  }
</script>

{#if canOverlay}
  <div class="mb-3 flex items-center gap-1 text-xs text-gray-500">
    {#if overlay}
      <button
        type="button"
        aria-label="축소"
        onclick={() => setZoom(zoom / 1.25)}
        class="h-6 w-6 rounded border border-gray-200 transition-colors hover:border-primary-300 hover:text-primary-600"
        >−</button
      >
      <span class="w-11 text-center font-mono text-[11px] tabular-nums"
        >{Math.round(zoom * 100)}%</span
      >
      <button
        type="button"
        aria-label="확대"
        onclick={() => setZoom(zoom * 1.25)}
        class="h-6 w-6 rounded border border-gray-200 transition-colors hover:border-primary-300 hover:text-primary-600"
        >+</button
      >
      <button
        type="button"
        onclick={() => setZoom(1)}
        class="ml-1 rounded border border-gray-200 px-1.5 py-0.5 transition-colors hover:border-primary-300 hover:text-primary-600"
        >폭 맞춤</button
      >
      <span class="ml-2 text-gray-400">{pages.length}쪽</span>
    {/if}
    <button
      type="button"
      onclick={() => (overlay = !overlay)}
      class="ml-auto rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
    >
      {overlay ? '목록으로 보기' : '원본 위에 보기'}
    </button>
  </div>
{/if}

{#if canOverlay && overlay}
  <div
    class="max-h-[72vh] space-y-4 overflow-auto rounded-lg bg-gray-50 p-3"
    onwheel={onWheel}
  >
    {#each pages as pg (pg.no)}
      <div style="width:{zoom * 100}%">
        <p class="mb-1 text-body-03-normal-regular text-gray-400">{pg.no}쪽</p>
        <div
          class="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          <img
            src={pageImageUrl(pg.no)}
            alt="서식 {pg.no}쪽"
            class="block w-full select-none"
            draggable="false"
          />
          {#each elementsOf(pg.no) as el (el.id)}
            {@const fid = (el.field_refs ?? [])[0]}
            {@const field = fid ? fields[fid] : null}
            <div
              class="absolute"
              style="left:{el.rect[0] * 100}%; top:{el.rect[1] *
                100}%; width:{el.rect[2] * 100}%; height:{el.rect[3] * 100}%"
              title={field?.label ?? fid ?? ''}
            >
              {#if !field}
                <div class="h-full w-full rounded-[2px] bg-gray-200/30"></div>
              {:else if field.type === 'checkbox_group' || field.type === 'radio'}
                <button
                  type="button"
                  aria-label={field.label ?? fid}
                  onclick={() =>
                    field.type === 'radio'
                      ? (answers[fid] = el.option ?? field.label ?? 'on')
                      : toggleCheckbox(fid, el.option ?? field.label ?? 'on')}
                  class="flex h-full w-full items-center justify-center rounded-[2px] border-2 transition-colors {(
                    Array.isArray(answers[fid])
                      ? (answers[fid] as string[]).includes(
                          el.option ?? field.label ?? 'on'
                        )
                      : answers[fid] === (el.option ?? field.label ?? 'on')
                  )
                    ? 'border-primary-500 bg-primary-500/25 text-primary-700'
                    : 'border-primary-300/70 bg-primary-50/40 hover:bg-primary-100/60'}"
                >
                  {(
                    Array.isArray(answers[fid])
                      ? (answers[fid] as string[]).includes(
                          el.option ?? field.label ?? 'on'
                        )
                      : answers[fid] === (el.option ?? field.label ?? 'on')
                  )
                    ? '✓'
                    : ''}
                </button>
              {:else if field.type === 'textarea'}
                <textarea
                  value={(answers[fid] as string) ?? ''}
                  oninput={(e) => (answers[fid] = e.currentTarget.value)}
                  placeholder={field.label ?? ''}
                  class="h-full w-full resize-none rounded-[2px] border-2 border-primary-300/70 bg-primary-50/40 p-1 text-xs leading-tight outline-none focus:border-primary-500 focus:bg-white"
                ></textarea>
              {:else}
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={(answers[fid] as string) ?? ''}
                  oninput={(e) => (answers[fid] = e.currentTarget.value)}
                  placeholder={field.label ?? ''}
                  class="h-full w-full rounded-[2px] border-2 border-primary-300/70 bg-primary-50/40 px-1 text-xs outline-none focus:border-primary-500 focus:bg-white"
                />
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div>
    {#each fieldOrder as fieldId (fieldId)}
      {@const field = fields[fieldId]}
      {#if field}
        <div
          class={field.label
            ? 'mt-5 first:mt-0 space-y-1.5'
            : 'mt-1.5 space-y-1.5'}
        >
          {#if field.label}
            <p class="text-sm text-gray-900">
              {field.label}{#if field.required}<span class="field-required"
                  >*</span
                >{/if}
            </p>
          {/if}
          {#if field.type === 'text'}
            <input
              type="text"
              value={answers[fieldId] ?? ''}
              oninput={(e) => (answers[fieldId] = e.currentTarget.value)}
              class="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-border-active transition-colors"
            />
          {:else if field.type === 'textarea'}
            <textarea
              value={answers[fieldId] ?? ''}
              oninput={(e) => (answers[fieldId] = e.currentTarget.value)}
              rows={3}
              class="w-full rounded-lg border border-gray-200 text-body-03-reading-regular resize-none outline-none focus:border-border-active transition-colors px-3 py-3.5"
            ></textarea>
          {:else if field.type === 'radio' && field.options}
            <div class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm pt-0.5">
              {#each normalizedOptions(field) as opt (opt.value)}
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={fieldId}
                    value={opt.value}
                    checked={answers[fieldId] === opt.value}
                    onchange={() => (answers[fieldId] = opt.value)}
                    class="w-3.5 h-3.5 accent-primary-500"
                  />
                  <span class="text-body-01-normal-medium text-body-default"
                    >{opt.label}</span
                  >
                </label>
              {/each}
            </div>
          {:else if field.type === 'checkbox_group' && field.options}
            <div class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm pt-0.5">
              {#each normalizedOptions(field) as opt (opt.value)}
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={((answers[fieldId] as string[]) || []).includes(
                      opt.value
                    )}
                    onchange={() => toggleCheckbox(fieldId, opt.value)}
                    class="w-3.5 h-3.5 accent-primary-500"
                  />
                  <span class="text-body-01-normal-medium text-body-default"
                    >{opt.label}</span
                  >
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
