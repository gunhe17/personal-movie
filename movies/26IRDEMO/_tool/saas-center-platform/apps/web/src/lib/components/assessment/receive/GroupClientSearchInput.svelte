<style>
  .client-multiselect-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .client-multiselect-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .client-multiselect-scroll::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: 3px;
  }
  .client-multiselect-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--color-icon-secondary);
  }
</style>

<script lang="ts">
  import { t, josa, has } from '$lib/ontology/terms'
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'
  import { portal } from '$lib/utils/positionPortal'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import type { ClientListItem } from '$lib/hooks/actions/client.action'

  /**
   * 단체 모드 전용 내담자 검색 컴포넌트.
   * - chip 없음 (선택 결과는 부모의 groupMembers 목록에 표시됨)
   * - 선택/해제 시 onToggle 콜백
   */
  interface Props {
    options: ClientListItem[]
    /** 현재 선택된 내담자 ID 목록 (체크 상태 표시용) */
    selectedIds: string[]
    placeholder?: string
    onToggle: (item: ClientListItem, isSelected: boolean) => void
    onOpen?: () => void
  }

  let {
    options,
    selectedIds,
    placeholder = `기존 ${josa(t('subject'), '을/를')} 검색해서 추가할 수 있어요`,
    onToggle,
    onOpen
  }: Props = $props()

  let searchQuery = $state('')
  let isDropdownOpen = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)

  const displayOptions = $derived(
    searchQuery.trim() === ''
      ? options
      : options.filter((c) =>
          (c.name ?? '')
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase())
        )
  )

  const isItemSelected = (id: string) => selectedIds.includes(id)

  function handleFocus() {
    isDropdownOpen = true
    onOpen?.()
  }

  function handleClose() {
    searchQuery = ''
    isDropdownOpen = false
  }
</script>

<div>
  <div class="relative">
    <input
      type="text"
      bind:this={inputEl}
      bind:value={searchQuery}
      onfocus={handleFocus}
      {placeholder}
      class="field-input w-full"
    />
  </div>
  {#if isDropdownOpen && inputEl}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 8,
        callback: () => {
          handleClose()
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000 min-w-120"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      {#if displayOptions.length > 0}
        <div
          class="client-multiselect-scroll dropdown-list max-h-72 overflow-y-auto"
        >
          {#each displayOptions as client}
            <button
              type="button"
              onclick={(e) => {
                e.preventDefault()
                onToggle(client, isItemSelected(client.id))
              }}
              class="dropdown-item h-auto justify-start gap-2 py-2"
            >
              <ClientAvatar
                profileImageUrl={client.profile_image_url}
                name={client.name}
                gender={client.gender}
                sizeClass="h-9 w-9"
                textClass="text-label-01-normal-medium"
              />
              <div
                class="flex min-w-0 flex-1 items-center gap-2 text-body-02-normal-medium"
              >
                <!-- 보호자는 배지가 아니라 이름 앞 브랜드 컬러 텍스트 —
                     이름의 수식어다(정본 = ClientCard 목록 카드) -->
                {#if client.role === 'guardian' && has('guardian')}
                  <span
                    class="shrink-0 text-body-02-normal-medium text-action-primary"
                  >
                    {t('guardian')}
                  </span>
                {/if}
                <span
                  class="shrink-0 text-body-01-normal-semibold text-body-strong truncate-safe"
                >
                  {client.name}
                </span>
                <!-- 생년월일 | 성별 = 공용 ClientBirthGender 단일 규격 -->
                <ClientBirthGender
                  birthDate={client.birth_date}
                  gender={client.gender}
                />
              </div>
              <!-- 다중선택 표시 — 공용 Checkbox와 같은 규격(20 · radius 4 · 1.5px
                   border-default). 행 전체가 토글이라 <input> 중첩은 불가해 표시용 박스다 -->
              <div
                class={twMerge(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-[1.5px] duration-200',
                  isItemSelected(client.id)
                    ? 'border-action-primary bg-action-primary'
                    : 'border-border-default'
                )}
              >
                {#if isItemSelected(client.id)}
                  <svg
                    width="13"
                    height="10"
                    viewBox="0 0 13 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M0.75 5L4.27078 9L11.75 1"
                      stroke="#fff"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </div>
            </button>
          {/each}
        </div>
        <!-- 하단 액션 바 — §Components>dropdown "적용은 회색 solid".
             파란 solid는 페이지의 Primary CTA와 같은 급으로 읽힌다.
             라벨도 다른 다중선택 드롭다운과 같은 '적용'으로 맞춘다. -->
        <div class="dropdown-footer">
          <button
            type="button"
            onclick={handleClose}
            class="dropdown-footer-apply"
          >
            적용
          </button>
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center gap-2 p-8">
          <span class="text-body-02-normal-regular text-body-default">
            {options.length === 0
              ? `등록된 ${josa(t('subject'), '이/가')} 없어요`
              : '검색 결과가 없어요'}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>
