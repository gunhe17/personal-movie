<script lang="ts">
  import type { InterpretationItem } from '../types'
  import { CATEGORY_ICONS, getCategoryStyleByKorean } from '../constants'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    interpretations: InterpretationItem[]
    /** 해석 id를 받는다 — 화면 필터·정렬과 무관한 유일한 좌표(types.ts 참고) */
    onToggleImportant?: (id: string) => void
    /** 확정 이후에는 별표를 잠근다 — 보고서 내용이 확정 뒤에 바뀌면 안 된다 */
    readOnly?: boolean
  }

  let { interpretations, onToggleImportant, readOnly = false }: Props = $props()

  let canToggle = $derived(!readOnly && !!onToggleImportant)

  function getCategoryStyle(drawing: string) {
    return getCategoryStyleByKorean(drawing)
  }
</script>

<div class="border border-gray-200 rounded-lg overflow-hidden">
  <table class="w-full text-body-03-normal-regular">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-3 py-2 text-center text-label-01-normal-medium text-gray-600 border-b border-gray-200 w-16">중요</th>
        <th class="px-3 py-2 text-center text-label-01-normal-medium text-gray-600 border-b border-gray-200 w-28">분류</th>
        <th class="px-3 py-2 text-center text-label-01-normal-medium text-gray-600 border-b border-gray-200 w-24">분석 요소</th>
        <th class="px-3 py-2 text-left text-label-01-normal-medium text-gray-600 border-b border-gray-200 w-28">표현</th>
        <th class="px-3 py-2 text-left text-label-01-normal-medium text-gray-600 border-b border-gray-200">해석</th>
      </tr>
    </thead>
    <tbody>
      {#if interpretations.length === 0}
        <tr>
          <td colspan="5" class="px-3 py-6 text-center text-body-03-normal-regular text-gray-400">
            해석 결과가 없습니다.
          </td>
        </tr>
      {:else}
        <!-- 키는 id다 — 인덱스로 키를 잡으면 '중요 항목만' 필터를 켤 때
             줄이 재사용되며 별표가 다른 해석에 붙어 보인다. -->
        {#each interpretations as interp (interp.id)}
          {#if interp.isCompound && interp.compoundElements && interp.compoundElements.length > 0}
            <!-- Compound rows -->
            {#each interp.compoundElements as el, elIdx (elIdx)}
              {@const isFirst = elIdx === 0}
              {@const isLast = elIdx === interp.compoundElements!.length - 1}
              {@const elScheme = getCategoryStyle(el.drawing)}
              <tr class="{isLast ? 'border-b border-gray-200' : ''} bg-orange-50/40">
                {#if isFirst}
                  <td class="px-3 py-3 text-center align-top" rowspan={interp.compoundElements!.length}>
                    {#if canToggle}
                      <button
                        onclick={() => onToggleImportant!(interp.id)}
                        class="flex-center mx-auto hover:text-yellow-400 transition-colors {interp.important ? 'text-yellow-400' : 'text-gray-300'}"
                      >
                        <Icon name={interp.important ? 'star' : 'star_border'} size="lg" />
                      </button>
                    {:else}
                      <Icon name={interp.important ? 'star' : 'star_border'} size="lg" class={interp.important ? 'text-yellow-400' : 'text-gray-300'} />
                    {/if}
                  </td>
                {/if}
                <td class="px-3 py-2 text-center {!isLast ? 'border-b border-orange-200/60' : ''}">
                  {#if elScheme}
                    <span class="inline-flex items-center gap-1 px-2 py-1 {elScheme.bgClass} {elScheme.textClass} rounded text-label-01-normal-medium">
                      <Icon name={CATEGORY_ICONS[el.drawing] || 'category'} size="xs" />
                      {el.drawing}
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-label-01-normal-medium">
                      <Icon name="psychology" size="xs" />
                      종합
                    </span>
                  {/if}
                </td>
                <td class="px-3 py-2 text-center text-gray-800 {!isLast ? 'border-b border-orange-200/60' : ''}">{el.element}</td>
                <td class="px-3 py-2 text-gray-800 {!isLast ? 'border-b border-orange-200/60' : ''}">{el.expression}</td>
                {#if isFirst}
                  <td class="px-3 py-3 text-body-03-reading-regular text-gray-600 align-top border-l border-orange-200/60" rowspan={interp.compoundElements!.length}>
                    <div class="flex items-start gap-1.5">
                      <span class="inline-flex items-center shrink-0 mt-0.5 px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-label-02-normal-medium">
                        <Icon name="merge_type" size="xs" class="mr-0.5" />
                        복합
                      </span>
                      <span>{interp.text}</span>
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          {:else}
            <!-- Single row -->
            {@const scheme = getCategoryStyle(interp.drawing)}
            <tr class="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
              <td class="px-3 py-3 text-center">
                {#if canToggle}
                  <button
                    onclick={() => onToggleImportant!(interp.id)}
                    class="flex-center mx-auto hover:text-yellow-400 transition-colors {interp.important ? 'text-yellow-400' : 'text-gray-300'}"
                  >
                    <Icon name={interp.important ? 'star' : 'star_border'} size="lg" />
                  </button>
                {:else}
                  <Icon name={interp.important ? 'star' : 'star_border'} size="lg" class={interp.important ? 'text-yellow-400' : 'text-gray-300'} />
                {/if}
              </td>
              <td class="px-3 py-3 text-center">
                {#if scheme}
                  <span class="inline-flex items-center gap-1 px-2 py-1 {scheme.bgClass} {scheme.textClass} rounded text-label-01-normal-medium">
                    <Icon name={CATEGORY_ICONS[interp.drawing] || 'category'} size="xs" />
                    {interp.drawing}
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-label-01-normal-medium">
                    <Icon name="psychology" size="xs" />
                    종합
                  </span>
                {/if}
              </td>
              <td class="px-3 py-3 text-center text-gray-800">{interp.element}</td>
              <td class="px-3 py-3 text-gray-800">{interp.expression}</td>
              <td class="px-3 py-3 text-body-03-reading-regular text-gray-600">{interp.text}</td>
            </tr>
          {/if}
        {/each}
      {/if}
    </tbody>
  </table>
</div>
