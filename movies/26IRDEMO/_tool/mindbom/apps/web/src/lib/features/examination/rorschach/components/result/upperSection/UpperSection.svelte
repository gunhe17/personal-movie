<script lang="ts">
  import ParentSection from '../shared/ParentSection.svelte'
  import LocationFeaturesResult from './LocationFeaturesResult.svelte'
  import DqResult from './DqResult.svelte'
  import BlendsResult from './BlendsResult.svelte'
  import FormQualityResult from './FormQualityResult.svelte'
  import SingleResult from './SingleResult.svelte'
  import DeterminantsResult from './DeterminantsResult.svelte'
  import ContentsResult from './ContentsResult.svelte'
  import ApproachResult from './ApproachResult.svelte'
  import SpecialScoresResult from './SpecialScoresResult.svelte'
  import OtherScoresResult from './OtherScoresResult.svelte'

  interface Props {
    data: {
      location: any
      dq: any
      single: Record<string, number>
      determinants: Record<string, number>
      content: Record<string, number>
      fq: any
      blends: string[][]
      approach: Record<string, string[]>
      special: Record<string, number | null>
    }
  }
  let { data }: Props = $props()
</script>

<div
  class="grid grid-cols-[38%_36%_minmax(0,26%)] border-b border-l border-blue-100 bg-white"
>
  <!-- 첫 번째 열 -->
  <div class="flex flex-col">
    <div class="grid grow grid-cols-2">
      <div class="flex flex-col">
        <ParentSection title="Location Features" class="grow">
          <LocationFeaturesResult data={data.location} />
        </ParentSection>
        <ParentSection title="DQ">
          <DqResult data={data.dq} />
        </ParentSection>
      </div>
      <ParentSection title="Blends">
        <BlendsResult data={data.blends} />
      </ParentSection>
    </div>
    <ParentSection title="Form Quality">
      <FormQualityResult data={data.fq} />
    </ParentSection>
  </div>

  <!-- 두 번째 열 -->
  <div class="grid grid-cols-3">
    <ParentSection title="Single">
      <SingleResult data={data.single} />
    </ParentSection>
    <ParentSection title="Determinants">
      <DeterminantsResult data={data.determinants} />
    </ParentSection>
    <ParentSection title="Contents">
      <ContentsResult data={data.content} />
    </ParentSection>
  </div>

  <!-- 세 번째 열 -->
  <div class="flex flex-col">
    <ParentSection title="Approach">
      <ApproachResult data={data.approach} />
    </ParentSection>
    <ParentSection title="Special Scores">
      <SpecialScoresResult data={data.special} />
    </ParentSection>
    <ParentSection title="Other Scores" class="grow">
      <OtherScoresResult data={data.special} />
    </ParentSection>
  </div>
</div>
