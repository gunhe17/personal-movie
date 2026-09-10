<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements'

  interface Props extends HTMLTextareaAttributes {
    label?: string
    required?: boolean
    value?: string
  }

  let { label, required = false, value = $bindable(''), class: className, ...rest }: Props =
    $props()
</script>

<div>
  {#if label}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="block text-sm font-medium text-gray-700 mb-1.5">
      {label}
      {#if required}<span class="text-red-500">*</span>{/if}
    </label>
  {/if}
  <textarea
    bind:value
    class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 {className ??
      ''}"
    {...rest}
  ></textarea>
</div>
