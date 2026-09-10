<script lang="ts">
  import { slide, fade } from 'svelte/transition'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Button from '../Button.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Select from '$lib/components/Select.svelte'
  import CirclePlusBlueIcon from '$lib/assets/CirclePlusBlueIcon.svelte'

  export interface SendableAssessment {
    id: string
    caseId: string
    assessment: string
    clientName: string
    isCompleted: boolean
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    assessments?: SendableAssessment[]
    onSend?: (data: {
      ids: string[]
      recipients: Recipient[]
    }) => void | Promise<void>
  }

  interface Recipient {
    id: string
    relation: string
    name: string
    phone: string
  }

  const RELATION_OPTIONS = ['엄마', '아빠', '조부모', '기타']

  let recipientIdCounter = 1

  let {
    modalId,
    closeModal = () => {},
    assessments = [],
    onSend
  }: Props = $props()

  let selectedIds = $state<string[]>([])
  let isSending = $state(false)
  let recipients = $state<Recipient[]>([
    { id: 'recipient-0', relation: '엄마', name: '', phone: '' }
  ])

  // 완료된 검사만 기본 선택
  $effect(() => {
    selectedIds = assessments
      .filter((item) => item.isCompleted)
      .map((item) => item.id)
  })

  function toggle(id: string, isCompleted: boolean) {
    if (!isCompleted) return

    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((v) => v !== id)
    } else {
      selectedIds = [...selectedIds, id]
    }
  }

  async function handleSend() {
    isSending = true
    try {
      await onSend?.({ ids: selectedIds, recipients })
      closeModal()
    } finally {
      isSending = false
    }
  }

  function addRecipient() {
    recipients = [
      ...recipients,
      {
        id: `recipient-${recipientIdCounter++}`,
        relation: '',
        name: '',
        phone: ''
      }
    ]
  }

  function updateRelation(idx: number, value: string) {
    recipients[idx].relation = value
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  size="custom500"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7 max-h-[calc(90vh-180px)]"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet header()}
    <div class="flex flex-col">
      <div class="flex w-full items-center justify-between space-y-1">
        <Typography variant="headline-02-normal-semibold" color="text-gray-900">
          아래 검사를 전송할게요
        </Typography>
        <button
          class="p-1 text-gray-400 hover:text-gray-600"
          onclick={closeModal}
        >
          <CloseIcon />
        </button>
      </div>
      <Typography variant="body-03-regular" color="text-gray-500">
        완료된 검사만 결과를 전송할 수 있어요
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="space-y-6">
      <!-- 검사 목록 -->
      {#if assessments.length > 0}
        <div class="space-y-2 border-b border-gray-200 pb-5">
          {#each assessments as item}
            <label
              class="flex items-center gap-3 py-1"
              class:cursor-pointer={item.isCompleted}
              class:cursor-not-allowed={!item.isCompleted}
            >
              <Checkbox
                id={item.id}
                checked={selectedIds.includes(item.id)}
                onchange={() => toggle(item.id, item.isCompleted)}
                disabled={!item.isCompleted}
                containerClass="w-5 h-5"
                boxClass="w-5 h-5"
              />
              <span class="text-body-02-normal-medium text-gray-800"
                >{item.assessment}</span
              >
              {#if !item.isCompleted}
                <div class="group relative">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="shrink-0 cursor-help"
                  >
                    <circle cx="8" cy="8" r="7" fill="#EF4444" />
                    <path
                      d="M8 9.5V5"
                      stroke="white"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                    <circle cx="8" cy="11.5" r="0.75" fill="white" />
                  </svg>
                  <div
                    class="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity whitespace-nowrap group-hover:opacity-100"
                  >
                    <p>해당 검사는 완료되지 않았어요!</p>
                    <p>완료 후 결과를 전송할 수 있어요</p>
                    <div
                      class="absolute left-1/2 bottom-full -translate-x-1/2 border-4 border-transparent border-b-gray-800"
                    ></div>
                  </div>
                </div>
              {/if}
            </label>
          {/each}
        </div>
      {/if}

      <!-- 수신자 -->
      <div class="space-y-3 pt-2">
        <Typography variant="title-01-semibold" color="text-gray-900">
          수신자
        </Typography>
        <div class="space-y-2">
          {#each recipients as recipient, idx (recipient.id)}
            <div
              class="flex items-center gap-2"
              in:slide={{ duration: 250 }}
              out:fade={{ duration: 150 }}
            >
              <Select
                options={RELATION_OPTIONS}
                selected={recipient.relation}
                placeholder="관계"
                class="w-[120px]"
                on:change={(e) => updateRelation(idx, e.detail)}
              />
              <input
                type="text"
                placeholder="이길자"
                bind:value={recipient.name}
                class="field-input w-[140px]"
              />
              <input
                type="text"
                placeholder="010-0000-0000"
                bind:value={recipient.phone}
                class="field-input flex-1 min-w-[150px]"
              />
            </div>
          {/each}
        </div>
        <div class="flex justify-center">
          <button
            type="button"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-body-02-normal-regular text-gray-600 hover:bg-gray-50"
            onclick={addRecipient}
          >
            <CirclePlusBlueIcon />
            추가
          </button>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end">
      <Button
        class="h-11 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 px-8 text-white shadow-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50"
        onclick={handleSend}
        disabled={selectedIds.length === 0 || isSending}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSending ? '전송 중...' : `${selectedIds.length}개 결과 전송`}
        </Typography>
      </Button>
    </div>
  {/snippet}
</BaseModal>
