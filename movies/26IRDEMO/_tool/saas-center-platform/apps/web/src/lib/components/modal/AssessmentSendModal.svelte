<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade, slide } from 'svelte/transition'

  import {
    sessionListMockApis,
    type SessionAssessmentList,
    type SessionDetailResponseType
  } from '$lib/stores/sessionStatus_local'
  import { snackbarStore } from '$lib/stores/snackbar'

  import { dateToString } from '$lib/utils/date'

  import Button from '../Button.svelte'
  import Select from '../Select.svelte'
  import Switch from '../Switch.svelte'
  import BaseModal from './BaseModal.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import KebabIcon20 from '$lib/assets/KebabIcon20.svelte'
  import ArrowTailed from '../../assets/ArrowTailed.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CirclePlusBlueIcon from '$lib/assets/CirclePlusBlueIcon.svelte'

  interface Props {
    modalId?: string
    sessionInfo?: SessionDetailResponseType
    closeModal?: () => void
    onSendComplete?: () => void
  }

  let {
    modalId,
    closeModal = () => {},
    sessionInfo,
    onSendComplete
  }: Props = $props()

  const days = [3, 5, 7, 15]

  let currentStep = $state<number>(0)
  let isOnline = $state<boolean>(true)
  let hasEndDate = $state<boolean>(true)
  let expiryDate = $state<Date | null>(null)
  let selectedDayIndex = $state<number>(0)
  let isGuardianAdded = $state<boolean>(false)
  let assessmentList = $state<SessionAssessmentList | undefined>(undefined)
  let recipients = $state<
    {
      role: string
      phone_number: string
      name: string
      isStaticValue: boolean
    }[]
  >([])

  const addDays = () => {
    const result = new Date()
    result.setDate(result.getDate() + days[selectedDayIndex])
    expiryDate = result
    return result
  }

  const toggleGuardianAddedStatus = () => {
    if (!sessionInfo?.child.child_guardian || !recipients) return
    const staticGuardian = {
      role: sessionInfo.child.child_guardian.guardian_relation,
      phone_number: sessionInfo.child.child_guardian.guardian_phone,
      name: sessionInfo.child.child_guardian.guardian_name,
      isStaticValue: true
    }
    isGuardianAdded = !isGuardianAdded
    recipients = !isGuardianAdded
      ? [...recipients.filter((r) => !r.isStaticValue)]
      : [staticGuardian, ...recipients]
  }

  const onClickAddRecipients = () => {
    if (!recipients) return
    recipients = [
      ...recipients,
      { role: '', name: '', phone_number: '', isStaticValue: false }
    ]
  }

  const onClickRemoveRecipient = (idx: number) => {
    recipients.splice(idx, 1)
  }

  const onClickSendAssessment = () => {
    const validRecipient = recipients.filter(
      (r) => r.name && r.phone_number && r.role
    )
    const request = {
      sessionId: sessionInfo?.session_id,
      expiryDate,
      validRecipient
    }
    sessionListMockApis.handleSendAssessment(request)
    snackbarStore.success('검사 전송을 완료했습니다')
    onSendComplete?.()
    closeModal()
  }

  $effect(() => {
    if (sessionInfo)
      assessmentList = sessionListMockApis.getSessionAssessmentList(
        sessionInfo.session_id
      ).data
  })
</script>

