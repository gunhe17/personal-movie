<script lang="ts">
  import { t, josa } from '$lib/ontology/terms'
  import { get } from 'svelte/store'
  import { onMount } from 'svelte'
  import { excelUploadStore } from '$lib/stores/excelUpload'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalStore } from '$lib/stores/modal'
  import { mutationBuilder } from '$lib/hooks/queries/builder'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    postValidateDuplicateClients,
    postBulkCreateFromExcel,
    type DuplicateClientResult,
    type ExcelClientRowInput
  } from '$lib/hooks/actions/client.action'
  import ExcelClientListConfirm from './ExcelClientListConfirm.svelte'
  import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    onDone: () => void // 등록 완료
    onClose: () => void // 닫기/취소
  }

  let { onDone, onClose }: Props = $props()

  let duplicateResults = $state<DuplicateClientResult[]>([])
  let isRegistering = $state(false)

  const duplicateCheck = mutationBuilder(postValidateDuplicateClients, [], [], {
    showError: false
  })
  const bulkCreate = mutationBuilder(postBulkCreateFromExcel, [], [], {
    showError: false
  })

  onMount(() => {
    const state = get(excelUploadStore)
    if (!state.clients.length) {
      onClose()
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
          results.forEach((r: any) => {
            const original = state.clients[r.index]
            if (original)
              excelUploadStore.updateClient(original.id, { id: r.client.id })
          })
          const skippedCount = results.filter((r: any) => r.skipped).length
          const registeredCount = results.length - skippedCount
          const msg =
            skippedCount > 0
              ? `${registeredCount}명 등록, ${skippedCount}명은 기존 ${t('subject')}로 처리됐어요!`
              : `${registeredCount}명의 ${josa(t('subject'), '을/를')} 등록했어요!`
          snackbarStore.success(msg)
          onDone()
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
      const descParts = []
      if (highCount > 0)
        descParts.push(
          `이름·생년월일·${t('guardian')} 정보가 같은 ${t('subject')} ${highCount}명`
        )
      if (lowCount > 0)
        descParts.push(`이름·생년월일이 같은 ${t('subject')} ${lowCount}명`)

      modalStore.open({
        component: DeleteConfirmModal,
        props: {
          title: `중복 가능성이 있는 ${josa(t('subject'), '이/가')} 있어요`,
          description: `${descParts.join(',\n')}은\n기존 ${t('subject')}로 처리되어 신규 등록에서 제외돼요.\n계속 진행할까요?`,
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

  function handleClose() {
    excelUploadStore.clear()
    onClose()
  }
</script>

<div transition:fade class="fixed inset-0 z-2000 flex flex-col bg-white">
  <ExcelClientListConfirm
    {duplicateResults}
    {isRegistering}
    onConfirm={handleConfirm}
    onCancel={handleClose}
    onClose={handleClose}
    onChangeFile={handleClose}
  />
</div>
