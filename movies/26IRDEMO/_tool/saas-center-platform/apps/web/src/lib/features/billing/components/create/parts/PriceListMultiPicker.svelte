<!--
  PriceListMultiPicker

  단가표(price list)에서 청구 항목을 체크박스로 즉시 토글하는 드롭다운.
  - 토글 버튼 → 펼침 영역에 검색 + 체크박스 리스트
  - 체크하는 순간 onPick 호출 (라인 추가), 해제하는 순간 onUnpick 호출 (라인 제거)
  - 이미 라인에 들어있는 항목은 처음부터 체크된 상태로 표시
-->
<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { portal } from '$lib/utils/positionPortal'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import { SERVICE_TYPE_LABELS } from '$lib/features/billing/price-list/constants'
  import type { PriceListResponse } from '$lib/hooks/actions/priceList.action'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import Counsel24Icon from '$lib/assets/Counsel24Icon.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import PackageSettingIcon from '$lib/assets/PackageSettingIcon.svelte'

  interface Props {
    options: PriceListResponse[]
    /** 이미 라인에 들어있는 priceListId 집합 — 체크 상태로 반영 */
    existingPriceListIds?: string[]
    onPick: (item: PriceListResponse) => void
    onUnpick: (priceListId: string) => void
  }

  let { options, existingPriceListIds = [], onPick, onUnpick }: Props = $props()

  let isOpen = $state(false)
  let searchQuery = $state('')
  let anchorEl = $state<HTMLButtonElement | null>(null)

  const filteredOptions = $derived(
    options
      .filter((p) => p.is_active)
      .filter((p) => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return true
        return (
          p.service_name.toLowerCase().includes(q) ||
          (SERVICE_TYPE_LABELS[p.service_type] ?? p.service_type)
            .toLowerCase()
            .includes(q)
        )
      })
  )

  const existingSet = $derived(new Set(existingPriceListIds))
  const selectedCount = $derived(existingSet.size)

  function toggleOpen() {
    isOpen = !isOpen
    if (!isOpen) searchQuery = ''
  }

  function toggleItem(item: PriceListResponse) {
    if (existingSet.has(item.id)) {
      onUnpick(item.id)
    } else {
      onPick(item)
    }
  }
</script>

<div class="mb-3">
  <button
    type="button"
    bind:this={anchorEl}
    onclick={toggleOpen}
    class="flex h-12 w-full items-center justify-between rounded-lg border bg-white py-0 pr-2 pl-3 text-left transition-colors {isOpen
      ? 'border-primary-400'
      : 'border-border-default hover:border-border-strong'}"
  >
    <Typography variant="body-02-normal-regular" color="text-placeholder">
      단가표에서 항목 선택
    </Typography>
    <span class="flex items-center gap-2">
      {#if selectedCount > 0}
        <span
          class="flex h-6 items-center rounded-full bg-primary-50 px-2 text-label-02-normal-medium text-primary-600"
        >
          {selectedCount}개 추가됨
        </span>
      {/if}
      <ArrowDownIcon20
        class="shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
      />
    </span>
  </button>

  {#if isOpen && anchorEl}
    <div
      use:portal={{
        anchor: anchorEl,
        offset: 4,
        zIndex: 10001,
        callback: () => {
          isOpen = false
          searchQuery = ''
        }
      }}
      class="dropdown-panel overflow-hidden"
    >
      <!-- 검색 -->
      <div class="shrink-0 border-b border-gray-100 pb-2">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="검색어를 입력해주세요"
          class="field-input w-full"
        />
      </div>

      <!-- 리스트 -->
      <div class="min-h-0 flex-1 overflow-y-auto pt-1">
        {#if filteredOptions.length === 0}
          <div class="flex items-center justify-center py-10">
            <Typography
              variant="body-02-normal-medium"
              color="text-caption-subtle"
            >
              {options.length === 0
                ? '활성화된 단가표 항목이 없어요'
                : '검색 결과가 없어요'}
            </Typography>
          </div>
        {:else}
          <ul class="dropdown-list">
            {#each filteredOptions as item (item.id)}
              {@const isChecked = existingSet.has(item.id)}
              <li>
                <button
                  type="button"
                  onclick={() => toggleItem(item)}
                  class="dropdown-item justify-start gap-3 {isChecked
                    ? 'is-selected'
                    : ''}"
                >
                  <!-- 체크박스 -->
                  <Checkbox
                    id={`price-list-${item.id}`}
                    checked={isChecked}
                    readonly
                  />

                  <!-- 타입 아이콘 -->
                  <span
                    class="flex size-6 shrink-0 items-center justify-center
                      {item.service_type === 'counseling'
                      ? 'text-tag-blue-fg'
                      : item.service_type === 'assessment'
                        ? 'text-tag-purple-fg'
                        : 'text-tag-amber-fg'}"
                    aria-label={SERVICE_TYPE_LABELS[item.service_type] ??
                      item.service_type}
                  >
                    {#if item.service_type === 'counseling'}
                      <Counsel24Icon />
                    {:else if item.service_type === 'assessment'}
                      <AssessmentStack />
                    {:else}
                      <PackageSettingIcon />
                    {/if}
                  </span>

                  <!-- 본문 -->
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-body-default"
                      tag="span"
                      className="truncate-safe"
                    >
                      {item.service_name}
                    </Typography>
                  </div>

                  <!-- 단가 -->
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-body-subtle"
                    tag="span"
                    className="shrink-0"
                  >
                    {item.unit_price.toLocaleString()}원
                  </Typography>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- 다중선택 액션 바 — 접수일 필터와 동일 규격 -->
      <div class="dropdown-footer justify-between">
        <Typography variant="body-02-normal-medium" color="text-body-subtle">
          {selectedCount}개 추가됨
        </Typography>
        <button
          type="button"
          class="dropdown-footer-apply"
          onclick={toggleOpen}
        >
          적용
        </button>
      </div>
    </div>
  {/if}
</div>
