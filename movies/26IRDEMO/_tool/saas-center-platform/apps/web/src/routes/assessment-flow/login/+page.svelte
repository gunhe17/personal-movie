<script lang="ts">
  import AssessmentLoginPage from '../../assessment/login/+page.svelte'

  let { data }: { data: { hasMainSession?: boolean } } = $props()
</script>

<AssessmentLoginPage />
