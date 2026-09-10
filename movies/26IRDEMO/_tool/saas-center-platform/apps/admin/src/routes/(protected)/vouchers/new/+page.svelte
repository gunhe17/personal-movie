<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Input from '$components/Input.svelte'
  import { mutationBuilder } from '$hooks/queries/builder'
  import {
    postCreateVoucher,
    type AdminVoucherCreateLinkPayload
  } from '$hooks/actions/voucher.action'
  import { modalStore } from '$stores/modal'
  import LinkModal from '$lib/features/voucher/components/LinkModal.svelte'
  import { showErrorMessage } from '$utils/errorHandler'
  import { fade } from 'svelte/transition'

  type PendingDocLink = AdminVoucherCreateLinkPayload & {
    /** 미리보기 표시용 자료 메타 (저장 안 됨) */
    document: { id: string; name: string; file_type: string }
  }

  // ─── 폼 상태 ───
  let name = $state('')
  let programName = $state('')
  let programOrganization = $state('')
  let programYear = $state<string>(String(new Date().getFullYear()))

  let usageStartDate = $state('')
  let usageEndDate = $state('')
  let applicationMethod = $state('')
  let applicationStartDate = $state('')
  let applicationEndDate = $state('')

  let supportAmount = $state('')
  let supportScope = $state('')
  let supportTarget = $state('')
  let contact = $state('')

  // ─── 연결할 자료 (선택, pending — 등록 시점에 같이 보냄) ───
  let pendingLinks = $state<PendingDocLink[]>([])

  function openAddLinkModal() {
    const excludeIds = pendingLinks.map((l) => l.global_document_id)
    modalStore.open({
      component: LinkModal,
      props: {
        mode: 'fromVoucher',
        excludeIds,
        onConfirm: ({
          id,
          page_range,
          pickedItem
        }: {
          id: string
          page_range: [number, number] | null
          pickedItem: any
        }) => {
          pendingLinks = [
            ...pendingLinks,
            {
              global_document_id: id,
              page_range,
              document: {
                id,
                name: pickedItem?.name ?? id,
                file_type: pickedItem?.file_type ?? ''
              }
            }
          ]
        }
      },
      options: { size: 'md' }
    })
  }

  function removePendingLink(globalDocumentId: string) {
    pendingLinks = pendingLinks.filter(
      (l) => l.global_document_id !== globalDocumentId
    )
  }

  const createMutation = mutationBuilder(postCreateVoucher)

  const isSubmitting = $derived(createMutation.isPending)
  const yearNumber = $derived(Number(programYear))
  const canSubmit = $derived(
    name.trim().length > 0 &&
      programName.trim().length > 0 &&
      programOrganization.trim().length > 0 &&
      Number.isFinite(yearNumber) &&
      yearNumber >= 1900 &&
      yearNumber <= 2999
  )

  function handleCreate() {
    if (!canSubmit) return

    // support_amount는 JSON 객체 (dict | null) — 빈 값은 null, 그 외는 parse
    let parsedSupportAmount: Record<string, unknown> | null = null
    const trimmedAmount = supportAmount.trim()
    if (trimmedAmount) {
      try {
        const parsed = JSON.parse(trimmedAmount)
        if (
          parsed === null ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed)
        ) {
          showErrorMessage('지원금은 JSON 객체 형식이어야 합니다')
          return
        }
        parsedSupportAmount = parsed
      } catch {
        showErrorMessage('지원금 JSON 형식이 잘못되었습니다')
        return
      }
    }

    createMutation.mutate(
      {
        name: name.trim(),
        program_name: programName.trim(),
        program_organization: programOrganization.trim(),
        program_year: yearNumber,
        usage_start_date: usageStartDate || null,
        usage_end_date: usageEndDate || null,
        application_method: applicationMethod.trim() || null,
        application_start_date: applicationStartDate || null,
        application_end_date: applicationEndDate || null,
        support_amount: parsedSupportAmount,
        support_scope: supportScope.trim() || null,
        support_target: supportTarget.trim() || null,
        contact: contact.trim() || null,
        document_links:
          pendingLinks.length > 0
            ? pendingLinks.map((l) => ({
                global_document_id: l.global_document_id,
                page_range: l.page_range ?? null
              }))
            : undefined
      },
      {
        onSuccess: (data: any) => {
          goto(`/vouchers/${data.id}`)
        }
      }
    )
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
</script>

