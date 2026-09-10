<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/state'
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'

  import { useOperationForm } from '$root/src/lib/features/schedule/operation/hooks.svelte'

  import { dateToString, parseDateParam } from '$root/src/lib/utils/date'

  import Typography from '@common/components/Typography.svelte'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import DateTimePicker from '$root/src/lib/components/filter/DateTimePicker.svelte'
  import { RoomSection } from '$root/src/lib/components/schedule/counsel'
  import {
    mutationBuilder,
    queryBuilder
  } from '$root/src/lib/hooks/queries/builder'
  import { getRoomList } from '$root/src/lib/hooks/actions/room.action'
  import { centerId } from '$root/src/lib/stores/center.store'
  import { buildRoomsQueryInput } from '$root/src/lib/features/schedule/counsel'
  import { browser } from '$app/environment'
  import { postCreateOperationSchedule } from '$root/src/lib/hooks/actions/schedule.action'
  import { snackbarStore } from '$root/src/lib/stores/snackbar'
  import DoubleRightArrow24Icon from '$root/src/lib/assets/DoubleRightArrow24Icon.svelte'
  import MemoBlueIcon24 from '$root/src/lib/assets/MemoBlueIcon24.svelte'
  import { getOperatingTimes } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isTimeOutsideOperatingHours
  } from '$lib/features/schedule/operating-hours'
  import { pageToolRegistry } from '$lib/features/agent/page-tools/registry'
  import { registerOperationReceiveTools } from '$lib/features/agent/page-tools/operation-receive'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  const form = useOperationForm()

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      staleTime: 5 * 60 * 1000
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  const isOutsideOperatingHours = $derived.by(() => {
    if (!form.startAt || !form.selectedDate) return false
    const dayHours = getOperatingHoursForDate(operatingTimes, form.selectedDate)
    return isTimeOutsideOperatingHours(form.startAt, dayHours)
  })

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomList = $derived(roomsQuery.data ?? [])

  const createSchedule = mutationBuilder(postCreateOperationSchedule, [
    'getScheduleList'
  ])

  let memo = $state<string>('')
  let isOpen = $state<boolean>(true)
  let title = $state<string>('')
  let sendNotification = $state<boolean>(false)
  let fieldErrors = $state<{ title?: string }>({})
  let isSubmitting = $state(false)

  const PYDANTIC_ERROR_MESSAGES: Record<string, string> = {
    string_too_long: '값이 너무 깁니다.',
    string_too_short: '값이 너무 짧습니다.',
    missing: '필수 항목입니다.',
    value_error: '유효하지 않은 값입니다.',
    string_pattern_mismatch: '올바른 형식이 아닙니다.'
  }

  type ScheduleFieldKey = 'title'
  const BACKEND_FIELD_MAP: Record<string, ScheduleFieldKey> = {
    title: 'title'
  }

  function validate(): typeof fieldErrors {
    const errors: typeof fieldErrors = {}
    if (!title.trim()) {
      errors.title = '일정 제목을 입력해주세요.'
    } else if (title.trim().length > 200) {
      errors.title = '일정 제목은 200자 이내로 입력해주세요.'
    }
    return errors
  }

  function extractFieldErrors(error: unknown): typeof fieldErrors | null {
    const details =
      (error as any)?.response?.data?.detail ??
      (error as any)?.detail ??
      (error as any)?.response?.data?.errors
    if (!Array.isArray(details)) return null
    const next: typeof fieldErrors = {}
    for (const item of details) {
      const loc = Array.isArray(item?.loc) ? item.loc : []
      const field = loc[loc.length - 1]
      const key = BACKEND_FIELD_MAP[field]
      if (!key) continue
      next[key] =
        PYDANTIC_ERROR_MESSAGES[item.type] || '유효하지 않은 값입니다.'
    }
    return Object.keys(next).length > 0 ? next : null
  }

  function extractApiError(error: unknown): string {
    const res = (error as any)?.response
    const detail = res?.data?.detail
    if (typeof detail === 'string') return detail
    const message = res?.data?.message ?? (error as any)?.message
    if (typeof message === 'string') return message
    return '스케줄 생성에 실패했습니다.'
  }

  const combineDateAndTime = (date: Date, time: string) => {
    const [h, m] = time.split(':').map(Number)
    const result = new Date(date)
    result.setHours(h, m, 0, 0)
    return result
  }

  const handleSubmit = () => {
    if (isSubmitting) return
    fieldErrors = {}

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      fieldErrors = errors
      return
    }

    if (!form.selectedDate || !form.startAt) {
      snackbarStore.error('일정 날짜와 시작 시간을 선택해주세요.')
      return
    }
    if (!form.endAt) {
      snackbarStore.error('종료 시간을 선택해주세요.')
      return
    }

    const startDateTime = combineDateAndTime(form.selectedDate, form.startAt)
    let endDateTime = combineDateAndTime(form.selectedDate, form.endAt)
    if (endDateTime <= startDateTime) {
      endDateTime = new Date(endDateTime)
      endDateTime.setDate(endDateTime.getDate() + 1)
    }

    isSubmitting = true
    createSchedule.mutate(
      {
        end: endDateTime,
        center_id: $centerId!,
        memo: memo,
        room_id: form.selectedRoom?.id,
        schedule_type: 'meeting',
        start: startDateTime,
        title: title.trim()
      },
      {
        onSuccess() {
          snackbarStore.success('스케줄 생성을 완료했어요!')
          history.back()
        },
        onError(error: unknown) {
          const mapped = extractFieldErrors(error)
          if (mapped) {
            fieldErrors = mapped
          } else {
            snackbarStore.error(extractApiError(error))
          }
        },
        onSettled() {
          isSubmitting = false
        }
      }
    )
  }

  onMount(() => {
    const { searchParams } = page.url
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    if (dateParam) {
      const date = parseDateParam(dateParam)
      if (!isNaN(date.getTime())) {
        form.selectedDate = date
      }
    } else {
      form.selectedDate = new Date()
    }
    if (timeParam) {
      form.startAt = timeParam
      const [h, m] = timeParam.split(':').map(Number)
      const end = new Date()
      end.setHours(h, m + 30, 0, 0)
      form.endAt = `${String(end.getHours()).padStart(2, '0')}:${String(
        end.getMinutes()
      ).padStart(2, '0')}`
    }

    // Agent page tool 등록 (Agent가 아닌 일반 접근에서는 호출되지 않음)
    registerOperationReceiveTools(
      {
        get selectedDate() {
          return form.selectedDate
        },
        set selectedDate(v) {
          form.selectedDate = v
        },
        get selectedRoom() {
          return form.selectedRoom
        },
        set selectedRoom(v) {
          form.selectedRoom = v
        },
        get startAt() {
          return form.startAt
        },
        set startAt(v) {
          form.startAt = v
        },
        get endAt() {
          return form.endAt
        },
        set endAt(v) {
          form.endAt = v
        },
        getTitle: () => title,
        setTitle: (v) => {
          title = v
        },
        getMemo: () => memo,
        setMemo: (v) => {
          memo = v
        }
      },
      () => roomList
    )
  })

  onDestroy(() => {
    if (browser) pageToolRegistry.unregisterAll()
  })
