<script lang="ts">
  import { get } from '$lib/services/api/instances'
  import { requireInstitutionId } from '$lib/stores/institution.store'
  import { auth } from '$lib/stores/auth'
  import {
    EXAM_TYPES as REGISTERED_EXAM_TYPES,
    getExamModule
  } from '$lib/features/examination/core/registry'

  let {
    onConfirm,
    closeModal
  }: {
    onConfirm: (data: ExamFormData) => Promise<void>
    closeModal: () => void
    modalId?: string
  } = $props()

  import BaseModal from '$components/modal/BaseModal.svelte'
  import Button from '$components/ui/Button.svelte'
  import { twMerge } from 'tailwind-merge'
  import FormField, {
    FIELD_INPUT_CLASS,
    FIELD_TEXTAREA_CLASS
  } from '$components/ui/FormField.svelte'
  import PersonSelect from '$components/ui/PersonSelect.svelte'
  import DatePickerInput from '$lib/components/ui/DatePickerInput.svelte'

  interface ExamFormData {
    client_id: string
    examiner_id: string
    exam_types: string[]
    scheduled_at?: string
    note?: string
  }

  interface ClientOption { id: string; name: string; birth_date?: string; gender?: string | null }
  // 구성원엔 아직 성별 컬럼이 없다 — 아바타는 이름 해시로 떨어진다(PersonAvatar 주석)
  interface MemberOption { id: string; name: string; role: string; account_id: string }

  let currentUser = $derived($auth.user)
  let isClinician = $derived(currentUser?.role === 'clinician')

  const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원'
  }

  const AM_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  const PM_SLOTS = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

  let clientId = $state('')
  let examinerId = $state('')
  let examTypes = $state<string[]>([])
  let scheduledDate = $state('')
  let selectedTime = $state('')
  let useCustomTime = $state(false)
  let customTimeValue = $state('')
  let note = $state('')
  let isSubmitting = $state(false)

  let clients = $state<ClientOption[]>([])
  let members = $state<MemberOption[]>([])
  let isLoadingOptions = $state(true)

  // 선택된 이름 — PersonSelect가 칩을 그리는 데 쓴다(목록 로딩 전에도 표시 가능)
  let selectedClientName = $state('')
  let selectedExaminerName = $state('')

  // PersonSelect가 받는 형태로 변환 — 보조줄(sub)은 내담자는 생년월일, 검사자는 역할
  let clientOptions = $derived(
    clients.map((c) => ({
      id: c.id,
      name: c.name,
      sub: c.birth_date,
      gender: c.gender
    }))
  )
  let examinerOptions = $derived(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      sub: ROLE_LABELS[m.role] ?? m.role
    }))
  )

  let isValid = $derived(clientId !== '' && examinerId !== '' && examTypes.length > 0)

  function toggleType(value: string) {
    // 준비중 검사는 선택 불가 (안전장치 — 버튼도 disabled)
    if (EXAM_TYPES.find((t) => t.value === value)?.comingSoon) return
    examTypes = examTypes.includes(value)
      ? examTypes.filter((t) => t !== value)
      : [...examTypes, value]
  }

  let scheduledTime = $derived(useCustomTime ? customTimeValue : selectedTime)

  $effect(() => { loadOptions() })

  async function loadOptions() {
    try {
      const instId = requireInstitutionId()
      const [clientRes, memberRes] = await Promise.all([
        get<{ items: ClientOption[] }>(`/institutions/${instId}/clients`, { page: 1, size: 200 }),
        get<{ items: MemberOption[] }>(`/institutions/${instId}/members`, { page: 1, size: 200 }),
      ])
      clients = clientRes.items ?? []
      members = memberRes.items ?? []

      // clinician 본인 자동 examiner — 백엔드도 동일하게 강제
      if (isClinician && currentUser) {
        const self = members.find((m) => m.account_id === currentUser.id)
        if (self) {
          examinerId = self.id
          selectedExaminerName = self.name
        }
      } else {
        // admin/researcher: 첫 clinician 을 디폴트로 (실제 검사 수행자를 임상가로 지정 유도)
        const firstClinician = members.find((m) => m.role === 'clinician')
        if (firstClinician) {
          examinerId = firstClinician.id
          selectedExaminerName = firstClinician.name
        }
      }
    } catch {
      clients = []
      members = []
    } finally {
      isLoadingOptions = false
    }
  }

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    isSubmitting = true
    try {
      let scheduledAt: string | undefined
      if (scheduledDate) {
        const time = scheduledTime || '09:00'
        scheduledAt = new Date(`${scheduledDate}T${time}`).toISOString()
      }
      const data: ExamFormData = {
        client_id: clientId,
        examiner_id: examinerId,
        exam_types: examTypes,
        ...(scheduledAt && { scheduled_at: scheduledAt }),
        ...(note.trim() && { note: note.trim() }),
      }
      await onConfirm(data)
      closeModal()
    } catch {
      // error handled by service
    } finally {
      isSubmitting = false
    }
  }

  // comingSoon: 목록에는 노출하되 아직 접수 불가(준비중)인 검사.
  interface ExamTypeOption {
    value: string
    label: string
    desc: string
    /** 원형 심볼 배경색. 준비중 검사는 모듈이 없어 비어 있다. */
    symbolColor?: string
    comingSoon?: boolean
  }
  const EXAM_TYPES: ExamTypeOption[] = [
    // 현재 지원 — 레지스트리에서 파생한다. 새 검사를 붙이면 여기에 자동으로
    // 나타나고, 이름·설명·심볼색도 모듈 선언 하나에서 온다.
    ...REGISTERED_EXAM_TYPES.map((t) => {
      const m = getExamModule(t)
      return {
        value: t,
        label: m.shortLabel,
        desc: m.subtitle,
        symbolColor: m.symbolColor
      }
    }),
    // 준비중 (목록 노출만) — 아직 모듈이 없어 여기 남는다.
    { value: 'kcbcl', label: 'K-CBCL', desc: '아동·청소년 행동평가', comingSoon: true },
    { value: 'pat', label: 'PAT', desc: '부모양육태도 검사', comingSoon: true },
    { value: 'raven', label: 'RAVEN', desc: '비언어 지능검사', comingSoon: true },
    { value: 'smart_body', label: '스마트바디체커', desc: '신체발달 검사', comingSoon: true },
    { value: 'smartphone_teen', label: '스마트폰중독(청소년)', desc: '스마트폰 과의존', comingSoon: true },
    { value: 'smartphone_adult', label: '스마트폰중독(성인)', desc: '스마트폰 과의존', comingSoon: true },
    { value: 'bgt', label: 'BGT', desc: '벤더게슈탈트 검사', comingSoon: true },
    { value: 'mmpi2', label: 'MMPI-2', desc: '다면적 인성검사(성인)', comingSoon: true },
    { value: 'mmpi_a', label: 'MMPI-A', desc: '다면적 인성검사(청소년)', comingSoon: true },
    { value: 'wppsi', label: 'WPPSI', desc: '유아 지능검사', comingSoon: true },
    { value: 'tci', label: 'TCI', desc: '기질 및 성격검사', comingSoon: true },
    { value: 'jtci', label: 'J-TCI', desc: '기질 및 성격검사(청소년)', comingSoon: true },
    { value: 'kbayley3', label: 'K-Bayley-3', desc: '영유아 발달검사', comingSoon: true },
    { value: 'kwisc4', label: 'K-WISC-IV', desc: '아동 지능검사(웩슬러)', comingSoon: true },
    { value: 'kfd', label: 'KFD', desc: '동적가족화 검사', comingSoon: true },
  ]
