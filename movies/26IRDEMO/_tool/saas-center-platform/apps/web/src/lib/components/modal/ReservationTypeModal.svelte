<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import SegmentTab from '../SegmentTab.svelte'
  import Typography from '@common/components/Typography.svelte'
  import DynamicSelctForm from '../searchInput/DynamicSelctForm.svelte'
  import AssessmentSelectDropdowm from '../searchInput/AssessmentSelectDropdowm.svelte'
  import type { Assessment } from '../../hooks/actions/assessment.action'
  import ProgramSelectDropdown from '../searchInput/ProgramSelectDropdown.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
  }

  const tabs = [
    { label: '초기상담', value: 'counsel' },
    { label: '프로그램', value: 'program' },
    { label: '검사', value: 'assessment' }
  ]

  let { modalId = '', closeModal = () => {} }: Props = $props()

  let selectedProgram = $state('')
  let selectedTab = $state('counsel')
  let selectedClients = $state<(any | null)[]>([])
  let selectedAssessments = $state<Assessment[]>([])
  let selectedSpecialists = $state<(any | null)[]>([])
  let selectedAssessmentIds = $derived(selectedAssessments.map((a) => a.uid))
</script>

<!-- svelte-ignore element_invalid_self_closing_tag -->
<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder
  showFooterBorder
  showCloseButton
  size="lg"
  bodyClass="p-5 pb-10"
  footerClass="px-5 pt-4 pb-5"
  title="상담 일정을 추가할게요"
>
  {#snippet body()}
    <div class="space-y-6">
      <!-- 탭 -->
      <SegmentTab
        items={tabs}
        selected={selectedTab}
        onChange={(v) => (selectedTab = v)}
      />
      <!-- 프로그램 옵션 -->
      <DynamicSelctForm
        bind:selectedTab
        bind:selectedClients
        bind:selectedSpecialists
      />
      <!-- 구분선 -->
      <div class="w-full h-[0.5px] border-[0.5px] border-gray-100" />
      <!-- 검사 옵션 -->
      {#if selectedTab === 'assessment'}
        <div class="space-y-2">
          <Typography variant="body-02-medium" color="text-gray-700">
            검사 세트
          </Typography>
          <AssessmentSelectDropdowm
            bind:selectedAssessments
            bind:selectedAssessmentIds
          />
        </div>
        <div class="space-y-2">
          <Typography variant="body-02-medium" color="text-gray-700">
            추가 검사
          </Typography>
          <AssessmentSelectDropdowm
            bind:selectedAssessments
            bind:selectedAssessmentIds
          />
        </div>
      {:else if selectedTab === 'program'}
        <div class="space-y-2">
          <Typography variant="body-02-medium" color="text-gray-700">
            프로그램
          </Typography>
          <ProgramSelectDropdown
            bind:selectedProgram
            onProgramSelect={(v) => (selectedProgram = v.name)}
          />
        </div>
      {/if}
      <div class="space-y-2">
        <Typography variant="body-02-medium" color="text-gray-700">
          날짜 ∙ 시간
        </Typography>
        <AssessmentSelectDropdowm
          bind:selectedAssessments
          bind:selectedAssessmentIds
        />
      </div>
    </div>
  {/snippet}
</BaseModal>
