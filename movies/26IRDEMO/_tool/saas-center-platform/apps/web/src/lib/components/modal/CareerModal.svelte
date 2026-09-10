<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { CareerData } from '$lib/features/members/constants'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import CircleClose from '../../assets/CircleClose.svelte'

  interface Props {
    modalId?: string
    initialData?: CareerData
    onConfirm?: (
      educations: string[],
      careers: string[],
      certifications: string[]
    ) => void
    closeModal?: () => void
  }

  let {
    modalId = '',
    initialData,
    onConfirm,
    closeModal = () => {}
  }: Props = $props()

  // props 캡처 (모달 열릴 때 1회) — 즉시 실행으로 reactive 추적 차단
  const { _educations, _careers, _certifications } = (() => ({
    _educations: initialData?.educations ?? [],
    _careers: initialData?.careers ?? [],
    _certifications: initialData?.certifications ?? []
  }))()

  const isEditMode = !!(
    _educations.length ||
    _careers.length ||
    _certifications.length
  )

  // 초기값: 기존 데이터가 있으면 그대로, 없으면 빈 input 1개
  let educations = $state<string[]>(
    _educations.length ? [..._educations] : ['']
  )
  let careers = $state<string[]>(_careers.length ? [..._careers] : [''])
  let certifications = $state<string[]>(
    _certifications.length ? [..._certifications] : ['']
  )

  // 초기값 저장 (변경 감지용)
  const initialEducations = JSON.stringify(_educations)
  const initialCareers = JSON.stringify(_careers)
  const initialCertifications = JSON.stringify(_certifications)

  // 빈 문자열 제거한 결과
  const cleanArray = (arr: string[]) =>
    arr.map((s) => s.trim()).filter((s) => s.length > 0)

  const hasChanges = $derived(
    JSON.stringify(cleanArray(educations)) !== initialEducations ||
      JSON.stringify(cleanArray(careers)) !== initialCareers ||
      JSON.stringify(cleanArray(certifications)) !== initialCertifications
  )

  const addItem = (section: 'educations' | 'careers' | 'certifications') => {
    if (section === 'educations') educations = [...educations, '']
    else if (section === 'careers') careers = [...careers, '']
    else certifications = [...certifications, '']
  }

  const removeItem = (
    section: 'educations' | 'careers' | 'certifications',
    index: number
  ) => {
    if (section === 'educations') {
      educations = educations.filter((_, i) => i !== index)
      if (educations.length === 0) educations = ['']
    } else if (section === 'careers') {
      careers = careers.filter((_, i) => i !== index)
      if (careers.length === 0) careers = ['']
    } else {
      certifications = certifications.filter((_, i) => i !== index)
      if (certifications.length === 0) certifications = ['']
    }
  }

  const handleConfirm = () => {
    onConfirm?.(
      cleanArray(educations),
      cleanArray(careers),
      cleanArray(certifications)
    )
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  footerClass="px-5 pt-4 pb-5"
  title={`학력/경력/자격 사항을 ${isEditMode ? '수정' : '추가'}할게요`}
>
  {#snippet body()}
    <div class="w-full p-5 pb-7 max-h-[65vh] overflow-y-auto space-y-2">
      <!-- 학력 섹션 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          학력
        </Typography>
        {#each educations as _, i}
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={educations[i]}
              placeholder="학력 사항을 입력해주세요"
              class="field-input flex-1"
            />
            {#if i}
              <button
                onclick={() => removeItem('educations', i)}
                class="shrink-0 w-8 h-8 flex-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <CircleClose />
              </button>
            {/if}
          </div>
        {/each}
        <button
          onclick={() => addItem('educations')}
          class="flex items-center gap-2 group mt-4 mx-auto text-action-primary"
        >
          <PlusIcon20 />
          <Typography
            variant="body-02-normal-medium"
            color="text-gray-600"
            className="group-hover:text-primary-600 transition-colors"
          >
            추가
          </Typography>
        </button>
      </div>

      <!-- 경력 섹션 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          경력
        </Typography>
        {#each careers as _, i}
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={careers[i]}
              placeholder="경력 사항을 입력해주세요"
              class="field-input flex-1"
            />
            {#if i}
              <button
                onclick={() => removeItem('careers', i)}
                class="shrink-0 w-8 h-8 flex-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <CircleClose />
              </button>
            {/if}
          </div>
        {/each}
        <button
          onclick={() => addItem('careers')}
          class="flex items-center gap-2 group mt-4 mx-auto text-action-primary"
        >
          <PlusIcon20 />
          <Typography
            variant="body-02-normal-medium"
            color="text-gray-600"
            className="group-hover:text-primary-600 transition-colors"
          >
            추가
          </Typography>
        </button>
      </div>

      <!-- 자격증 섹션 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          자격증
        </Typography>
        {#each certifications as _, i}
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={certifications[i]}
              placeholder="자격증명을 입력해주세요"
              class="field-input flex-1"
            />
            {#if i}
              <button
                onclick={() => removeItem('certifications', i)}
                class="shrink-0 w-8 h-8 flex-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <CircleClose />
              </button>
            {/if}
          </div>
        {/each}
        <button
          onclick={() => addItem('certifications')}
          class="flex items-center gap-2 group mt-4 mx-auto text-action-primary"
        >
          <PlusIcon20 />
          <Typography
            variant="body-02-normal-medium"
            color="text-gray-600"
            className="group-hover:text-primary-600 transition-colors"
          >
            추가
          </Typography>
        </button>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleConfirm}
        disabled={!hasChanges}
        class="flex h-11 w-32 items-center justify-center rounded-lg transition-colors {hasChanges
          ? 'bg-primary-500 text-white hover:bg-primary-600'
          : 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'}"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isEditMode ? '수정' : '추가'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
