<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import type { AuthCategoryVM } from '$lib/features/authorization'
  import { groupCategories, CATEGORY_GROUPS } from '$lib/features/authorization'

  interface Props {
    modalId?: string
    closeModal?: () => void
    mode?: 'create' | 'edit'
    roleName?: string
    categories?: AuthCategoryVM[]
    accessLevel?: string
    onConfirm?: (payload: {
      roleName: string
      categories: AuthCategoryVM[]
      accessLevel: string
    }) => Promise<void> | void
  }

  let {
    modalId = '',
    closeModal = () => {},
    mode = 'create',
    roleName = '',
    categories = [],
    accessLevel = 'own',
    onConfirm = () => {}
  }: Props = $props()

  let name = $state('')
  let localAccessLevel = $state('own')
  let isSubmitting = $state(false)
  let localCategories = $state<AuthCategoryVM[]>([])
  let initialized = $state(false)

  $effect(() => {
    if (initialized) return
    name = roleName
    localAccessLevel = accessLevel
    localCategories = categories.map((c) => ({ ...c }))
    initialized = true
  })

  const groups = $derived(groupCategories(localCategories, CATEGORY_GROUPS))

  function toggleView(category: string, checked: boolean) {
    const cat = localCategories.find((c) => c.category === category)
    if (!cat) return
    cat.viewChecked = checked
    if (!checked) cat.modifyChecked = false
  }

  function toggleModify(category: string, checked: boolean) {
    const cat = localCategories.find((c) => c.category === category)
    if (!cat) return
    cat.modifyChecked = checked
    if (checked) cat.viewChecked = true
  }

  async function handleConfirm() {
    if (isSubmitting) return
    if (!name.trim()) return
    isSubmitting = true
    try {
      await onConfirm?.({
        roleName: name.trim(),
        categories: localCategories,
        accessLevel: localAccessLevel
      })
      closeModal()
    } finally {
      isSubmitting = false
    }
  }

  function getGroupLabel(label: string) {
    if (label === '상담 · 검사 관리') return '상담 · 검사관리'
    return label
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showCloseButton={true}
  showHeaderBorder={true}
  showFooterBorder={true}
  size="md"
  headerClass="px-5 py-4"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet header()}
    <div class="w-full flex items-center justify-between">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        {mode === 'create' ? '역할을 추가할게요' : '역할을 수정할게요'}
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        역할명
      </Typography>
      <input
        type="text"
        bind:value={name}
        placeholder="역할명을 입력해주세요"
        class="field-input w-full"
      />

      <div class="mt-6">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          접근 범위
        </Typography>
        <!-- 컨트롤↔레이블 8 · 선택지끼리 24 이상 (§checkbox/radio) —
             선택지 사이가 좁으면 어느 레이블이 어느 동그라미의 것인지 안 갈린다 -->
        <div class="flex items-center gap-6">
          <label
            class="text-body-01-normal-medium text-body-default flex cursor-pointer items-center gap-2"
          >
            <input
              type="radio"
              name="access-level"
              checked={localAccessLevel === 'all'}
              onchange={() => (localAccessLevel = 'all')}
            />
            전체 내담자
          </label>
          <label
            class="text-body-01-normal-medium text-body-default flex cursor-pointer items-center gap-2"
          >
            <input
              type="radio"
              name="access-level"
              checked={localAccessLevel === 'own'}
              onchange={() => (localAccessLevel = 'own')}
            />
            담당 내담자만
          </label>
        </div>
      </div>

      <div class="mt-6 border-t border-gray-100 pt-6">
        <Typography
          variant="title-01-normal-semibold"
          color="text-title-default"
          className="mb-4"
        >
          허용할 권한을 선택해주세요
        </Typography>

        <!-- pr-1 제거 — 좌우 패딩이 어긋나 본문 우측선이 헤더·푸터와 안 맞았다 -->
        <div class="space-y-8">
          {#each groups as group}
            <div>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-4"
              >
                {getGroupLabel(group.label)}
              </Typography>
              <div
                class="grid h-10 items-center bg-gray-50 px-4 text-body-03-normal-medium text-gray-500"
                style="grid-template-columns: 1fr 6rem 6rem;"
              >
                <span>메뉴</span>
                <span class="text-center">조회</span>
                <span class="text-center">편집</span>
              </div>
              {#each group.categories as cat}
                <div
                  class="grid min-h-13 items-center border-b border-gray-100 px-4 [content-visibility:auto] [contain-intrinsic-size:auto_3.25rem]"
                  style="grid-template-columns: 1fr 6rem 6rem;"
                >
                  <span class="text-body-01-normal-regular text-body-default">
                    {cat.label}
                  </span>
                  <div class="flex items-center justify-center gap-2">
                    {#if cat.hasView}
                      {#if mode === 'create'}
                        <Checkbox
                          id={`view-${cat.category}`}
                          checked={cat.viewChecked}
                          onchange={(checked) =>
                            toggleView(cat.category, checked)}
                          boxClass="h-4 w-4"
                          containerClass="h-4 w-4"
                        />
                      {:else}
                        <span
                          class="text-body-03-normal-medium {cat.viewChecked
                            ? 'text-primary-500'
                            : 'text-status-danger'}"
                          >{cat.viewChecked ? '허용' : '제한'}</span
                        >
                        <Switch
                          checked={cat.viewChecked}
                          onclick={() =>
                            toggleView(cat.category, !cat.viewChecked)}
                        />
                      {/if}
                    {:else}
                      <span
                        class="text-body-03-normal-medium text-caption-subtle"
                        >-</span
                      >
                    {/if}
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    {#if cat.hasModify}
                      {#if mode === 'create'}
                        <Checkbox
                          id={`modify-${cat.category}`}
                          checked={cat.modifyChecked}
                          onchange={(checked) =>
                            toggleModify(cat.category, checked)}
                          boxClass="h-4 w-4"
                          containerClass="h-4 w-4"
                        />
                      {:else}
                        <span
                          class="text-body-03-normal-medium {cat.modifyChecked
                            ? 'text-primary-500'
                            : 'text-status-danger'}"
                          >{cat.modifyChecked ? '허용' : '제한'}</span
                        >
                        <Switch
                          checked={cat.modifyChecked}
                          onclick={() =>
                            toggleModify(cat.category, !cat.modifyChecked)}
                        />
                      {/if}
                    {:else}
                      <span
                        class="text-body-03-normal-medium text-caption-subtle"
                        >-</span
                      >
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      disabled={isSubmitting}
      onclick={handleConfirm}
      class="h-11 min-w-24 rounded-lg bg-primary-500 px-4 text-body-01-normal-medium text-white disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
    >
      {isSubmitting ? '처리 중...' : '확인'}
    </button>
  {/snippet}
</BaseModal>
