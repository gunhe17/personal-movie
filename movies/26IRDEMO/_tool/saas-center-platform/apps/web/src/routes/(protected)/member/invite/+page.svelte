<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { get } from 'svelte/store'
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import Select from '$lib/components/Select.svelte'
  import Button from '$lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import { inviteReviewStore } from '$lib/features/members/invite-review.store'
  import {
    createMemberInvitation,
    type InvitationItem
  } from '$lib/hooks/actions/member.action'
  import { requireCenterId } from '$lib/stores/center.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalStore } from '$lib/stores/modal'
  import ExcelUploadModal from '$lib/components/modal/ExcelUploadModal.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import * as XLSX from 'xlsx'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { MEMBER_PAGE_ACCESS_RULE } from '$lib/features/members/permissions'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface ReviewRow {
    id: string
    checked: boolean
    email: string
    name: string
    role_code: string
    employment_type: string
  }

  const queryClient = useQueryClient()

  const roleOptions = [
    { value: 'ADMIN', title: '관리자' },
    { value: 'COUNSELOR', title: '전문가' },
    { value: 'MANAGER', title: '매니저' },
    { value: 'STAFF', title: '스태프' }
  ]

  const ROLE_NAME_MAP: Record<string, string> = {
    관리자: 'ADMIN',
    전문가: 'COUNSELOR',
    매니저: 'MANAGER',
    스태프: 'STAFF'
  }

  const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
    정규직: 'FULLTIME',
    계약직: 'CONTRACT',
    프리랜서: 'FREELANCER'
  }

  let rows = $state<ReviewRow[]>([])
  let isSubmitting = $state(false)
  let openMenuId = $state<string | null>(null)

  onMount(() => {
    const items = get(inviteReviewStore)
    if (items.length === 0) {
      goto('/member')
      return
    }
    rows = items.map((item, i) => ({
      id: `row-${i}`,
      checked: false,
      email: item.email,
      name: item.name,
      role_code: item.role_code,
      employment_type: item.employment_type
    }))
  })

  const allChecked = $derived(rows.length > 0 && rows.every((r) => r.checked))
  const someChecked = $derived(rows.some((r) => r.checked))

  function toggleAll() {
    const next = !allChecked
    rows = rows.map((r) => ({ ...r, checked: next }))
  }

  function toggleRow(id: string) {
    rows = rows.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
  }

  function deleteRow(id: string) {
    rows = rows.filter((r) => r.id !== id)
    openMenuId = null
  }

  function deleteChecked() {
    rows = rows.filter((r) => !r.checked)
  }

  function handleClose() {
    inviteReviewStore.clear()
    goto('/member')
  }

  // 엑셀 파일 파싱
  function parseExcelInvitations(file: File): Promise<InvitationItem[]> {
    return file.arrayBuffer().then((data) => {
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
        | string
        | number
      )[][]

      const dataRows = jsonData.slice(1).filter((row) => row.length > 0)
      const items: InvitationItem[] = []
      const errors: string[] = []

      dataRows.forEach((row, index) => {
        const rowNum = index + 2
        const name = String(row[0] || '').trim()
        const email = String(row[1] || '').trim()
        const roleRaw = String(row[2] || '').trim()
        const employmentRaw = String(row[3] || '').trim()

        if (!name) {
          errors.push(`${rowNum}행: 이름이 비어있습니다`)
          return
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`${rowNum}행: 이메일이 유효하지 않습니다 (${email})`)
          return
        }
        const role_code = ROLE_NAME_MAP[roleRaw]
        if (!role_code) {
          errors.push(`${rowNum}행: 역할이 유효하지 않습니다 (${roleRaw})`)
          return
        }
        const employment_type = EMPLOYMENT_TYPE_MAP[employmentRaw]
        if (!employment_type) {
          errors.push(
            `${rowNum}행: 근무형태가 유효하지 않습니다 (${employmentRaw})`
          )
          return
        }
        items.push({ name, email, role_code, employment_type })
      })

      if (errors.length > 0) {
        snackbarStore.error(errors.slice(0, 3).join('\n'))
        return []
      }
      return items
    })
  }

  function handleChangeFile() {
    modalStore.open({
      component: ExcelUploadModal,
      props: {
        title: '구성원을 초대할게요',
        subtitle: '구성원 초대에 필요한 정보를 입력해주세요',
        description:
          '아래 엑셀 양식 파일을 다운로드하고,\n구성원을 등록해보세요.',
        templateData: [
          ['이름', '이메일', '역할', '근무형태'],
          ['홍길동', 'hong@example.com', '전문가', '정규직'],
          ['김영희', 'kim@example.com', '매니저', '계약직']
        ],
        templateFileName: '구성원_초대_템플릿.xlsx',
        submitLabel: '다음',
        onSubmit: async (file: File) => {
          const items = await parseExcelInvitations(file)
          if (items.length === 0) return
          rows = items.map((item, i) => ({
            id: `row-${Date.now()}-${i}`,
            checked: false,
            email: item.email,
            name: item.name,
            role_code: item.role_code,
            employment_type: item.employment_type
          }))
          snackbarStore.success('파일 내용을 업로드했어요!')
        }
      },
      options: { customWidth: 540 }
    })
  }

  async function handleConfirm() {
    if (rows.length === 0 || isSubmitting) return
    isSubmitting = true
    const centerId = requireCenterId()
    const finalItems: InvitationItem[] = rows.map((r) => ({
      name: r.name,
      email: r.email,
      role_code: r.role_code,
      employment_type: r.employment_type
    }))
    try {
      for (const item of finalItems) {
        await createMemberInvitation().request({
          centerId,
          name: item.name,
          email: item.email,
          role_code: item.role_code,
          employment_type: item.employment_type
        })
      }
      snackbarStore.success(
        `${finalItems.length}명의 구성원 초대가 완료되었습니다`
      )
      queryClient.invalidateQueries({
        queryKey: ['getMemberList'],
        exact: false
      })
      queryClient.invalidateQueries({
        queryKey: ['getInvitationList'],
        exact: false
      })
      inviteReviewStore.clear()
      const returnTo = page.url.searchParams.get('returnTo')
      if (returnTo) {
        setTimeout(() => goto(returnTo), 1500)
      } else {
        goto('/member?tab=pending')
      }
    } catch (error) {
      console.error('[excelInviteMembers] failed', error)
      snackbarStore.error('엑셀 초대에 실패했습니다')
    } finally {
      isSubmitting = false
    }
  }

  function handleBackdropClick() {
    if (openMenuId) openMenuId = null
  }
