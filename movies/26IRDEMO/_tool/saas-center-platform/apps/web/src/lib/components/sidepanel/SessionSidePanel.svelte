<script lang="ts">
  import { slide } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import type { SessionVM, JournalFormData } from '$lib/types/counseling'

  interface Props {
    session: SessionVM | null
    counselorName?: string
    counselingPlace?: string
    isJournalMode?: boolean
    onClose: () => void
    onSave?: () => void
    onWriteJournal?: (session: SessionVM) => void
    onSaveJournal?: (journalData: JournalFormData) => void
  }

  let {
    session,
    counselorName = '이지연',
    counselingPlace = '상담실 A',
    isJournalMode = false,
    onClose,
    onSave,
    onWriteJournal,
    onSaveJournal
  }: Props = $props()

  // 일지 보기/작성 모드
  let isViewingJournal = $state(false)
  // 수정 모드 (readonly → editable)
  let isEditing = $state(false)

  const emptyJournalForm = (): JournalFormData => ({
    goal: '',
    progress: '',
    nextPlan: '',
    privateMemo: '',
    opinion: ''
  })

  // 일지 폼 데이터
  let journalForm = $state<JournalFormData>(emptyJournalForm())

  // 원본 데이터 (변경 감지용)
  let originalData = $state<JournalFormData>(emptyJournalForm())

  // 변경사항 감지
  const hasChanges = $derived(
    journalForm.goal !== originalData.goal ||
      journalForm.progress !== originalData.progress ||
      journalForm.nextPlan !== originalData.nextPlan ||
      journalForm.opinion !== originalData.opinion ||
      journalForm.privateMemo !== originalData.privateMemo
  )

  // 외부에서 일지 모드로 열릴 때 동기화
  $effect(() => {
    if (isJournalMode && session) {
      isViewingJournal = true
      journalForm = emptyJournalForm()
      originalData = emptyJournalForm()
      isEditing = true
    }
  })

  // 세션 변경 시 상태 초기화
  $effect(() => {
    if (session) {
      isViewingJournal = false
      isEditing = false
      journalForm = emptyJournalForm()
      originalData = emptyJournalForm()
    }
  })

  const formattedDateTime = $derived(() => {
    if (!session?.scheduledDate) return '-'
    const date = new Date(session.scheduledDate)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[date.getDay()]
    const timeStr = session.scheduledTime?.slice(0, 5) || '00:00'
    return `${session.scheduledDate}(${dayName}) ${timeStr}`
  })

  const hasJournal = $derived(session?.hasJournal ?? false)

  function handleStartJournal() {
    isViewingJournal = true
    isEditing = true
    journalForm = emptyJournalForm()
    originalData = emptyJournalForm()
  }

  function handleCloseJournal() {
    isViewingJournal = false
    isEditing = false
    onClose()
  }

  function handleStartEditing() {
    isEditing = true
  }

  function handleSaveJournal() {
    onSaveJournal?.(journalForm)
    // 저장 후 원본 데이터 업데이트
    originalData = { ...journalForm }
    isEditing = false
  }
</script>

