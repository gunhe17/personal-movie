<script lang="ts">
  import RorschachIntro from '@assessment/rorschach/components/intro/RorschachIntro.svelte'
  import RorschachStartOptions from '@assessment/rorschach/components/intro/RorschachStartOptions.svelte'

  interface Props {
    params: { clientId: string }
  }

  let { params }: Props = $props()
  const clientId = params.clientId
</script>

<div class="flex min-h-screen">
  <RorschachIntro />
  <RorschachStartOptions {clientId} />
</div>