</script>

<BaseModal {closeModal} title="새 검사 등록" description="검사 정보를 입력해주세요">
  {#snippet body()}
  {#if isLoadingOptions}
    <div class="flex h-40 items-center justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"></div>
    </div>
  {:else}
    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => { e.preventDefault(); handleSubmit() }}
    >
      <!-- 내담자 선택 (검색형) -->
      <FormField label="내담자" required>
        <PersonSelect
          options={clientOptions}
          bind:value={clientId}
          bind:selectedName={selectedClientName}
          searchable
          searchPlaceholder="내담자 이름을 검색하세요"
          emptyText="등록된 내담자가 없습니다"
          ariaLabel="내담자"
        />
      </FormField>

      <!-- 검사 유형 선택 (복수 선택 가능 → 배터리) -->
      <FormField label="검사 유형" required note="복수 선택 시 배터리로 등록됩니다">
        <div class="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
          {#each EXAM_TYPES as type}
            {@const selected = examTypes.includes(type.value)}
            {@const soon = type.comingSoon === true}
            <button
              type="button"
              onclick={() => toggleType(type.value)}
              aria-pressed={selected}
              disabled={soon}
              title={soon ? '준비중인 검사입니다' : ''}
              class="relative flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-all
                {soon
                  ? 'cursor-not-allowed border-gray-100 bg-gray-50'
                  : selected
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'}"
            >
              {#if soon}
                <span class="absolute right-1.5 top-1.5 rounded-full bg-gray-200 px-1.5 py-px text-caption-01-normal-semibold text-gray-500">준비중</span>
              {:else if selected}
                <span class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              {/if}
              <!--
                검사 심볼 — 원형 색 블록에 약칭을 얹는다. 색은 모듈 선언에서
                오고(운영 플랫폼과 같은 값), 준비중 검사는 모듈이 없어 회색이다.
              -->
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none {soon
                  ? 'bg-gray-200 text-gray-400'
                  : 'text-white'}"
                style={soon ? '' : `background-color: ${type.symbolColor}`}
                aria-hidden="true"
              >
                {type.label.charAt(0)}
              </span>
              <span class="text-sm font-semibold {soon ? 'text-gray-400' : selected ? 'text-primary-700' : 'text-gray-600'}">{type.label}</span>
              <span class="text-label-02-normal-regular {soon ? 'text-gray-300' : selected ? 'text-primary-500' : 'text-gray-400'}">{type.desc}</span>
            </button>
          {/each}
        </div>
        {#if examTypes.length > 1}
          <!-- 간격은 FormField의 gap이 준다 -->
          <p class="text-label-02-normal-regular text-primary-600">{examTypes.length}개 검사가 배터리로 함께 등록됩니다.</p>
        {/if}
      </FormField>

      <!-- 검사자 (커스텀 드롭다운) -->
      <FormField
        label="검사자"
        required
        note={isClinician ? '본인으로 자동 지정' : '실제 검사를 수행할 임상심리사'}
      >
        <PersonSelect
          options={examinerOptions}
          bind:value={examinerId}
          bind:selectedName={selectedExaminerName}
          placeholder="검사자를 선택하세요"
          emptyText="등록된 직원이 없습니다"
          locked={isClinician}
          role="counselor"
          ariaLabel="검사자"
        />
      </FormField>

      <!-- 검사 예정일 -->
      <FormField label="검사 예정일">
        <!-- 날짜 — 시간 슬롯과의 간격은 FormField의 gap이 준다 -->
        <DatePickerInput bind:value={scheduledDate} />

        <!-- 시간 슬롯 -->
        {#if useCustomTime}
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              bind:value={customTimeValue}
              class={twMerge(FIELD_INPUT_CLASS, 'pl-9 pr-9')}
            />
            <button
              type="button"
              onclick={() => { useCustomTime = false; customTimeValue = ''; selectedTime = '' }}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        {:else}
          <div class="space-y-2">
            <div>
              <p class="mb-1 text-caption-01-normal-medium text-gray-400">오전</p>
              <div class="flex flex-wrap gap-1.5">
                {#each AM_SLOTS as t}
                  <button
                    type="button"
                    onclick={() => (selectedTime = t)}
                    class="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all
                      {selectedTime === t
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                  >{t}</button>
                {/each}
              </div>
            </div>
            <div>
              <p class="mb-1 text-caption-01-normal-medium text-gray-400">오후</p>
              <div class="flex flex-wrap gap-1.5">
                {#each PM_SLOTS as t}
                  <button
                    type="button"
                    onclick={() => (selectedTime = t)}
                    class="rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all
                      {selectedTime === t
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                  >{t}</button>
                {/each}
              </div>
            </div>
            <button
              type="button"
              onclick={() => (useCustomTime = true)}
              class="text-label-02-normal-regular text-gray-400 transition-colors hover:text-gray-600"
            >
              다른 시간 직접 입력
            </button>
          </div>
        {/if}
      </FormField>

      <!-- 비고 -->
      <FormField label="비고" id="exam-note">
        <textarea
          id="exam-note"
          bind:value={note}
          rows={4}
          placeholder="특이사항이나 메모를 입력하세요"
          class={FIELD_TEXTAREA_CLASS}
        ></textarea>
      </FormField>

    </form>
  {/if}
  {/snippet}

  {#snippet footer()}
    <Button variant="outlineSecondary" size="md" onclick={closeModal}>취소</Button>
    <Button
      variant="primary"
      size="md"
      loading={isSubmitting}
      disabled={!isValid || isLoadingOptions}
      onclick={handleSubmit}
    >
      등록
    </Button>
  {/snippet}
</BaseModal>