{#if session}
  <div
    class="fixed inset-y-0 right-0 z-50 flex w-120 flex-col bg-white shadow-xl"
    transition:slide={{ axis: 'x', duration: 200 }}
  >
    {#if isViewingJournal}
      <!-- 일지 보기/작성 모드 -->
      <!-- 헤더 -->
      <div
        class="flex items-center justify-between border-b border-gray-100 px-6 py-5"
      >
        <div class="flex items-center gap-3">
          <Tooltip text="닫기">
            <button
              onclick={handleCloseJournal}
              aria-label="닫기"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Typography variant="title-01-semibold" color="text-gray-900">
            상담일지
          </Typography>
        </div>

        {#if isEditing}
          <!-- 수정 모드: 저장하기 버튼 -->
          <Button
            class="h-10 rounded-lg px-5 text-white {hasChanges
              ? 'bg-primary-500 hover:bg-primary-600'
              : 'cursor-not-allowed bg-primary-300'}"
            onclick={handleSaveJournal}
            disabled={!hasChanges}
          >
            <Typography variant="body-02-semibold" color="text-white">
              저장
            </Typography>
          </Button>
        {:else}
          <!-- 읽기 모드: 수정 버튼 -->
          <Button
            class="h-10 rounded-lg bg-primary-500 px-5 text-white hover:bg-primary-600"
            onclick={handleStartEditing}
          >
            <Typography variant="body-02-semibold" color="text-white">
              수정
            </Typography>
          </Button>
        {/if}
      </div>

      <!-- 일지 콘텐츠 -->
      <div class="flex-1 overflow-y-auto">
        <!-- 상담 정보 섹션 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <Typography
            variant="body-01-semibold"
            color="text-gray-900"
            className="mb-4"
          >
            상담 정보
          </Typography>

          <div class="space-y-2.5">
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-16 shrink-0"
              >
                상담 일시
              </Typography>
              <Typography variant="body-02-medium" color="text-gray-800">
                {formattedDateTime()}
              </Typography>
            </div>
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-16 shrink-0"
              >
                상담 장소
              </Typography>
              <Typography variant="body-02-medium" color="text-gray-800">
                {counselingPlace}
              </Typography>
            </div>
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-16 shrink-0"
              >
                상담사
              </Typography>
              <div class="flex items-center gap-1.5">
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full bg-green-100"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                </span>
                <Typography variant="body-02-medium" color="text-gray-800">
                  {counselorName}
                </Typography>
              </div>
            </div>
          </div>
        </div>

        <!-- 상담 목표 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <Typography
            variant="body-01-semibold"
            color="text-gray-900"
            className="mb-3"
          >
            상담 목표
          </Typography>
          {#if isEditing}
            <textarea
              bind:value={journalForm.goal}
              placeholder="이번 일정에 대한 상담 목표를 작성해주세요"
              class="min-h-25 w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:outline-none px-3 py-3.5"
            ></textarea>
          {:else}
            <div
              class="min-h-15 w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
            >
              {journalForm.goal || '-'}
            </div>
          {/if}
        </div>

        <!-- 진행 내용 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <Typography
            variant="body-01-semibold"
            color="text-gray-900"
            className="mb-3"
          >
            진행 내용
          </Typography>
          {#if isEditing}
            <textarea
              bind:value={journalForm.progress}
              placeholder="상담 중에 중요한 내용을 요약해서 작성해주세요."
              class="min-h-30 w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:outline-none px-3 py-3.5"
            ></textarea>
          {:else}
            <div
              class="min-h-20 w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
            >
              {journalForm.progress || '-'}
            </div>
          {/if}
        </div>

        <!-- 다음 상담 내용 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <Typography
            variant="body-01-semibold"
            color="text-gray-900"
            className="mb-3"
          >
            다음 상담 내용
          </Typography>
          {#if isEditing}
            <textarea
              bind:value={journalForm.nextPlan}
              placeholder="다음 상담 내용을 작성해주세요"
              class="min-h-25 w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:outline-none px-3 py-3.5"
            ></textarea>
          {:else}
            <div
              class="min-h-15 w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
            >
              {journalForm.nextPlan || '-'}
            </div>
          {/if}
        </div>

        <!-- 종합 소견 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <Typography
            variant="body-01-semibold"
            color="text-gray-900"
            className="mb-3"
          >
            종합 소견
          </Typography>
          {#if isEditing}
            <textarea
              bind:value={journalForm.opinion}
              placeholder="종합 소견을 작성해주세요"
              class="min-h-30 w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:outline-none px-3 py-3.5"
            ></textarea>
          {:else}
            <div
              class="min-h-15 w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
            >
              {journalForm.opinion || '-'}
            </div>
          {/if}
        </div>

        <!-- 개인 메모 -->
        <div class="px-6 py-5">
          <div class="mb-1 flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12.6667 7.33333V6.66667C12.6667 4.08934 10.5773 2 8 2C5.42267 2 3.33333 4.08934 3.33333 6.66667V7.33333C2.59695 7.33333 2 7.93029 2 8.66667V12.6667C2 13.403 2.59695 14 3.33333 14H12.6667C13.403 14 14 13.403 14 12.6667V8.66667C14 7.93029 13.403 7.33333 12.6667 7.33333ZM4.66667 6.66667C4.66667 4.82572 6.15905 3.33333 8 3.33333C9.84095 3.33333 11.3333 4.82572 11.3333 6.66667V7.33333H4.66667V6.66667Z"
                fill="#F59E0B"
              />
            </svg>
            <Typography variant="body-01-semibold" color="text-gray-900">
              개인 메모
            </Typography>
          </div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-3"
          >
            개인 기록용 메모로 본인만 확인가능해요
          </Typography>
          {#if isEditing}
            <textarea
              bind:value={journalForm.privateMemo}
              placeholder="개인 메모를 작성해주세요"
              class="min-h-20 w-full resize-none rounded-lg border-0 bg-[#FFF8E7] text-body-03-reading-regular text-amber-700 placeholder:text-amber-500/70 focus:outline-none focus:ring-amber-300 px-3 py-3.5"
            ></textarea>
          {:else}
            <div
              class="min-h-15 w-full whitespace-pre-wrap rounded-lg bg-[#FFF8E7] p-4 text-sm text-amber-700"
            >
              {journalForm.privateMemo || '-'}
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- 기본 세션 정보 모드 -->
      <!-- 헤더 -->
      <div
        class="flex items-center justify-between border-b border-gray-100 px-6 py-5"
      >
        <Typography variant="title-01-semibold" color="text-gray-900">
          {session.sessionNumber}회기
        </Typography>
        <Tooltip text="닫기">
          <button
            onclick={onClose}
            aria-label="닫기"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>

      <!-- 콘텐츠 -->
      <div class="flex-1 overflow-y-auto">
        <!-- 상담 정보 섹션 -->
        <div class="border-b border-gray-100 px-6 py-5">
          <div class="mb-4 flex items-center justify-between">
            <Typography variant="body-01-semibold" color="text-gray-900">
              상담 정보
            </Typography>

            <button aria-label="수정" class="text-gray-400 hover:text-gray-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1739 1.49653 12.4191 1.44775 12.6667 1.44775C12.9143 1.44775 13.1595 1.49653 13.3883 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4088 2.61178C14.5035 2.84055 14.5523 3.08575 14.5523 3.33337C14.5523 3.58099 14.5035 3.82619 14.4088 4.05497C14.314 4.28374 14.1751 4.49161 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="space-y-3">
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-20 shrink-0"
              >
                상담 일시
              </Typography>
              <Typography variant="body-02-medium" color="text-gray-800">
                {formattedDateTime()}
              </Typography>
            </div>
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-20 shrink-0"
              >
                상담 장소
              </Typography>
              <Typography variant="body-02-medium" color="text-gray-800">
                {counselingPlace}
              </Typography>
            </div>
            <div class="flex">
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="w-20 shrink-0"
              >
                담당 상담사
              </Typography>
              <div class="flex items-center gap-1.5">
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full bg-green-100"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                </span>
                <Typography variant="body-02-medium" color="text-gray-800">
                  {counselorName}
                </Typography>
              </div>
            </div>
          </div>
        </div>

        <!-- 상담일지 영역 -->
        <div
          class="flex flex-1 flex-col items-center justify-center px-6 py-16"
        >
          {#if hasJournal}
            <!-- 일지가 있는 경우 (추후 구현) -->
            <Typography variant="body-02-medium" color="text-gray-500">
              상담일지 내용이 표시돼요
            </Typography>
          {:else}
            <!-- 일지가 없는 경우 - 빈 상태 -->
            <div class="flex flex-col items-center">
              <!-- 빈 문서 아이콘 -->
              <div
                class="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100"
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M18.6667 4H8C7.29276 4 6.61448 4.28095 6.11438 4.78105C5.61428 5.28115 5.33333 5.95942 5.33333 6.66667V25.3333C5.33333 26.0406 5.61428 26.7189 6.11438 27.219C6.61448 27.719 7.29276 28 8 28H24C24.7072 28 25.3855 27.719 25.8856 27.219C26.3857 26.7189 26.6667 26.0406 26.6667 25.3333V12L18.6667 4Z"
                    stroke="#9CA3AF"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M18.6667 4V12H26.6667"
                    stroke="#9CA3AF"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 18L20 18"
                    stroke="#9CA3AF"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M12 22L17.3333 22"
                    stroke="#9CA3AF"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="mb-4"
              >
                작성된 상담일지가 없어요
              </Typography>
              <Button
                class="h-10 rounded-lg border border-primary-500 bg-white px-4 text-primary-500 hover:bg-primary-50"
                onclick={handleStartJournal}
              >
                <Typography variant="body-02-medium" color="text-primary-500">
                  일지 작성
                </Typography>
              </Button>
            </div>
          {/if}
        </div>
      </div>

      <!-- 푸터 -->
      <div class="border-t border-gray-100 px-6 py-4">
        <Button
          class="h-12 w-full rounded-lg bg-primary-500 text-white hover:bg-primary-600"
          onclick={onSave}
        >
          <Typography variant="body-01-semibold" color="text-white">
            저장
          </Typography>
        </Button>
      </div>
    {/if}
  </div>

  <!-- 배경 오버레이 -->
  <button
    class="fixed inset-0 z-40 bg-black/30"
    onclick={isViewingJournal ? handleCloseJournal : onClose}
    aria-label="닫기"
    transition:slide={{ duration: 200 }}
  ></button>
{/if}
