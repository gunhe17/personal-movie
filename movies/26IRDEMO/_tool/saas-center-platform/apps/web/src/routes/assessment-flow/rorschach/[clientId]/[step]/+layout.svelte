<script lang="ts">
  import RorschachStepLayout from '../../../../assessment/rorschach/[clientId]/[step]/+layout.svelte'

  let { children } = $props()
</script>

<RorschachStepLayout {children} />
