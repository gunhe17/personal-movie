<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'

  // Components
  import Typography from '@common/components/Typography.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'

  // Queries
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getFormTemplate,
    type FormSchema
  } from '$lib/hooks/actions/form.action'
  import { centerId } from '$lib/stores/center.store'

  // Feature modules
  import { CENTER_EDIT_RULE } from '$lib/features/center/permissions'
  import { buildTemplateDetailInput } from '$lib/features/form/template/query-builders'
  import { mapToTemplateDetailVM } from '$lib/features/form/template/view-model'
  import { createTemplateService } from '$lib/features/form/template/template-service'
  import FormBuilder from '$lib/features/form/template/components/builder/FormBuilder.svelte'

  const queryClient = useQueryClient()
  const service = createTemplateService({ queryClient })

  const templateId = $derived($page.params.templateId ?? '')

  const detailQuery = $derived(
    queryBuilder(
      getFormTemplate,
      () => buildTemplateDetailInput($centerId!, templateId),
      {
        enabled: browser && !!$centerId && !!templateId
      }
    )
  )

  const templateDetail = $derived(
    detailQuery.data ? mapToTemplateDetailVM(detailQuery.data) : null
  )

  // 시스템 양식·비활성 양식은 편집 불가
  const isEditable = $derived(
    !!templateDetail && !templateDetail.isSystem && templateDetail.isActive
  )

  function goToDetail() {
    goto(`/center/form-templates/${templateId}`)
  }

  async function handleSave(schema: FormSchema) {
    const ok = await service.updateTemplate(templateId, schema)
    if (ok) goToDetail()
  }
</script>

<PermissionGuard rule={CENTER_EDIT_RULE} showError>
  {#if detailQuery.isLoading}
    <div class="flex h-screen items-center justify-center bg-gray-50">
      <Typography variant="body-02-normal-regular" color="text-gray-500"
        >불러오는 중...</Typography
      >
    </div>
  {:else if templateDetail && detailQuery.data && isEditable}
    <FormBuilder
      initialSchema={detailQuery.data.schema}
      name={templateDetail.name}
      version={templateDetail.version}
      onSave={handleSave}
      onCancel={goToDetail}
    />
  {:else if templateDetail}
    <div
      class="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50"
    >
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        {templateDetail.isSystem
          ? '시스템 양식은 편집할 수 없어요. 센터용으로 복제한 뒤 편집해 주세요'
          : '비활성화된 양식은 편집할 수 없어요'}
      </Typography>
      <button
        onclick={goToDetail}
        class="h-10 rounded-lg border border-gray-200 bg-white px-6 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        상세로 돌아가기
      </button>
    </div>
  {:else}
    <div class="flex h-screen items-center justify-center bg-gray-50">
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        양식을 찾을 수 없어요
      </Typography>
    </div>
  {/if}
</PermissionGuard>
