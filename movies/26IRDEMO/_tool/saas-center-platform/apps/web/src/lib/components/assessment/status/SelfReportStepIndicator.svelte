<script lang="ts">
  import Stepper from './Stepper.svelte'
  import { SELF_REPORT_STEPS } from '$lib/features/assessment/status-detail/constants'

  let {
    activeStep = 1,
    completedSteps = [],
    onStepChange
  } = $props<{
    activeStep?: number
    completedSteps?: number[]
    onStepChange?: (stepNumber: number) => void
  }>()
</script>

<Stepper
  steps={SELF_REPORT_STEPS}
  {activeStep}
  {completedSteps}
  {onStepChange}
/>
