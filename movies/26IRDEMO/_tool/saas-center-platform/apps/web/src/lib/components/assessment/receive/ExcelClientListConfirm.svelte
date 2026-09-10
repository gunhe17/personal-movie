<script lang="ts">
  import { t, josa } from '$lib/ontology/terms'
  import { onMount } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import {
    excelUploadStore,
    type ExcelClientData
  } from '$lib/stores/excelUpload'
  import type { DuplicateClientResult } from '$lib/hooks/actions/client.action'
  import { portal } from '$lib/utils/positionPortal'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import QuestionTooltipIcon from '$root/src/lib/assets/QuestionTooltipIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    duplicateResults?: DuplicateClientResult[]
    isRegistering?: boolean
    onConfirm: () => void
    onCancel: () => void
    onClose: () => void
    onChangeFile: () => void
  }

  let {
    duplicateResults = [],
    isRegistering = false,
    onConfirm,
    onCancel,
    onClose,
    onChangeFile
  }: Props = $props()

  let clients = $state<ExcelClientData[]>([])
  let tooltipAnchor = $state<HTMLElement | null>(null)
  let tooltipResult = $state<DuplicateClientResult | null>(null)
  let criteriaTooltipAnchor = $state<HTMLElement | null>(null)
  let invalidFields = $state<Record<string, Set<string>>>({})
  let errorMessage = $state('')

  function hasGuardianInfo(client: ExcelClientData): boolean {
    return !!(
      client.guardianName ||
      client.guardianPhone ||
      client.guardianRelationship ||
      client.guardianGender ||
      client.guardianBirthDate
    )
  }

  function validate(): boolean {
    const errors: Record<string, Set<string>> = {}

    for (const client of clients) {
      const fields = new Set<string>()
      if (!client.name.trim()) fields.add('name')
      if (!client.birthDate.trim()) fields.add('birthDate')
      if (!client.gender) fields.add('gender')
      if (hasGuardianInfo(client) && !client.guardianName.trim())
        fields.add('guardianName')
      if (client.guardianName.trim()) {
        if (!client.guardianRelationship) fields.add('guardianRelationship')
        if (!client.guardianGender) fields.add('guardianGender')
        if (!client.guardianBirthDate?.trim()) fields.add('guardianBirthDate')
        if (!client.guardianPhone.trim()) fields.add('guardianPhone')
      }
      if (fields.size > 0) errors[client.id] = fields
    }

    invalidFields = errors
    return Object.keys(errors).length === 0
  }

  function isInvalid(clientId: string, field: string): boolean {
    return invalidFields[clientId]?.has(field) ?? false
  }

  function handleConfirmClick() {
    if (validate()) {
      errorMessage = ''
      onConfirm()
    } else {
      const errorCount = Object.keys(invalidFields).length
      errorMessage = `${errorCount}명의 ${t('subject')}에 필수 항목이 누락되어 있어요. 빨간색으로 표시된 항목을 확인해주세요.`
    }
  }

  onMount(() => {
    const unsub = excelUploadStore.subscribe((state) => {
      clients = state.clients
    })
    return unsub
  })

  function getDuplicateResult(
    clientId: string
  ): DuplicateClientResult | undefined {
    return duplicateResults.find((r) => r.clientId === clientId)
  }

  function handleBadgeMouseEnter(e: MouseEvent, result: DuplicateClientResult) {
    tooltipAnchor = e.currentTarget as HTMLElement
    tooltipResult = result
  }

  function handleBadgeMouseLeave() {
    tooltipAnchor = null
    tooltipResult = null
  }

  function handleDeleteRow(id: string) {
    excelUploadStore.removeClient(id)
  }

  function handleInputChange(
    id: string,
    field: keyof ExcelClientData,
    value: string
  ) {
    excelUploadStore.updateClient(id, { [field]: value })
    if (invalidFields[id]?.has(field as string)) {
      invalidFields[id].delete(field as string)
      invalidFields = { ...invalidFields }
    }
  }

  function handleGenderChange(id: string, value: string) {
    excelUploadStore.updateClient(id, {
      gender: value as 'male' | 'female' | ''
    })
    if (invalidFields[id]?.has('gender')) {
      invalidFields[id].delete('gender')
      invalidFields = { ...invalidFields }
    }
  }
</script>

