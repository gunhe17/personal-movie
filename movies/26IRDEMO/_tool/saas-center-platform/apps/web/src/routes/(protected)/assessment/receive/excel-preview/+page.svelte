<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import ExcelClientListConfirm from '$lib/components/assessment/receive/ExcelClientListConfirm.svelte'
  import { excelUploadStore } from '$lib/stores/excelUpload'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalStore } from '$lib/stores/modal'
  import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
  import { mutationBuilder } from '$lib/hooks/queries/builder'

  import {
    postValidateDuplicateClients,
    postBulkCreateFromExcel,
    type DuplicateClientResult,
    type ExcelClientRowInput
  } from '$lib/hooks/actions/client.action'
  import { requireCenterId } from '$lib/stores/center.store'

  let duplicateResults = $state<DuplicateClientResult[]>([])
  let isRegistering = $state(false)

  const duplicateCheck = mutationBuilder(postValidateDuplicateClients, [], [], {
    showError: false
  })
  const bulkCreate = mutationBuilder(postBulkCreateFromExcel, [], [], {
    showError: false
  })

  function getReceiveBasePath(): string {
    return typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/assessment-flow/receive')
      ? '/assessment-flow/receive'
      : '/assessment/receive'
  }

  function getReceiveUrl(queryString: string): string {
    const base = getReceiveBasePath()
    const params = new URLSearchParams(queryString)
    params.set('type', 'group')
    return `${base}?${params.toString()}`
  }

  onMount(() => {
    const state = get(excelUploadStore)
    if (!state.clients.length) {
      goto(getReceiveUrl(''))
      return
    }
    snackbarStore.success('파일 내용을 업로드했어요!')

    const clients = state.clients.map((c) => ({
      name: c.name,
      birth_date: c.birthDate || null,
      guardian_phone: c.guardianPhone || null,
      guardian_birth_date: c.guardianBirthDate || null
    }))

    duplicateCheck.mutate(
      { centerId: requireCenterId(), clients },
      {
        onSuccess: (data: any) => {
          const raw = data?.results ?? []
          duplicateResults = raw.map((r: any) => ({
            ...r,
            clientId: state.clients[r.index]?.id ?? ''
          }))
        }
      }
    )
  })

  function hasDuplicates(): boolean {
    return duplicateResults.some(
      (r) => r.duplicate_level === 'high' || r.duplicate_level === 'low'
    )
  }

  async function doRegister() {
    isRegistering = true
    const state = get(excelUploadStore)

    const clients: ExcelClientRowInput[] = state.clients.map((c) => ({
      name: c.name,
      birth_date: c.birthDate,
      gender: c.gender as 'male' | 'female',
      guardian_name: c.guardianName || null,
      guardian_relationship: c.guardianRelationship || null,
      guardian_gender: c.guardianGender || null,
      guardian_birth_date: c.guardianBirthDate || null,
      guardian_phone: c.guardianPhone || null
    }))

    bulkCreate.mutate(
      { centerId: requireCenterId(), clients },
      {
        onSuccess: (data: any) => {
          const results = data?.results ?? []
          // store의 임시 id를 실제 DB id로 교체
          results.forEach((r: any) => {
            const original = state.clients[r.index]
            if (original) {
              excelUploadStore.updateClient(original.id, { id: r.client.id })
            }
          })
          const skippedCount = results.filter((r: any) => r.skipped).length
          const registeredCount = results.length - skippedCount
          const msg =
            skippedCount > 0
              ? `${registeredCount}명 등록, ${skippedCount}명은 기존 내담자로 처리됐어요!`
              : `${registeredCount}명의 내담자를 등록했어요!`
          snackbarStore.success(msg)
          goto(getReceiveUrl('from=excel'), { replaceState: true })
        },
        onError: () => {
          snackbarStore.error('등록 중 오류가 발생했어요. 다시 시도해주세요.')
          isRegistering = false
        }
      }
    )
  }

  function handleConfirm() {
    if (hasDuplicates()) {
      const highCount = duplicateResults.filter(
        (r) => r.duplicate_level === 'high'
      ).length
      const lowCount = duplicateResults.filter(
        (r) => r.duplicate_level === 'low'
      ).length
      const parts = []
      const descParts = []
      if (highCount > 0)
        descParts.push(`기존 내담자 ${highCount}명은 중복으로 제외`)
      if (lowCount > 0)
        descParts.push(`유사 내담자 ${lowCount}명은 그대로 등록`)

      modalStore.open({
        component: DeleteConfirmModal,
        props: {
          title: '중복 가능성이 있는 내담자가 있어요',
          description: `${descParts.join(',\n')}돼요.\n계속 진행할까요?`,
          cancelText: '취소',
          confirmText: '등록',
          targetId: 'confirm',
          onConfirm: () => doRegister()
        },
        options: { customWidth: 420 }
      })
    } else {
      doRegister()
    }
  }

  function handleCancel() {
    excelUploadStore.clear()
    goto(getReceiveUrl('from=excel-change'))
  }

  function handleClose() {
    excelUploadStore.clear()
    goto(getReceiveUrl('from=excel-change'))
  }

  function handleChangeFile() {
    excelUploadStore.clear()
    goto(getReceiveUrl('from=excel-change'))
  }
</script>

<div class="flex h-screen flex-col bg-white">
  <ExcelClientListConfirm
    {duplicateResults}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
    onClose={handleClose}
    onChangeFile={handleChangeFile}
  />
</div>