<div in:fade class="p-6">
  <div class="mb-6">
    <button
      onclick={() => goto('/vouchers')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 바우처 목록
    </button>
    <Typography variant="headline-01-normal-bold" tag="h1">바우처 등록</Typography>
  </div>

  <!-- svelte-ignore a11y_label_has_associated_control -->
  <div class="space-y-4">
    <!-- 기본 정보 -->
    <div class="section-border p-6">
      <div class="mb-4 flex items-center justify-between">
        <Typography variant="title-01-normal-semibold" tag="h2">기본 정보</Typography>
        <Button
          color="primary"
          size="md"
          content="등록하기"
          disabled={isSubmitting || !canSubmit}
          onclick={handleCreate}
        />
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="사업/서비스명"
          required
          bind:value={name}
          placeholder="예: 방과후활동서비스"
          maxlength={255}
        />
        <Input
          label="사업 이름"
          required
          bind:value={programName}
          placeholder="예: 발달장애인활동서비스사업"
          maxlength={255}
        />
        <Input
          label="사업 기관"
          required
          bind:value={programOrganization}
          placeholder="예: 보건복지부"
          maxlength={255}
        />
        <Input
          label="사업 연도"
          required
          type="number"
          bind:value={programYear}
          min={1900}
          max={2999}
        />
      </div>
    </div>

    <!-- 이용 / 신청 기간 -->
    <div class="section-border p-6">
      <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4">
        이용 / 신청 기간
      </Typography>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="이용 시작일" type="date" bind:value={usageStartDate} />
        <Input label="이용 종료일" type="date" bind:value={usageEndDate} />
        <div class="md:col-span-2">
          <label class={labelClass}>신청 방법</label>
          <textarea
            rows="2"
            placeholder="예: 거주지 행정복지센터 방문 신청"
            bind:value={applicationMethod}
            class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
          ></textarea>
        </div>
        <Input label="신청 시작일" type="date" bind:value={applicationStartDate} />
        <Input label="신청 종료일" type="date" bind:value={applicationEndDate} />
      </div>
    </div>

    <!-- 지원 / 문의 -->
    <div class="section-border p-6">
      <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4">
        지원 / 문의
      </Typography>

      <div class="space-y-4">
        <div>
          <label class={labelClass}>
            지원금
            <span class="ml-1 text-xs font-normal text-gray-400">
              JSON 객체 형식 (예: {`{ "통화": "KRW", "월총액": ... }`})
            </span>
          </label>
          <textarea
            rows="6"
            placeholder={`{\n  "통화": "KRW",\n  "월총액": { "최소": 180000, "최대": 250000 },\n  "정부지원금": null,\n  "본인부담금": null,\n  "가격탄력제": true,\n  "등급별": []\n}`}
            bind:value={supportAmount}
            class="w-full resize-y rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-xs outline-none focus:border-primary-500"
          ></textarea>
        </div>
        <div>
          <label class={labelClass}>지원 범위</label>
          <textarea
            rows="2"
            bind:value={supportScope}
            class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
          ></textarea>
        </div>
        <div>
          <label class={labelClass}>지원 대상</label>
          <textarea
            rows="2"
            bind:value={supportTarget}
            class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
          ></textarea>
        </div>
        <div>
          <label class={labelClass}>문의처</label>
          <textarea
            rows="2"
            placeholder="예: 보건복지상담센터 ☎ 129"
            bind:value={contact}
            class="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- 연결할 자료 (선택, 등록과 동시 처리 — 한 트랜잭션) -->
    <div class="section-border p-6">
      <div class="mb-3 flex items-center justify-between">
        <Typography variant="title-01-normal-semibold" tag="h2">
          연결할 자료
        </Typography>
        <Button
          size="sm"
          color="light"
          content="+ 자료 연결"
          onclick={openAddLinkModal}
        />
      </div>
      <p class="mb-3 text-xs text-gray-500">
        등록 버튼을 누르면 바우처 생성 + 자료 연결이 한 트랜잭션에서 처리됩니다. 일부 실패 시 전체 롤백됩니다.
      </p>

      {#if pendingLinks.length === 0}
        <div class="py-8 text-center text-sm text-gray-400">
          연결된 자료가 없습니다
        </div>
      {:else}
        <div class="overflow-hidden rounded-lg border border-gray-100">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th class="px-4 py-2 text-left font-medium">자료명</th>
                <th class="px-4 py-2 text-left font-medium">형식</th>
                <th class="px-4 py-2 text-left font-medium">페이지</th>
                <th class="px-4 py-2 text-right font-medium">동작</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each pendingLinks as link (link.global_document_id)}
                <tr>
                  <td class="px-4 py-2.5 text-gray-900">{link.document.name}</td>
                  <td class="px-4 py-2.5">
                    {#if link.document.file_type}
                      <span
                        class="inline-flex rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium uppercase text-gray-600"
                      >
                        {link.document.file_type}
                      </span>
                    {:else}
                      <span class="text-gray-400">-</span>
                    {/if}
                  </td>
                  <td class="px-4 py-2.5 text-gray-500">
                    {#if link.page_range}
                      p.{link.page_range[0]} - {link.page_range[1]}
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onclick={() => removePendingLink(link.global_document_id)}
                      class="text-xs text-gray-500 hover:text-red-600"
                    >
                      제거
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
