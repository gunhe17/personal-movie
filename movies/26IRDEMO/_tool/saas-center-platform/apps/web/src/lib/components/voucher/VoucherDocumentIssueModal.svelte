<script lang="ts">
  /**
   * 서류 준비 — 선택한 내담자들에게 서식을 일괄 발급한다.
   *
   * 발급·연결은 한 번에 끝나지만 **작성은 개인값**이라 순차다(모달에서 고지).
   * 서식별 `미발급 n명`은 선택된 바우처들의 연결 서류를 열 때 병렬 조회해 계산한다
   * (센터 전체 집계 API가 없어 '선택분만' 조회 — 선택 인원이 소수인 전제).
   */
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import {
    getFormTemplates,
    getVoucherFormInstances,
    postLinkVoucherFormInstance,
    type TemplateSummary
  } from '$lib/hooks/actions/form.action'

  interface TargetRow {
    /** client_voucher_id */
    id: string
    name: string
  }

  interface Props {
    centerId: string
    rows: TargetRow[]
    onClose: () => void
    /** 발급이 하나라도 성공하면 호출 (목록 invalidate 등) */
    onIssued?: () => void
  }

  let { centerId, rows, onClose, onIssued }: Props = $props()

  let loading = $state(true)
  let issuing = $state(false)
  let templates = $state<TemplateSummary[]>([])
  /** client_voucher_id → 이미 연결된 template_id 집합 */
  let issuedMap = $state<Map<string, Set<string>>>(new Map())
  let checkedTemplateIds = $state<string[]>([])
  let openAfterIssue = $state(false)

  const missingCountOf = (templateId: string) =>
    rows.filter((r) => !issuedMap.get(r.id)?.has(templateId)).length

  $effect(() => {
    let alive = true
    loading = true
    ;(async () => {
      try {
        const [templateRes, instanceResults] = await Promise.all([
          getFormTemplates().request({ centerId }),
          Promise.all(
            rows.map((r) =>
              getVoucherFormInstances()
                .request({ centerId, clientVoucherId: r.id })
                .then((res) => [r.id, res.items] as const)
                .catch(() => [r.id, []] as const)
            )
          )
        ])
        if (!alive) return

        templates = (templateRes.items ?? []).filter((t) => t.is_active)
        const map = new Map<string, Set<string>>()
        for (const [voucherId, items] of instanceResults) {
          map.set(voucherId, new Set(items.map((i) => i.instance.template_id)))
        }
        issuedMap = map
        // 기본 선택 = 아직 미발급이 남은 서식만
        checkedTemplateIds = templates
          .filter((t) => rows.some((r) => !map.get(r.id)?.has(t.id)))
          .map((t) => t.id)
      } catch {
        if (alive) snackbarStore.error('서식 목록을 불러오지 못했어요')
      } finally {
        if (alive) loading = false
      }
    })()
    return () => {
      alive = false
    }
  })

  const toggleTemplate = (id: string) => {
    checkedTemplateIds = checkedTemplateIds.includes(id)
      ? checkedTemplateIds.filter((v) => v !== id)
      : [...checkedTemplateIds, id]
  }

  const issue = async () => {
    if (issuing || checkedTemplateIds.length === 0) return
    issuing = true

    // 이미 연결된 (행 × 서식)은 건너뛴다 — 중복 발급 방지
    const jobs = rows.flatMap((row) =>
      checkedTemplateIds
        .filter((templateId) => !issuedMap.get(row.id)?.has(templateId))
        .map((templateId) => ({ row, templateId }))
    )

    if (jobs.length === 0) {
      snackbarStore.info('선택한 서식은 이미 모두 발급돼 있어요')
      issuing = false
      return
    }

    const results = await Promise.allSettled(
      jobs.map((job) =>
        postLinkVoucherFormInstance().request({
          centerId,
          clientVoucherId: job.row.id,
          templateId: job.templateId
        })
      )
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    issuing = false

    if (failed === results.length) {
      snackbarStore.error('서류 발급에 실패했어요')
      return
    }
    onIssued?.()
    if (failed > 0) {
      snackbarStore.error(
        `${results.length - failed}건 발급했고 ${failed}건은 실패했어요`
      )
    } else {
      snackbarStore.success(
        `${rows.length}명에게 서식 ${checkedTemplateIds.length}종을 발급했어요`
      )
    }
    onClose()
  }
</script>

<div
  class="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-6"
  transition:fade={{ duration: 120 }}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={onClose} aria-hidden="true"></div>
  <div
    class="relative flex max-h-[80vh] w-135 flex-col overflow-hidden rounded-[20px] bg-white shadow-xl"
  >
    <BaseModal
      closeModal={onClose}
      headerClass="px-5 py-4 items-start"
      bodyClass="p-5 pb-7"
    >
      {#snippet header()}
        <div class="flex flex-col gap-2">
          <Typography
            variant="headline-02-normal-semibold"
            color="text-gray-800"
          >
            서류 준비
          </Typography>
          <Typography variant="body-02-normal-regular" color="text-gray-500">
            선택한 {rows.length}명에게 발급할 서식을 고르세요
          </Typography>
        </div>
      {/snippet}

      {#snippet body()}
        <div class="flex flex-col gap-6">
          {#if loading}
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-400"
              className="block py-6 text-center"
            >
              로딩 중...
            </Typography>
          {:else if templates.length === 0}
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-400"
              className="block py-6 text-center"
            >
              등록된 서식이 없어요 — 센터 관리 &gt; 문서 양식에서 먼저 만들어
              주세요
            </Typography>
          {:else}
            <!-- 서식 목록 — 선택 표시는 체크박스가 한다(면을 겹치지 않는다) -->
            <div class="flex flex-col gap-1">
              {#each templates as template (template.id)}
                {@const missing = missingCountOf(template.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  onclick={() => toggleTemplate(template.id)}
                  class="flex h-12 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-gray-50"
                >
                  <Checkbox
                    id={`vf-tpl-${template.id}`}
                    checked={checkedTemplateIds.includes(template.id)}
                    onchange={() => toggleTemplate(template.id)}
                  />
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-gray-800"
                    className="flex-1 truncate-safe"
                    tag="span"
                  >
                    {template.name}
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color={missing > 0 ? 'text-gray-600' : 'text-gray-400'}
                    tag="span"
                  >
                    {missing > 0 ? `미발급 ${missing}명` : '전원 발급됨'}
                  </Typography>
                </div>
              {/each}
            </div>

            <label
              class="flex cursor-pointer items-center gap-3"
              for="vf-open-after"
            >
              <Checkbox id="vf-open-after" bind:checked={openAfterIssue} />
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-700"
              >
                발급 후 첫 내담자의 서류 화면으로 이동
              </Typography>
            </label>

            <div class="rounded-lg bg-gray-50 p-4">
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
              >
                발급·연결까지는 한 번에 처리되고, 내용 작성은 내담자별로 순차
                진행됩니다.
              </Typography>
            </div>
          {/if}
        </div>
      {/snippet}

      {#snippet footer()}
        <button
          type="button"
          onclick={onClose}
          class="h-11 rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          disabled={loading || issuing || checkedTemplateIds.length === 0}
          onclick={issue}
          class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
        >
          {issuing ? '발급 중...' : `${rows.length}명에게 발급`}
        </button>
      {/snippet}
    </BaseModal>
  </div>
</div>