</script>

<div in:fade class="flex flex-col h-screen">
  <main class="relative flex flex-1 overflow-hidden">
    <div class="grow bg-gray-50 flex flex-col pl-12 pr-24">
      <div class="flex grow flex-col overflow-y-auto pb-6">
        <div class="flex items-center gap-3 pt-5 pb-4">
          <button
            onclick={() => {
              history.back()
            }}
            class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="뒤로가기"
          >
            <ArrowBackIcon />
          </button>

          <Typography variant="headline-01-normal-semibold">
            운영 일정 등록하기
          </Typography>
        </div>
        <!-- 폼 카드 -->
        <div
          class="rounded-2xl grow border flex flex-col items-center border-gray-200 bg-white px-6 py-10"
        >
          <div class="max-w-187 space-y-6">
            <section data-field="title">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-700"
                className="mb-3"
              >
                일정 제목 <span class="field-required">*</span>
              </Typography>
              <input
                type="text"
                bind:value={title}
                placeholder="일정 제목을 입력해주세요"
                maxlength="200"
                class={twMerge(
                  'text-body-01-normal-regular h-12 w-full rounded-lg border px-2.5',
                  'focus:outline-none',
                  fieldErrors.title
                    ? 'border-status-danger focus:border-status-danger'
                    : 'border-gray-200 focus:border-border-active'
                )}
                oninput={() => {
                  if (fieldErrors.title)
                    fieldErrors = { ...fieldErrors, title: undefined }
                }}
              />
              <p class="mt-1 field-help is-error">
                {fieldErrors.title ?? ''}
              </p>
            </section>
            <div data-field="room">
              <RoomSection
                {roomList}
                selectedRoom={form.selectedRoom}
                onSelectRoom={(r) => {
                  form.selectedRoom = r
                }}
              />
            </div>
            <section data-field="date">
              <Typography
                variant="title-01-normal-semibold"
                color="text-gray-700"
                className="mb-3"
              >
                일정 <span class="field-required">*</span>
              </Typography>
              <DateTimePicker
                bind:selectedDate={form.selectedDate}
                bind:startAt={form.startAt}
                bind:endAt={form.endAt}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
    <div class="flex shrink-0 relative">
      <div
        class="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 flex items-center bg-gray-50"
      >
        <Tooltip text={isOpen ? '사이드 패널 닫기' : '사이드 패널 열기'}>
          <button
            onclick={() => (isOpen = !isOpen)}
            class="flex h-11 w-11 items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-white text-gray-400 shadow-[0_2px_4px_0_rgba(54,54,54,0.07)] transition-colors hover:bg-gray-50 hover:text-gray-600"
            aria-label={isOpen ? '사이드 패널 닫기' : '사이드 패널 열기'}
          >
            <div
              class="flex items-center justify-center duration-200 {isOpen
                ? ''
                : 'rotate-180'}"
            >
              <DoubleRightArrow24Icon />
            </div>
          </button>
        </Tooltip>
      </div>
      <div
        class="overflow-hidden border-l border-gray-200 bg-white shadow-[0_2px_6px_0_rgba(204,204,204,0.15)] transition-all duration-300 ease-in-out {isOpen
          ? 'w-130'
          : 'w-0 border-l-0'}"
      >
        <div
          class="flex h-full w-130 flex-col transition-opacity duration-300 {isOpen
            ? 'opacity-100'
            : 'opacity-0'}"
        >
          <div class="flex flex-col overflow-y-auto px-10 pt-10">
            <!-- 메모 섹션 -->
            <div class="mb-6" data-field="memo">
              <div class="mb-3 flex items-center gap-1">
                <MemoBlueIcon24 />
                <Typography variant="title-01-semibold" color="text-gray-800">
                  메모
                </Typography>
              </div>
              <textarea
                bind:value={memo}
                placeholder="일정에 대한 메모를 남겨주세요"
                class="h-85 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 text-body-03-reading-regular text-gray-700 placeholder:text-placeholder focus:border-border-active focus:bg-white focus:outline-none px-3 py-3.5"
              ></textarea>
            </div>
            <Typography
              variant="title-01-semibold"
              color="text-gray-800"
              className="mb-3"
            >
              아래 내용으로 접수할게요
            </Typography>
            <!-- 요약 섹션 -->
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="space-y-4">
                <div class="flex items-start">
                  <Typography
                    variant="body-02-regular"
                    color="text-gray-400"
                    className="w-20 shrink-0"
                  >
                    제목
                  </Typography>
                  <Typography variant="body-02-medium" color="text-gray-700">
                    {title || '-'}
                  </Typography>
                </div>
                <div class="flex items-start">
                  <Typography
                    variant="body-02-regular"
                    color="text-gray-400"
                    className="w-20 shrink-0"
                  >
                    일정
                  </Typography>
                  <Typography variant="body-02-medium" color="text-gray-700">
                    {#if form.selectedDate}
                      {dateToString(form.selectedDate, 'YYYY-MM-DD (d)')}
                      {form.startAt}
                      {#if form.endAt}
                        ~ {form.endAt}
                      {/if}
                      {#if isOutsideOperatingHours}
                        <!-- 인라인 경고 표시 — 색은 배너와 같은 status-warning.
                             이모지(⚠️)는 색을 따라오지 못해 쓰지 않는다 -->
                        <span
                          class="ml-1 text-label-01-normal-medium text-status-warning"
                          >운영시간 외</span
                        >
                      {/if}
                    {:else}
                      -
                    {/if}
                  </Typography>
                </div>
                <div class="flex items-start">
                  <Typography
                    variant="body-02-regular"
                    color="text-gray-400"
                    className="w-20 shrink-0"
                  >
                    장소
                  </Typography>
                  <Typography variant="body-02-medium" color="text-gray-700">
                    {form.selectedRoom?.name || '-'}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
          <!-- 푸터 영역 -->
          <div class="px-10 py-6">
            <!-- 알림톡 발송 체크박스 -->
            <!-- <div class="mb-6 flex items-center gap-2">
              <Checkbox
                id="sendNotification"
                checked={sendNotification}
                onchange={() =>
                  (form.sendNotification = !form.sendNotification)}
              />
              <label for="sendNotification" class="cursor-pointer">
                <Typography variant="body-01-regular" color="text-gray-800">
                  접수 알림톡 발송
                </Typography>
              </label>
            </div> -->
            <!-- 버튼들 -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                onclick={() => history.back()}
                class="flex h-13 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Typography variant="title-01-semibold" color="text-gray-700">
                  취소
                </Typography>
              </button>
              <button
                type="button"
                onclick={handleSubmit}
                disabled={isSubmitting}
                class={twMerge(
                  'flex h-13 flex-1 items-center justify-center rounded-lg transition-colors',
                  isSubmitting
                    ? 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                )}
              >
                <Typography variant="title-01-semibold" color="text-white">
                  {isSubmitting ? '처리 중...' : '등록'}
                </Typography>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