</script>

<PermissionGuard rule={MEMBER_PAGE_ACCESS_RULE} showError>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden"
    onclick={handleBackdropClick}
  >
    <!-- X 버튼 -->
    <Tooltip text="닫기">
      <button
        class="absolute left-8 top-8 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
        onclick={handleClose}
        aria-label="close"
      >
        <CloseIcon size={20} color="#9CA3AF" />
      </button>
    </Tooltip>

    <!-- 헤더 -->
    <div class="shrink-0 flex flex-col items-center pt-16 pb-6">
      <Typography variant="headline-01-normal-semibold" color="text-gray-900">
        아래 구성원 정보를 확인해주세요
      </Typography>
      <Typography
        variant="body-02-regular"
        color="text-gray-500"
        className="mt-2"
      >
        엑셀 파일에서 필수 항목이 입력되지 않거나, 잘못 입력된 내용을 한번 더
        확인해주세요
      </Typography>
    </div>

    <!-- 본문 -->
    <div class="flex-1 overflow-y-auto px-16 pb-6">
      <div class="mx-auto max-w-350">
        <!-- 총 개수 + 엑셀 파일 변경 -->
        <div class="flex items-center justify-between mb-5">
          <Typography variant="title-01-semibold" color="text-gray-800">
            총 {rows.length}
          </Typography>
          <button
            type="button"
            onclick={handleChangeFile}
            class="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            엑셀 파일 변경
          </button>
        </div>

        <!-- 선택된 항목 삭제 -->
        {#if someChecked}
          <div class="mb-3">
            <button
              type="button"
              onclick={deleteChecked}
              class="text-sm text-status-danger hover:text-red-600 transition-colors"
            >
              선택 항목 삭제
            </button>
          </div>
        {/if}

        <!-- 테이블 -->
        <div class="rounded-2xl border border-gray-200 overflow-hidden">
          <!-- 헤더 -->
          <div
            class="grid grid-cols-[64px_1fr_240px_48px] items-center bg-white border-b border-gray-200 px-6 py-3.5"
          >
            <Typography variant="body-03-medium" color="text-gray-500"
              >No.</Typography
            >
            <Typography variant="body-03-medium" color="text-gray-500"
              >이메일</Typography
            >
            <Typography variant="body-03-medium" color="text-gray-500"
              >역할</Typography
            >
            <span></span>
          </div>

          <!-- 본문 -->
          <div class="bg-white">
            {#each rows as row, idx (row.id)}
              <div
                class="grid grid-cols-[64px_1fr_240px_48px] items-center border-b border-gray-100 last:border-b-0 px-6 py-3 relative"
              >
                <!-- 체크박스 -->
                <div class="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onchange={() => toggleRow(row.id)}
                    class="h-4 w-4 rounded border-gray-300 text-primary-500"
                  />
                </div>

                <!-- 이메일 -->
                <div class="pr-6">
                  <input
                    type="email"
                    bind:value={row.email}
                    class="field-input w-full"
                  />
                </div>

                <!-- 역할 -->
                <div class="pr-2">
                  <Select
                    class="w-full rounded-lg"
                    options={roleOptions}
                    selected={row.role_code}
                    on:change={(e) => {
                      rows = rows.map((r) =>
                        r.id === row.id
                          ? { ...r, role_code: e.detail.value }
                          : r
                      )
                    }}
                  />
                </div>

                <!-- 케밥 메뉴 -->
                <div class="flex items-center justify-center relative">
                  <Tooltip text="더보기">
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition"
                      onclick={(e) => {
                        e.stopPropagation()
                        openMenuId = openMenuId === row.id ? null : row.id
                      }}
                      aria-label="more"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                      </svg>
                    </button>
                  </Tooltip>

                  {#if openMenuId === row.id}
                    <div
                      class="dropdown-panel absolute top-full right-0 z-10 mt-1"
                    >
                      <button
                        type="button"
                        class="dropdown-item is-danger"
                        onclick={() => deleteRow(row.id)}
                      >
                        삭제
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- 하단 바 -->
    <div class="shrink-0 border-t border-gray-200 bg-white px-16 py-5">
      <div class="mx-auto flex max-w-350 justify-end">
        <Button
          class="h-13 w-50 justify-center rounded-lg {rows.length > 0
            ? 'bg-primary-500 hover:bg-primary-600'
            : 'cursor-not-allowed bg-action-primary-disabled'}"
          onclick={rows.length > 0 ? handleConfirm : undefined}
          disabled={rows.length === 0 || isSubmitting}
        >
          <Typography variant="body-01-normal-medium" color="text-white">
            확인
          </Typography>
        </Button>
      </div>
    </div>
  </div>
</PermissionGuard>
