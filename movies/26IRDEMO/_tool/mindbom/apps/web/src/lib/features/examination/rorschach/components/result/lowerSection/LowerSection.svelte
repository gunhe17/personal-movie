<script lang="ts">
  import ParentSection from '../shared/ParentSection.svelte'
  import CoreResult from './CoreResult.svelte'
  import AffectionResult from './AffectionResult.svelte'
  import InterpersonalResult from './InterpersonalResult.svelte'
  import IdeationResult from './IdeationResult.svelte'
  import CognitiveMediationResult from './CognitiveMediationResult.svelte'
  import InformationProcessingResult from './InformationProcessingResult.svelte'
  import SelfPerceptionResult from './SelfPerceptionResult.svelte'

  interface Props {
    data: Record<string, Record<string, number | string>>
  }
  let { data }: Props = $props()

  const COLORS = {
    core: '#FECB01',
    affection: '#C70A89',
    interpersonal: '#84B522',
    ideation: '#1395A1',
    cognitiveMediation: '#012396',
    informationProcessing: '#0176D0',
    selfPerception: '#017750',
  }
</script>

<div class="flex flex-col gap-2 p-2">
  <!-- 상단 행: Core / Affection / Interpersonal -->
  <div class="grid grid-cols-3 gap-2">
    <ParentSection title="Core" mainColor={COLORS.core} class="border">
      <CoreResult data={data.core} />
    </ParentSection>
    <ParentSection title="Affection" mainColor={COLORS.affection} class="border">
      <AffectionResult data={data.affection} />
    </ParentSection>
    <ParentSection title="Interpersonal" mainColor={COLORS.interpersonal} class="border">
      <InterpersonalResult data={data.interpersonal} />
    </ParentSection>
  </div>

  <!-- 하단 행: Ideation / Cognitive Mediation / Information Processing / Self-Perception -->
  <div class="grid grid-cols-4 gap-2">
    <ParentSection title="Ideation" mainColor={COLORS.ideation} class="border">
      <IdeationResult data={data.ideation} />
    </ParentSection>
    <ParentSection title="Cognitive Mediation" mainColor={COLORS.cognitiveMediation} class="border">
      <CognitiveMediationResult data={data.cognitiveMediation} />
    </ParentSection>
    <ParentSection title="Information Processing" mainColor={COLORS.informationProcessing} class="border">
      <InformationProcessingResult data={data.informationProcessing} />
    </ParentSection>
    <ParentSection title="Self-Perception" mainColor={COLORS.selfPerception} class="border">
      <SelfPerceptionResult data={data.selfPerception} />
    </ParentSection>
  </div>
</div>
