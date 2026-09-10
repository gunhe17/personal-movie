<script lang="ts">
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import Typography from '@common/components/Typography.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getFormTemplates,
    type TemplateSummary
  } from '$lib/hooks/actions/form.action'
  import { createTemplateService } from '$lib/features/form/template/template-service'
  import { mapToTemplateVM } from '$lib/features/form/template/view-model'

  interface TemplatePick {
    id: string
    name: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    /** 이 바우처가 요구하는 서식 id 목록 (공용 원본 기준). 있으면 위로 묶어 보여준다 */
    voucherTemplateIds?: string[]
    /** 선택 시 호출. throw 하면 모달 유지 (실패 토스트는 호출부 책임) */
    onSelect: (template: TemplatePick) => Promise<void> | void
  }

  let {
    modalId = '',
    closeModal = () => {},
    voucherTemplateIds = [],
    onSelect
  }: Props = $props()

  let search = $state('')
  let linkingId = $state<string | null>(null)

  const queryClient = useQueryClient()
  // 새 양식 생성(이중 모달)은 양식 관리 페이지와 동일한 서비스 플로우 재사용
  const templateService = createTemplateService({ queryClient })

  const templatesQuery = $derived(
    queryBuilder(getFormTemplates, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )

  // 새 양식 모달의 "가져오기" 후보 = 시스템(전역) 템플릿
  const globalTemplates = $derived(
    (templatesQuery.data?.items ?? [])
      .map(mapToTemplateVM)
      .filter((t) => t.isSystem)
  )

  function openNewFormModal() {
    // 이중 모달: 검색 모달 위에 새 양식 모달이 스택으로 열림.
    // 생성 완료 시 getFormTemplates invalidate → 이 목록이 자동 갱신됨.
    templateService.openNewFormModal(globalTemplates)
  }

  const filtered = $derived(
    (templatesQuery.data?.items ?? [])
      .filter((t: TemplateSummary) => t.is_active)
      .filter(
        (t: TemplateSummary) =>
          !search.trim() ||
          t.name.toLowerCase().includes(search.trim().toLowerCase())
      )
  )

  // 바우처가 요구하는 서식 = 공용 원본 그 자체이거나, 센터가 그걸 들여온 사본.
  // 사본은 이름을 바꿔도 출처(source_template_id)로 이어지므로 여기서 함께 잡힌다.
  const required = $derived(new Set(voucherTemplateIds))
  const isRequired = (t: TemplateSummary) =>
    required.has(t.id) || (!!t.source_template_id && required.has(t.source_template_id))
  const requiredList = $derived(filtered.filter(isRequired))
  const otherList = $derived(filtered.filter((t: TemplateSummary) => !isRequired(t)))

  async function handleSelect(template: TemplateSummary) {
    if (linkingId) return
    linkingId = template.id
    try {
      await onSelect({ id: template.id, name: template.name })
      closeModal()
    } catch {
      // 연결 실패 — 모달 유지, 토스트는 호출부에서 표시
    } finally {
      linkingId = null
    }
  }
</script>

<BaseModal {modalId} {closeModal} title="서식 연결" bodyClass="p-5 pb-10">
  {#snippet body()}
    <div class="flex flex-col gap-3">
      <!-- 이름 검색 -->
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        bind:value={search}
        autofocus
        placeholder="서식 이름을 검색해주세요"
        class="text-body-02-normal-regular h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 focus:border-border-active focus:outline-none"
      />

      <!-- 서식 목록 -->
      <div class="max-h-80 min-h-40 overflow-y-auto">
        {#if templatesQuery.isLoading}
          <div class="flex h-40 items-center justify-center">
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              불러오는 중...
            </Typography>
          </div>
        {:else if filtered.length === 0}
          <div class="flex h-40 flex-col items-center justify-center gap-4">
            <Typography
              variant="body-02-normal-regular"
              color="text-body-default"
            >
              {search.trim() ? '검색 결과가 없어요' : '등록된 양식이 없어요'}
            </Typography>
            <button
              type="button"
              onclick={openNewFormModal}
              class="flex items-center gap-2 text-action-primary hover:underline"
            >
              <PlusIcon20 />
              <Typography variant="body-02-normal-medium" color="text-current">
                새 양식 등록
              </Typography>
            </button>
          </div>
        {:else}
          {#if requiredList.length}
            <p class="mb-1.5 text-label-01-normal-medium text-gray-500">
              이 바우처의 서식
            </p>
          {/if}
          <ul class="flex flex-col gap-1.5">
            {#each requiredList as template (template.id)}
              <li>
                <button
                  type="button"
                  onclick={() => handleSelect(template)}
                  disabled={!!linkingId}
                  class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div class="min-w-0 flex-1">
                    <Typography
                      variant="body-01-medium"
                      color="text-gray-800"
                      className="truncate-safe"
                    >
                      {template.name}
                    </Typography>
                    <Typography
                      variant="body-03-normal-regular"
                      color="text-gray-500"
                      className="mt-0.5 block"
                    >
                      v{template.version}{template.center_id === null
                        ? ' · 시스템 서식'
                        : ''}
                    </Typography>
                  </div>
                  {#if linkingId === template.id}
                    <Typography
                      variant="body-03-normal-medium"
                      color="text-current"
                      className="shrink-0"
                    >
                      연결 중...
                    </Typography>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
          {#if otherList.length}
            {#if requiredList.length}
              <p class="mt-4 mb-1.5 text-label-01-normal-medium text-gray-500">
                그 밖의 양식
              </p>
            {/if}
            <ul class="flex flex-col gap-1.5">
              {#each otherList as template (template.id)}
                <li>
                  <button
                    type="button"
                    onclick={() => handleSelect(template)}
                    disabled={!!linkingId}
                    class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div class="min-w-0 flex-1">
                      <Typography
                        variant="body-01-medium"
                        color="text-gray-800"
                        className="truncate-safe"
                      >
                        {template.name}
                      </Typography>
                      <Typography
                        variant="body-03-normal-regular"
                        color="text-gray-500"
                        className="mt-0.5 block"
                      >
                        v{template.version}{template.center_id === null
                          ? ' · 시스템 서식'
                          : ''}
                      </Typography>
                    </div>
                    {#if linkingId === template.id}
                      <Typography
                        variant="body-03-normal-medium"
                        color="text-primary-500"
                        className="shrink-0"
                      >
                        연결 중...
                      </Typography>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>

      <!-- 찾는 양식이 없을 때 — 새 양식 생성 (이중 모달) -->
      {#if filtered.length > 0}
        <div
          class="flex items-center justify-center gap-2 border-t border-border-subtle py-4"
        >
          <Typography
            variant="body-02-normal-regular"
            color="text-body-default"
          >
            찾는 양식이 없나요?
          </Typography>
          <button
            type="button"
            onclick={openNewFormModal}
            class="flex items-center gap-2 text-action-primary hover:underline"
          >
            <PlusIcon20 />
            <Typography variant="body-02-normal-medium" color="text-current">
              새 양식 등록
            </Typography>
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</BaseModal>
