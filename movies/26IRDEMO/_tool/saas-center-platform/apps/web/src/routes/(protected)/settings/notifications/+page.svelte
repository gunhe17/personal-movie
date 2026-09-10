<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { onMount, type Component } from 'svelte'
  import { page } from '$app/state'
  import { centerId } from '$lib/stores/center.store'
  import { requireCenterId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getNotificationSettings,
    putNotificationSetting,
    type NotificationSettingType,
    type NotificationSettingUpsert
  } from '$lib/hooks/actions/notification.action'
  import { snackbarStore } from '$lib/stores/snackbar'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NotificationSettingRow from '$lib/features/notification/components/NotificationSettingRow.svelte'
  import TestIcon20 from '$lib/assets/TestIcon20.svelte'
  import Counsel20Icon from '$lib/assets/Counsel20Icon.svelte'
  import Megaphone20 from '$lib/assets/Megaphone20.svelte'
  import CircleCautionOrangeIcon20 from '$lib/assets/CircleCautionOrangeIcon20.svelte'
  import {
    SETTING_CATEGORY_OPTIONS,
    EVENT_GROUPS,
    type EventGroup
  } from '$lib/features/notification/constants'

  /**
   * 카테고리 아이콘 — 앱 기본 듀오톤 아이콘(에셋 네이티브 20)을 쓴다.
   * 색은 아이콘 자신이 갖고, 타일은 중립(gray-100)이다 — 대시보드 배너와 같은 선례.
   */
  const CATEGORY_ICONS: Record<string, Component> = {
    assessment: TestIcon20,
    counseling: Counsel20Icon,
    system: Megaphone20
  }

  /** 하단 '확인해주세요!' 문구 — 마크업이 아니라 데이터로 둔다(행 규격은 한 곳) */
  const NOTICE_TEXTS = [
    '이 설정은 본인 계정에만 적용됩니다.',
    '그룹별 설정이 없으면 카테고리 전체 설정을 따릅니다.',
    '알림을 끄더라도 중요한 시스템 알림은 수신될 수 있습니다.'
  ]

  const queryClient = useQueryClient()

  const settingsQuery = queryBuilder(
    getNotificationSettings,
    () => ({ center_id: $centerId ?? '' }),
    () => ({ enabled: !!$centerId })
  )

  const settings = $derived<NotificationSettingType[]>(
    (settingsQuery.data as any)?.items ?? []
  )
  const isLoading = $derived(settingsQuery.isPending)

  // 카테고리 전체 설정 (event_type이 null인 것)
  const categoryMap = $derived.by(() => {
    const map = new Map<string, NotificationSettingType>()
    for (const s of settings) {
      if (!s.event_type) {
        map.set(s.category, s)
      }
    }
    return map
  })

  // 이벤트별 설정 ("category:event_type" → setting)
  const eventMap = $derived.by(() => {
    const map = new Map<string, NotificationSettingType>()
    for (const s of settings) {
      if (s.event_type) {
        map.set(`${s.category}:${s.event_type}`, s)
      }
    }
    return map
  })

  let savingKeys = $state(new Set<string>())
  let expandedCategories = $state(new Set<string>())

  function isCategoryEnabled(category: string): boolean {
    const setting = categoryMap.get(category)
    if (!setting) return true // 설정 없으면 기본 ON
    return setting.channel_in_app
  }

  function isGroupEnabled(category: string, group: EventGroup): boolean {
    // 카테고리(마스터)가 꺼져 있으면 하위 그룹은 저장값과 무관하게 전부 OFF.
    // 저장값은 지우지 않는다 — 마스터를 다시 켜면 원래 설정으로 돌아온다.
    if (!isCategoryEnabled(category)) return false

    // 그룹 내 모든 이벤트가 활성이면 ON, 하나라도 꺼져있으면 OFF
    return group.eventTypes.every((et) => {
      const eventSetting = eventMap.get(`${category}:${et}`)
      if (eventSetting) return eventSetting.channel_in_app
      // 이벤트별 설정이 없으면 카테고리 설정으로 fallback
      return isCategoryEnabled(category)
    })
  }

  function toggleExpand(category: string) {
    const groups = EVENT_GROUPS[category] ?? []
    if (groups.length === 0) return
    const next = new Set(expandedCategories)
    if (next.has(category)) {
      next.delete(category)
    } else {
      next.add(category)
    }
    expandedCategories = next
  }

  async function handleCategoryToggle(category: string, currentValue: boolean) {
    const existing = categoryMap.get(category)
    const payload: NotificationSettingUpsert = {
      category,
      event_type: null,
      channel_in_app: !currentValue,
      channel_push: existing?.channel_push ?? false,
      channel_alarmtalk: existing?.channel_alarmtalk ?? false
    }

    const key = category
    savingKeys = new Set([...savingKeys, key])

    try {
      await putNotificationSetting().request({
        center_id: requireCenterId(),
        payload
      })
      queryClient.invalidateQueries({
        queryKey: ['getNotificationSettings'],
        exact: false
      })
    } catch {
      snackbarStore.error('알림 설정 변경에 실패했습니다.')
    } finally {
      savingKeys = new Set([...savingKeys].filter((k) => k !== key))
    }
  }

  async function handleGroupToggle(
    category: string,
    group: EventGroup,
    currentValue: boolean
  ) {
    const categorySetting = categoryMap.get(category)
    const newValue = !currentValue
    const groupKey = `${category}:${group.key}`

    // 그룹 내 모든 이벤트 키를 saving 상태로
    const eventKeys = group.eventTypes.map((et) => `${category}:${et}`)
    savingKeys = new Set([...savingKeys, groupKey, ...eventKeys])

    try {
      const cid = requireCenterId()
      // 그룹 내 모든 이벤트를 동시에 upsert
      await Promise.all(
        group.eventTypes.map((eventType) => {
          const eventSetting = eventMap.get(`${category}:${eventType}`)
          const payload: NotificationSettingUpsert = {
            category,
            event_type: eventType,
            channel_in_app: newValue,
            channel_push:
              eventSetting?.channel_push ??
              categorySetting?.channel_push ??
              false,
            channel_alarmtalk:
              eventSetting?.channel_alarmtalk ??
              categorySetting?.channel_alarmtalk ??
              false
          }
          return putNotificationSetting().request({ center_id: cid, payload })
        })
      )
      queryClient.invalidateQueries({
        queryKey: ['getNotificationSettings'],
        exact: false
      })
    } catch {
      snackbarStore.error('알림 설정 변경에 실패했습니다.')
    } finally {
      savingKeys = new Set(
        [...savingKeys].filter((k) => k !== groupKey && !eventKeys.includes(k))
      )
    }
  }

  // ============ Push 알림 ============

  /** 브라우저 알림 권한 상태 */
  let pushPermission = $state<NotificationPermission>('default')
  /** Push 토글 저장 중 */
  let pushSaving = $state(false)
  /** Firebase 사용 가능 여부 (서버에서 전달) */
  const firebaseAvailable = $derived(!!page.data.firebaseAvailable)

  /** 전체 설정 기준 Push 활성 여부 (카테고리 '*') */
  const isPushEnabled = $derived.by(() => {
    const globalSetting = categoryMap.get('*')
    return globalSetting?.channel_push ?? false
  })

  onMount(() => {
    // 브라우저 Notification API 지원 여부
    if ('Notification' in window) {
      pushPermission = Notification.permission
    }
  })

  async function handlePushToggle() {
    pushSaving = true

    try {
      if (!isPushEnabled) {
        // Push 활성화: 브라우저 권한 요청 → 토큰 등록 → 설정 저장
        const { requestAndRegisterPush } = await import(
          '$lib/services/firebase/messaging'
        )
        const permission = await requestAndRegisterPush()
        pushPermission = permission

        if (permission !== 'granted') {
          if (permission === 'denied') {
            snackbarStore.error('브라우저 설정에서 알림을 허용해주세요.')
          }
          return
        }
      }

      // 서버 설정 업데이트
      const existing = categoryMap.get('*')
      const payload: NotificationSettingUpsert = {
        category: '*',
        event_type: null,
        channel_in_app: existing?.channel_in_app ?? true,
        channel_push: !isPushEnabled,
        channel_alarmtalk: existing?.channel_alarmtalk ?? false
      }

      await putNotificationSetting().request({
        center_id: requireCenterId(),
        payload
      })
      queryClient.invalidateQueries({
        queryKey: ['getNotificationSettings'],
        exact: false
      })
      snackbarStore.success(
        !isPushEnabled
          ? '푸시 알림이 활성화되었습니다.'
          : '푸시 알림이 비활성화되었습니다.'
      )
    } catch {
      snackbarStore.error('푸시 알림 설정 변경에 실패했습니다.')
    } finally {
      pushSaving = false
    }
  }
