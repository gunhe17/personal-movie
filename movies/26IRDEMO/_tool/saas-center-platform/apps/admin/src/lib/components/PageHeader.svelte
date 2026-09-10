<script lang="ts">
  import Typography from './Typography.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    description?: string
    actions?: Snippet
  }

  let { title, description, actions }: Props = $props()
</script>

<div class="mb-6 flex items-center justify-between">
  <div>
    <Typography variant="headline-01-normal-bold" tag="h1">{title}</Typography>
    {#if description}
      <Typography variant="body-03-normal-regular" tag="p" color="text-gray-500" className="mt-3">
        {description}
      </Typography>
    {/if}
  </div>
  {#if actions}
    <div class="flex items-center gap-3">
      {@render actions()}
    </div>
  {/if}
</div>
