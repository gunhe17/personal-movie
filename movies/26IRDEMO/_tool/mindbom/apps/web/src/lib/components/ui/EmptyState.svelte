<script lang="ts">
  /**
   * EmptyState — 리스트·검색 결과가 비었을 때의 안내.
   *
   * 정본 §빈 상태: 중앙 아이콘 + 안내 텍스트(text-body-subtle) + (선택) 액션.
   */
  import type { Snippet } from 'svelte'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    /** Material Icons Round 이름 */
    icon?: string
    title?: string
    description?: string
    actions?: Snippet
    class?: string
  }

  let {
    icon = 'inbox',
    title,
    description,
    actions,
    class: className = ''
  }: Props = $props()
</script>

<div class="flex flex-col items-center justify-center gap-4 px-6 py-16 {className}">
  <span
    class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"
  >
    <Icon name={icon} size="xl" />
  </span>
  <div class="flex flex-col items-center gap-1">
    {#if title}
      <p class="text-body-01-normal-medium text-gray-700">{title}</p>
    {/if}
    {#if description}
      <p class="whitespace-pre-line text-center text-body-03-normal-regular text-gray-500">
        {description}
      </p>
    {/if}
  </div>
  {#if actions}
    <div class="mt-1 flex items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