</script>

<!--
  설정 카드 = 콘텐츠 컨테이너 표준(rounded-2xl · border-gray-200 · shadow-card).
  행이 스스로 가장자리(목록 인셋 12 + 행 패딩 12 = 카드 기준선 24)를 관리하는
  프레임 컨테이너라 바깥 패딩을 두지 않는다 (Web_Design.md §Layout Patterns).
-->
<div in:fade class="mx-auto flex w-full max-w-[640px] flex-col">
  <PageTitleSection title="알림 설정" className="mb-4" />

  {#if isLoading}
    <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
      <Typography variant="body-02-normal-regular" color="text-body-subtle">
        로딩 중...
      </Typography>
    </div>
  {:else}
    <!-- 카드 ↔ 카드 = 구분 간격 24 (§Spacing 그룹핑 vs 구분) -->
    <div class="flex flex-col gap-6">
      <!-- 알림 수신 — 카드 제목 없이 행부터 시작한다(페이지 타이틀이 이미 '알림 설정') -->
      <section class="rounded-2xl border border-gray-200 bg-white shadow-card">
        <div class="p-3">
          {#each SETTING_CATEGORY_OPTIONS as option, i (option.value)}
            {@const category = option.value}
            {@const enabled = isCategoryEnabled(category)}
            {@const groups = EVENT_GROUPS[category] ?? []}
            {@const hasGroups = groups.length > 0}
            {@const isExpanded = expandedCategories.has(category)}
            {@const CategoryIcon = CATEGORY_ICONS[category]}

            <!-- 카테고리 행은 라벨만 — 세부 항목이 아코디언에 그대로 나와 설명이 중복이다 -->
            <NotificationSettingRow
              title={option.label}
              checked={enabled}
              saving={savingKeys.has(category)}
              expandable={hasGroups}
              expanded={isExpanded}
              chevronSlot
              onExpand={() => toggleExpand(category)}
              onToggle={() => handleCategoryToggle(category, enabled)}
              ariaLabel="{option.label} 알림"
            >
              {#snippet icon()}
                <CategoryIcon />
              {/snippet}
            </NotificationSettingRow>

            <!-- 그룹별 세부 토글 — 좌측 인셋 48 + 행 패딩 12 = 상위 행 타이틀과 같은 축 -->
            {#if isExpanded && hasGroups}
              <div transition:slide={{ duration: 200 }} class="mb-2 ml-12">
                {#each groups as group (group.key)}
                  {@const groupEnabled = isGroupEnabled(category, group)}
                  <NotificationSettingRow
                    level="group"
                    title={group.label}
                    description={group.description}
                    checked={groupEnabled}
                    saving={savingKeys.has(`${category}:${group.key}`)}
                    disabled={!enabled}
                    chevronSlot
                    onToggle={() =>
                      handleGroupToggle(category, group, groupEnabled)}
                    ariaLabel="{option.label} {group.label} 알림"
                  />
                {/each}
              </div>
            {/if}

            {#if i < SETTING_CATEGORY_OPTIONS.length - 1}
              <div class="mx-3 h-px bg-border-subtle"></div>
            {/if}
          {/each}
        </div>
      </section>

      <!-- 푸시 알림 -->
      {#if firebaseAvailable}
        <section
          class="rounded-2xl border border-gray-200 bg-white shadow-card"
        >
          <header class="px-6 pt-6">
            <Typography
              variant="title-01-normal-semibold"
              color="text-title-default"
              tag="h2"
            >
              푸시 알림
            </Typography>
            <Typography
              variant="body-03-normal-regular"
              color="text-body-subtle"
              className="mt-1"
            >
              브라우저를 사용하지 않을 때에도 알림을 받을 수 있습니다.
            </Typography>
          </header>

          <div class="p-3">
            {#if pushPermission === 'denied'}
              <!-- 브라우저 차단 = 화면에서 켤 수 없는 상태 → 토글 대신 경고 안내 -->
              <div
                class="flex items-start gap-2 rounded-xl bg-status-warning-bg p-4"
              >
                <span class="flex shrink-0 pt-px">
                  <CircleCautionOrangeIcon20 />
                </span>
                <div class="min-w-0">
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-body-strong"
                  >
                    알림이 차단되어 있습니다
                  </Typography>
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-body-subtle"
                    className="mt-1"
                  >
                    브라우저 설정에서 이 사이트의 알림을 허용으로 변경해주세요.
                  </Typography>
                </div>
              </div>
            {:else}
              <NotificationSettingRow
                title="브라우저 푸시 알림"
                description={isPushEnabled
                  ? '활성화됨 — 새 알림이 도착하면 브라우저 알림을 표시합니다.'
                  : '비활성화됨 — 푸시 알림을 받으려면 활성화해주세요.'}
                checked={isPushEnabled}
                saving={pushSaving}
                onToggle={handlePushToggle}
                ariaLabel="브라우저 푸시 알림"
              />
            {/if}
          </div>
        </section>
      {/if}

      <!--
        확인해주세요! — 배경 면을 두지 않는다. 페이지 캔버스가 gray-50(bg-base)이라
        같은 색 well은 보이지 않고, 강조 면은 설정 카드에만 둔다.
      -->
      <section class="flex flex-col gap-3 pb-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          확인해주세요!
        </Typography>
        <ul class="flex flex-col gap-2">
          {#each NOTICE_TEXTS as text (text)}
            <li class="flex items-start gap-2">
              <!-- 불릿은 첫 줄(행간 14) 중앙에 맞춘다 -->
              <span class="flex h-3.5 shrink-0 items-center">
                <span class="size-1 rounded-full bg-caption-subtle"></span>
              </span>
              <Typography
                variant="body-03-normal-regular"
                color="text-body-subtle"
              >
                {text}
              </Typography>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {/if}
</div>