<BaseModal
  {modalId}
  {closeModal}
  showFooterBorder={false}
  showCloseButton={false}
  size="lg"
  bodyClass="p-5 pb-7 max-h-[590px]"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="flex w-full items-center justify-between">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        바로 링크로 재전송할게요
      </Typography>
      <Button
        onclick={closeModal}
        class="flex-center h-11 w-11 rounded-full bg-gray-50 p-0! duration-300 hover:bg-gray-100"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 6L18 18"
            stroke="#8A949E"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M18 6L6 18"
            stroke="#8A949E"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </Button>
    </div>
  {/snippet}
  {#snippet body()}
    <!-- svelte-ignore event_directive_deprecated -->
    <div class="space-y-6">
      {#if currentStep === 0}
        {#if sessionInfo}
          <div class="border-b border-gray-100 pb-6">
            <Typography
              variant="body-02-normal-medium"
              className="mb-2"
              color="text-title-subtitle"
            >
              내담자 이름
            </Typography>
            <input
              disabled
              type="text"
              value={`${sessionInfo?.child?.child_name} (${sessionInfo?.assessment_code}) ${dateToString(sessionInfo?.child?.child_birth, 'YYYYMMDD')}`}
              class="field-input w-full"
            />
          </div>
          <div class="space-y-2 border-b border-gray-100 pb-6">
            <Typography
              variant="headline-02-reading-semibold"
              color="text-gray-800"
            >
              내담자에게 전자 서류 보내기
            </Typography>
            <Typography
              variant="body-02-reading"
              className="whitespace-pre-wrap"
              color="text-gray-600"
            >
              {'검사 전, 내담자가 미리 작성해야 하는 전자 서류(동의서, 상담 신청서 등)를\n함께 전송할 수 있어요'}
            </Typography>
            <div class="flex flex-wrap gap-2">
              {#each sessionInfo.documents ?? [] as document}
                <div
                  class="flex h-11 items-center justify-between rounded-lg border border-gray-200 px-4"
                >
                  <Typography variant="body-01-medium" color="text-gray-600">
                    {document.document_name}
                  </Typography>
                  <button
                    class="temp-none rounded-lg p-2 transition-colors hover:bg-gray-100"
                  >
                    <KebabIcon20 />
                  </button>
                </div>
              {/each}
            </div>
            <button
              class="temp-none flex h-11 items-center gap-2 rounded-lg border border-dashed border-[#85AFF9] bg-primary-50 px-4 duration-200"
            >
              <CirclePlusBlueIcon />
              <Typography variant="body-02-regular" color="text-primary-400"
                >서류 추가</Typography
              >
            </button>
          </div>
          <div>
            <Typography
              variant="headline-02-reading-semibold"
              className="mb-2"
              color="text-gray-800"
            >
              검사 목록
            </Typography>
            <!-- svelte-ignore event_directive_deprecated -->
            <div class="mb-2 flex gap-2">
              <button
                on:click={() => (isOnline = true)}
                class={twMerge(
                  'flex-center h-9 rounded-[100px] border px-3 duration-200',
                  isOnline
                    ? 'border-white bg-gray-800'
                    : 'border-gray-200 bg-white'
                )}
              >
                <Typography
                  variant="body-01-medium"
                  color={isOnline ? 'text-white' : 'text-gray-300'}
                >
                  온라인 전용 검사
                </Typography>
              </button>
              <button
                on:click={() => (isOnline = false)}
                class={twMerge(
                  'flex-center h-9 rounded-[100px] border px-3 duration-200',
                  !isOnline
                    ? 'border-white bg-gray-800'
                    : 'border-gray-200 bg-white'
                )}
              >
                <Typography
                  variant="body-01-medium"
                  color={!isOnline ? 'text-white' : 'text-gray-300'}
                >
                  오프라인 전용 검사
                </Typography>
              </button>
            </div>
            <div class="grid min-h-38 grid-cols-2 gap-2">
              {#if assessmentList}
                {@const allAssessments = assessmentList.package
                  ? [
                      ...assessmentList.assessments,
                      ...assessmentList.package.assessments
                    ]
                  : [...assessmentList.assessments]}
                {@const onlineAssessments = allAssessments.filter(
                  (a) => a.is_online_available
                )}
                {@const offlineAssessments = allAssessments.filter(
                  (a) => !a.is_online_available
                )}
                {#each isOnline ? onlineAssessments : offlineAssessments as assessment}
                  <div class="flex h-18 items-center gap-2 p-3">
                    <div
                      class="flex-center relative h-12 max-h-12 w-12 max-w-12"
                    >
                      <div
                        class="flex-center h-10 w-10 rounded-full"
                        style="background: {assessment.symbol_color}"
                      >
                        <Typography
                          variant="caption-01-reading-medium"
                          className="max-w-th wrap-break-word text-center"
                          color={assessment.status === 'gradingFinished'
                            ? 'text-white'
                            : 'text-gray-300'}
                        >
                          {assessment.name_en}
                        </Typography>
                      </div>
                    </div>
                    <div class="flex flex-col gap-2">
                      <Typography
                        variant="title-02-semibold"
                        color="text-gray-700"
                      >
                        {assessment.name_en.toUpperCase()}
                      </Typography>
                      <Typography
                        variant="body-02-regular"
                        color="text-gray-600"
                      >
                        {assessment.name_kr}
                      </Typography>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      {:else}
        <div class="space-y-2 border-b border-gray-100 pb-6">
          <Typography
            variant="headline-02-reading-semibold"
            color="text-gray-800"
          >
            보낼 대상자 선택
          </Typography>
          <div class="flex flex-wrap gap-2">
            <button
              on:click={toggleGuardianAddedStatus}
              class={twMerge(
                'flex-center h-11 rounded-lg border px-4 duration-200 hover:scale-103',
                isGuardianAdded ? 'border-none bg-primary' : 'border-gray-200'
              )}
            >
              <Typography
                variant="body-01-normal-medium"
                color={isGuardianAdded ? 'text-white' : 'text-gray-600'}
              >
                {sessionInfo?.child.child_guardian.guardian_relation}
              </Typography>
            </button>
          </div>
          {#each recipients as recipient, idx}
            {@const isStatic = recipient.isStaticValue}
            <div
              transition:slide
              class="grid h-11 grid-cols-[118px_113px_auto] gap-2"
            >
              {#if isStatic}
                <input
                  disabled
                  type="text"
                  value={recipient.role}
                  class="oultine-none text-title-02-normal-regular rounded-lg border border-gray-200 px-2.5 focus:border-border-active focus:outline-none disabled:bg-gray-100 disabled:text-gray-300"
                />
              {:else}
                <Select
                  placeholder="관계 선택"
                  hoverBoxClass="left-0"
                  btnClass="px-4"
                  textClass="body-01-medium"
                  bind:selected={recipient.role}
                  options={['엄마', '아빠', '할머니', '할아버지']}
                />
              {/if}
              <input
                type="text"
                disabled={isStatic}
                placeholder="이름"
                bind:value={recipient.name}
                class="oultine-none text-title-02-normal-regular rounded-lg border border-gray-200 px-2.5 focus:border-border-active focus:outline-none disabled:bg-gray-100 disabled:text-gray-300"
              />
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="010-0000-0000"
                  bind:value={recipient.phone_number}
                  disabled={isStatic}
                  class="oultine-none text-title-02-normal-regular h-full grow rounded-lg border border-gray-200 px-2.5 focus:border-border-active focus:outline-none disabled:bg-gray-100 disabled:text-gray-300"
                />
                {#if !isStatic}
                  <button
                    on:click={() => onClickRemoveRecipient(idx)}
                    class="rounded-md hover:bg-gray-50"
                  >
                    <TrashIcon />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          <button
            on:click={onClickAddRecipients}
            class="flex h-11 items-center gap-2 rounded-lg border border-dashed border-[#85AFF9] bg-primary-50 px-4 duration-200"
          >
            <CirclePlusBlueIcon />
            <Typography variant="body-02-regular" color="text-primary-400">
              전송 대상 추가
            </Typography>
          </button>
        </div>
        <div class="mb-0! flex items-center justify-between">
          <Typography
            variant="headline-02-reading-semibold"
            className="mb-2"
            color="text-gray-800"
          >
            검사 마감일을 지정할까요?
          </Typography>
          <div class="flex items-center gap-2">
            <Typography variant="body-02-regular" color="text-gray-600">
              {hasEndDate ? '네, 할래요' : '아니요, 안 할래요'}
            </Typography>
            <Switch
              checked={hasEndDate}
              onclick={() => (hasEndDate = !hasEndDate)}
              ariaLabel="검사 마감일 지정여부 선택"
            />
          </div>
        </div>
        {#if hasEndDate}
          {@const currentDate = new Date()}
          <div transition:slide class="space-y-6 pt-6">
            <div
              transition:fade
              class="relative grid grid-cols-4 rounded-lg bg-gray-100 p-2"
            >
              {#each days as day, idx}
                <!-- svelte-ignore event_directive_deprecated -->
                <button
                  class="flex-center z-10 h-9 w-30.5 cursor-pointer"
                  on:click={() => (selectedDayIndex = idx)}
                >
                  <Typography
                    variant="body-01-semibold"
                    className="delay-100"
                    color={selectedDayIndex === idx
                      ? 'text-white'
                      : 'text-gray-400'}
                  >
                    {day}일
                  </Typography>
                </button>
              {/each}
              <!-- svelte-ignore element_invalid_self_closing_tag -->
              <div
                class="absolute h-9 w-30.5 rounded-lg bg-primary-400 transition-all duration-300"
                style={`left: ${selectedDayIndex * 122 + 8}px; top: 8px;`}
              />
            </div>
            <div class="flex" transition:fade>
              <Typography
                variant="body-01-medium"
                color="text-gray-500"
                className="flex-center flex-1 text-center h-11 border-b border-gray-200"
              >
                {dateToString(currentDate, 'YYYY.MM.DD HH:mm')}
              </Typography>
              <Typography
                variant="body-01-medium"
                color="text-gray-300"
                className="shrink-0 flex-center px-4">~</Typography
              >
              <Typography
                variant="body-01-medium"
                color="text-gray-500"
                className="flex-center flex-1 text-center h-11 border-b border-gray-200"
              >
                {dateToString(addDays(), 'YYYY.MM.DD HH:mm')}
              </Typography>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full items-center justify-between">
      <Button
        disabled
        class="temp-hidden h-11 rounded-[10px] bg-gray-100 px-6 duration-200 hover:bg-gray-200"
        onclick={closeModal}
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600"
          >임시저장</Typography
        >
      </Button>
      <div class="flex gap-4">
        {#if currentStep === 0}
          <Button
            onclick={() => (currentStep = 1)}
            contentClass="gap-2"
            class="flex-center h-11 w-40 rounded-[10px] bg-primary-500 duration-200 hover:bg-primary-400"
          >
            <Typography variant="body-01-normal-medium" color="text-white"
              >다음</Typography
            >
            <div class="flex-center h-6 w-6">
              <ArrowTailed />
            </div>
          </Button>
        {:else}
          <Button
            onclick={() => (currentStep = 0)}
            contentClass="gap-2"
            class="flex-center h-11 w-40 rounded-[10px] border border-gray-200 bg-white duration-200 hover:bg-gray-50"
          >
            <div class="flex-center h-6 w-6 rotate-180">
              <ArrowTailed strokeColor={'#6D7882'} />
            </div>
            <Typography variant="body-01-normal-medium" color="text-gray-600"
              >이전</Typography
            >
          </Button>
          {@const valid = recipients.filter(
            (r) => r.name && r.phone_number && r.role
          ).length}
          <Button
            disabled={!valid}
            onclick={onClickSendAssessment}
            class="h-11 w-40 rounded-[10px] bg-primary-500 duration-200 hover:bg-primary-400 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
          >
            <Typography variant="body-01-normal-medium" color="text-white"
              >검사 전송</Typography
            >
          </Button>
        {/if}
      </div>
    </div>
  {/snippet}
</BaseModal>