<div class="flex h-full flex-col bg-white">
  <!-- 헤더 - X 버튼 -->
  <header class="flex shrink-0 items-center px-6 py-4">
    <Tooltip text="닫기">
      <button
        type="button"
        onclick={onClose}
        class="rounded-full p-2 text-icon-secondary transition-colors hover:bg-gray-100 hover:text-title-subtitle"
        aria-label="닫기"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </Tooltip>
  </header>

  <!-- 메인 콘텐츠 -->
  <main class="flex-1 overflow-auto px-6 pb-6">
    <div class="mb-8 text-center">
      <Typography
        variant="headline-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        아래 {t('subject')} 정보를 확인해주세요!
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-caption-default">
        엑셀 파일에서 필수 항목이 입력되지 않거나, 잘못 입력된 내용을 한번 더
        확인해주세요
      </Typography>
    </div>

    <div class="mx-auto max-w-300">
      <div class="mb-4 flex items-center justify-between gap-4">
        <Typography variant="body-01-normal-semibold" color="text-body-default">
          총 {clients.length}명
        </Typography>
        <button
          type="button"
          onclick={onChangeFile}
          class="flex h-10 items-center gap-2 rounded-lg border border-border-default bg-white px-6 text-body-02-normal-medium text-body-default transition-colors hover:bg-gray-50"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect width="20" height="20" rx="3" class="fill-brand-excel" />
            <path
              d="M6 6L10 10M10 10L14 14M10 10L14 6M10 10L6 14"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          엑셀 파일 변경
        </button>
      </div>

      <!-- grid 컬럼: No. | 중복 | 이름 | 성별 | 생년월일 | 보호자이름 | 관계 | 보호자성별 | 보호자생년월일 | 연락처 | 삭제 -->
      <div class="rounded-lg border border-border-default">
        <div>
          <!-- 헤더 -->
          <div
            class="grid h-14 items-center gap-4 bg-gray-50 px-4 text-body-03-normal-medium text-title-subtitle border-b border-border-default"
            style="grid-template-columns: 0.5fr 7rem 1.2fr 0.5fr 1fr 1.2fr 0.8fr 0.6fr 1fr 1fr 2rem"
          >
            <span class="truncate-safe">No.</span>
            <span class="flex min-w-0 items-center gap-1">
              <span class="truncate-safe">중복 가능성</span>
              <button
                type="button"
                class="shrink-0 text-icon-secondary hover:text-title-subtitle"
                onmouseenter={(e) => {
                  criteriaTooltipAnchor = e.currentTarget as HTMLElement
                }}
                onmouseleave={() => {
                  criteriaTooltipAnchor = null
                }}
                aria-label="중복 가능성 기준 안내"
              >
                <QuestionTooltipIcon />
              </button>
            </span>
            <span class="truncate-safe">이름</span>
            <span class="truncate-safe">성별</span>
            <span class="truncate-safe">생년월일</span>
            <span class="truncate-safe">{t('guardian')} 이름</span>
            <span class="truncate-safe">관계</span>
            <span class="truncate-safe">{t('guardian')} 성별</span>
            <span class="truncate-safe">{t('guardian')} 생년월일</span>
            <span class="truncate-safe">{t('guardian')} 연락처</span>
            <span></span>
          </div>
          <!-- 바디 -->
          {#each clients as client, index (client.id)}
            {@const dupResult = getDuplicateResult(client.id)}
            <div
              class="grid min-h-14 items-center gap-4 border-b border-border-subtle px-4 py-2 last:border-b-0
              {dupResult?.duplicate_level === 'high'
                ? 'bg-status-danger-bg'
                : dupResult?.duplicate_level === 'low'
                  ? 'bg-status-warning-bg'
                  : 'bg-white'}"
              style="grid-template-columns: 0.5fr 7rem 1.2fr 0.5fr 1fr 1.2fr 0.8fr 0.6fr 1fr 1fr 2rem"
            >
              <span class="text-body-03-normal-regular text-caption-default"
                >{index + 1}</span
              >
              <div>
                {#if dupResult?.duplicate_level === 'high'}
                  <span
                    role="status"
                    class="inline-flex h-6 shrink-0 cursor-default items-center justify-center rounded-md bg-trans-bg-red px-2 text-label-01-normal-medium text-etc-red"
                    onmouseenter={(e) =>
                      dupResult && handleBadgeMouseEnter(e, dupResult)}
                    onmouseleave={handleBadgeMouseLeave}>높음</span
                  >
                {:else if dupResult?.duplicate_level === 'low'}
                  <span
                    role="status"
                    class="inline-flex h-6 shrink-0 cursor-default items-center justify-center rounded-md bg-trans-bg-orange px-2 text-label-01-normal-medium text-etc-orange"
                    onmouseenter={(e) =>
                      dupResult && handleBadgeMouseEnter(e, dupResult)}
                    onmouseleave={handleBadgeMouseLeave}>낮음</span
                  >
                {:else}
                  <span class="text-label-01-normal-regular text-icon-tertiary"
                    >-</span
                  >
                {/if}
              </div>
              <input
                type="text"
                value={client.name}
                oninput={(e) =>
                  handleInputChange(client.id, 'name', e.currentTarget.value)}
                class="w-full min-w-0 bg-transparent text-body-03-normal-regular outline-none placeholder:text-placeholder {isInvalid(
                  client.id,
                  'name'
                )
                  ? 'text-status-danger placeholder:text-red-400'
                  : 'text-body-default'}"
                placeholder="이름"
              />
              <select
                value={client.gender}
                onchange={(e) =>
                  handleGenderChange(client.id, e.currentTarget.value)}
                class="w-full appearance-none bg-transparent text-body-03-normal-regular outline-none {isInvalid(
                  client.id,
                  'gender'
                )
                  ? 'text-status-danger'
                  : 'text-body-default'}"
              >
                <option value="">선택</option>
                <option value="female">여</option>
                <option value="male">남</option>
              </select>
              <input
                type="text"
                value={client.birthDate}
                oninput={(e) =>
                  handleInputChange(
                    client.id,
                    'birthDate',
                    e.currentTarget.value
                  )}
                class="w-full min-w-0 bg-transparent text-body-03-normal-regular outline-none placeholder:text-placeholder {isInvalid(
                  client.id,
                  'birthDate'
                )
                  ? 'text-status-danger placeholder:text-red-400'
                  : 'text-body-default'}"
                placeholder="YYYY-MM-DD"
              />
              <input
                type="text"
                value={client.guardianName}
                oninput={(e) =>
                  handleInputChange(
                    client.id,
                    'guardianName',
                    e.currentTarget.value
                  )}
                class="w-full min-w-0 bg-transparent text-body-03-normal-regular outline-none placeholder:text-placeholder {isInvalid(
                  client.id,
                  'guardianName'
                )
                  ? 'text-status-danger placeholder:text-red-400'
                  : 'text-body-default'}"
                placeholder={`${t('guardian')} 이름`}
              />
              <select
                value={client.guardianRelationship}
                onchange={(e) =>
                  handleInputChange(
                    client.id,
                    'guardianRelationship',
                    e.currentTarget.value
                  )}
                class="w-full appearance-none bg-transparent text-body-03-normal-regular outline-none {isInvalid(
                  client.id,
                  'guardianRelationship'
                )
                  ? 'text-status-danger'
                  : 'text-body-default'}"
              >
                <option value="">선택</option>
                <option value="엄마">엄마</option>
                <option value="아빠">아빠</option>
                <option value="형">형</option>
                <option value="언니">언니</option>
                <option value="누나">누나</option>
                <option value="오빠">오빠</option>
                <option value="형부">형부</option>
                <option value="사촌">사촌</option>
                <option value="조부모">조부모</option>
                <option value="기타">기타</option>
              </select>
              <select
                value={client.guardianGender}
                onchange={(e) => {
                  excelUploadStore.updateClient(client.id, {
                    guardianGender: e.currentTarget.value as
                      | 'male'
                      | 'female'
                      | ''
                  })
                  if (invalidFields[client.id]?.has('guardianGender')) {
                    invalidFields[client.id].delete('guardianGender')
                    invalidFields = { ...invalidFields }
                  }
                }}
                class="w-full appearance-none bg-transparent text-body-03-normal-regular outline-none {isInvalid(
                  client.id,
                  'guardianGender'
                )
                  ? 'text-status-danger'
                  : 'text-body-default'}"
              >
                <option value="">선택</option>
                <option value="female">여</option>
                <option value="male">남</option>
              </select>
              <input
                type="text"
                value={client.guardianBirthDate}
                oninput={(e) =>
                  handleInputChange(
                    client.id,
                    'guardianBirthDate',
                    e.currentTarget.value
                  )}
                class="w-full min-w-0 bg-transparent text-body-03-normal-regular outline-none placeholder:text-placeholder {isInvalid(
                  client.id,
                  'guardianBirthDate'
                )
                  ? 'text-status-danger placeholder:text-red-400'
                  : 'text-body-default'}"
                placeholder="YYYY-MM-DD"
              />
              <input
                type="text"
                value={client.guardianPhone}
                oninput={(e) =>
                  handleInputChange(
                    client.id,
                    'guardianPhone',
                    e.currentTarget.value
                  )}
                class="w-full min-w-0 bg-transparent text-body-03-normal-regular outline-none placeholder:text-placeholder {isInvalid(
                  client.id,
                  'guardianPhone'
                )
                  ? 'text-status-danger placeholder:text-red-400'
                  : 'text-body-default'}"
                placeholder="010-0000-0000"
              />
              <Tooltip text="삭제">
                <button
                  type="button"
                  onclick={() => handleDeleteRow(client.id)}
                  class="p-1 text-icon-tertiary transition-colors hover:text-caption-default"
                  aria-label="삭제"
                >
                  <TrashIcon24 />
                </button>
              </Tooltip>
            </div>
          {/each}
        </div>
      </div>
      {#if errorMessage}
        <p class="mt-1 field-help is-error">
          {errorMessage}
        </p>
      {/if}
    </div>
  </main>

  {#if tooltipAnchor && tooltipResult?.matched_client}
    <div
      use:portal={{ anchor: tooltipAnchor, isFitWidth: false, zIndex: 9999 }}
      class="w-52 rounded-lg border border-border-default bg-white p-3 text-label-01-normal-regular shadow-dropdown"
    >
      <p class="mb-1 text-label-01-normal-medium text-body-default">
        {tooltipResult.duplicate_level === 'high' ? '중복 높음' : '중복 낮음'}
      </p>
      <p class="text-label-01-normal-regular leading-5 text-title-subtitle">
        이름: {tooltipResult.matched_client.name}
      </p>
      {#if tooltipResult.matched_client.birth_date}
        <p class="text-label-01-normal-regular leading-5 text-title-subtitle">
          생년월일: {tooltipResult.matched_client.birth_date}
        </p>
      {/if}
      {#if tooltipResult.matched_client.phone}
        <p class="text-label-01-normal-regular leading-5 text-title-subtitle">
          연락처: {tooltipResult.matched_client.phone}
        </p>
      {/if}
      <p class="mt-1 text-label-01-normal-regular text-caption-subtle">
        등록일: {tooltipResult.matched_client.created_at.slice(0, 10)}
      </p>
    </div>
  {/if}

  {#if criteriaTooltipAnchor}
    <div
      use:portal={{
        anchor: criteriaTooltipAnchor,
        isFitWidth: false,
        zIndex: 9999
      }}
      class="w-64 rounded-lg border border-border-default bg-white p-3 text-label-01-normal-regular shadow-dropdown"
    >
      <p class="mb-2 text-label-01-normal-medium text-body-default">
        중복 가능성 기준
      </p>
      <p
        class="mb-2 text-label-01-normal-regular leading-5 text-caption-subtle"
      >
        중복으로 판단된 {josa(t('subject'), '은/는')} 등록에서 제외되고 기존 {t(
          'subject'
        )}로 처리돼요.
      </p>
      <div class="mb-1 flex items-start gap-2">
        <span
          class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-trans-bg-red text-label-02-normal-medium text-etc-red"
          >높</span
        >
        <p class="text-label-01-normal-regular leading-5 text-title-subtitle">
          이름 + 생년월일 + {t('guardian')} 연락처(또는 생년월일) 일치
        </p>
      </div>
      <div class="flex items-start gap-2">
        <span
          class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-trans-bg-orange text-label-02-normal-medium text-etc-orange"
          >낮</span
        >
        <p class="text-label-01-normal-regular leading-5 text-title-subtitle">
          이름 + 생년월일 일치 ({t('guardian')} 정보 불일치 또는 없음)
        </p>
      </div>
    </div>
  {/if}

  <footer class="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        onclick={onCancel}
        class="flex h-12 items-center rounded-lg border border-border-default bg-white px-5 text-body-01-normal-medium text-body-default transition-colors hover:bg-gray-50"
      >
        취소
      </button>
      <button
        type="button"
        onclick={handleConfirmClick}
        disabled={clients.length === 0 || isRegistering}
        class="flex h-12 items-center gap-2 rounded-lg bg-action-primary px-5 text-body-01-normal-medium text-white transition-colors hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        {#if isRegistering}
          <div class="relative h-4 w-4">
            <div
              class="absolute inset-0 rounded-full border-2 border-white/30"
            ></div>
            <div
              class="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white"
            ></div>
          </div>
          등록 중...
        {:else}
          등록
        {/if}
      </button>
    </div>
  </footer>
</div>
