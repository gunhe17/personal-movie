<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import AssessmentStack from '$root/src/lib/assets/AssessmentStack.svelte'

  export let title: string
  export let codeLabel: string
  export let description: string
  export let badgeLabel: string
  export let badgeClass = ''
</script>

<div class="space-y-2">
  <div class="flex items-center gap-2 mb-1">
    <AssessmentStack />
    <div class="flex items-center gap-2">
      <div class="flex gap-x-1">
        <Typography variant="title-01-semibold" color="text-gray-900">
          {title}
        </Typography>
        <Typography variant="title-01-semibold" color="text-primary-400">
          {badgeLabel}
        </Typography>
      </div>
      <Typography variant="body-02-medium" color="text-gray-500">
        {codeLabel}
      </Typography>
    </div>
  </div>
  <Typography variant="body-01-regular" color="text-gray-500">
    {description}
  </Typography>
  <!-- <div>
    <button
      class={`inline-flex items-center rounded-full px-3 py-1 text-sm ${badgeClass}`}
    >
      {badgeLabel}
    </button>
  </div> -->
</div>

<slot />
