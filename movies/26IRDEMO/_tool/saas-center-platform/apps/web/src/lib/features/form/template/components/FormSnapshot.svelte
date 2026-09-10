<script lang="ts">
  // 그리드 문서 뷰 전용 스냅샷 — canonical 폼 스키마(fields/elements)를 실제 모양으로
  // 렌더한 뒤 카드 폭으로 축소. (빌더 FieldPreview와 독립. 작은 썸네일이라 가독성보다
  // '문서 실루엣'이 목적. 2D elements 좌표 렌더는 후순위 — 우선 표시 순서대로 나열.)
  import type { FormSchema, FormField } from '$lib/hooks/actions/form.action'
  import { orderedFieldKeys, optionLabels } from '../schema-utils'

  let { schema }: { schema: FormSchema } = $props()

  // 렌더 기준 폭 — 카드 폭으로 scale 축소
  const DESIGN_WIDTH = 480

  let boxW = $state(0)
  const scale = $derived(boxW > 0 ? boxW / DESIGN_WIDTH : 0)

  const fields = $derived<Record<string, FormField>>(schema?.fields ?? {})
  const orderedKeys = $derived(orderedFieldKeys(schema ?? { fields: {} }))

  // 라벨 표시 — 빌더와 동일하게 widget='label' 요소 존재 여부로 결정.
  // 라벨 요소가 하나라도 있으면 그 필드만 표시(=문서 모델),
  // 하나도 없으면(레거시 시드) 전 필드 라벨 표시(하위 호환).
  const labeledKeys = $derived(
    new Set(
      (schema?.elements ?? [])
        .filter((el) => el.widget === 'label')
        .flatMap((el) => el.field_refs ?? [])
    )
  )
  const usesLabelModel = $derived(labeledKeys.size > 0)
  const showLabel = (key: string) => !usesLabelModel || labeledKeys.has(key)

  // 선택지 형태로 그릴 타입
  const CHOICE_TYPES = new Set([
    'radio',
    'checkbox',
    'checkbox_group',
    'consent'
  ])
</script>

<div
  class="relative h-full w-full overflow-hidden bg-white"
  bind:clientWidth={boxW}
>
  <div
    class="absolute left-0 top-0 origin-top-left px-6 py-5"
    style="width: {DESIGN_WIDTH}px; transform: scale({scale});"
  >
    <div class="flex flex-col gap-3.5">
      {#each orderedKeys as key (key)}
        {@const f = fields[key]}
        {#if f}
          <div class="flex flex-col gap-1.5">
            {#if showLabel(key)}
              <span class="text-sm font-medium text-gray-700">
                {f.label}{#if f.required}<span class="text-status-danger">
                    *</span
                  >{/if}
              </span>
            {/if}

            {#if f.type === 'textarea'}
              <div
                class="h-16 rounded-md border border-gray-200 bg-gray-50"
              ></div>
            {:else if CHOICE_TYPES.has(f.type)}
              <div class="flex flex-col gap-2 pt-0.5">
                {#each optionLabels(f) as opt, i (i)}
                  <span class="flex items-center gap-2 text-sm text-gray-500">
                    <span
                      class="h-4 w-4 shrink-0 border border-gray-300 {f.type ===
                      'radio'
                        ? 'rounded-full'
                        : 'rounded'}"
                    ></span>
                    {opt}
                  </span>
                {:else}
                  <span class="flex items-center gap-2 text-sm text-gray-500">
                    <span
                      class="h-4 w-4 shrink-0 rounded border border-gray-300"
                    ></span>
                    동의합니다
                  </span>
                {/each}
              </div>
            {:else if f.type === 'signature'}
              <div
                class="flex h-14 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400"
              >
                서명
              </div>
            {:else if f.type === 'file' || f.type === 'image'}
              <div
                class="flex h-14 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400"
              >
                {f.type === 'image' ? '이미지' : '파일'}
              </div>
            {:else}
              <!-- text·email·phone·number·date·time·datetime·select -->
              <div
                class="h-9 rounded-md border border-gray-200 bg-gray-50"
              ></div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>
