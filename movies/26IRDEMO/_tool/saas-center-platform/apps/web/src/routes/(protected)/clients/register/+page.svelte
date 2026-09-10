<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'
  import { onMount, onDestroy, tick } from 'svelte'

  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { readReturnTo } from '$lib/utils/return-to'
  import { pageToolRegistry } from '$lib/features/agent/page-tools/registry'
  import { registerClientRegisterTools } from '$lib/features/agent/page-tools/client-register'

  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { CLIENT_CREATE_RULE } from '$lib/features/clients/permissions'
  import Typography from '@common/components/Typography.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import ReceiveStepperLayout from '$lib/components/common/ReceiveStepperLayout.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { createClientRegisterService } from '$lib/features/clients/register/register-service'
  import { useClientRegisterForm } from '$lib/features/clients/register/register-form-hooks.svelte'
  import { isVoucherRowFilled } from '$lib/features/clients/register/voucher-types'
  import VoucherSection from './components/VoucherSection.svelte'
  import ClientInfoSection from './components/ClientInfoSection.svelte'
  import GuardianSection from './components/GuardianSection.svelte'
  import SiblingSection from './components/SiblingSection.svelte'
  import { centerId as centerId$ } from '$lib/stores/center.store'
  import { formatPhoneNumber } from '$lib/utils/stringConverter'
  import { t } from '$lib/ontology/terms'

  const queryClient = useQueryClient()
  const registerService = createClientRegisterService({ queryClient })
  const form = useClientRegisterForm()

  // ── 수정 모드: URL → 훅 주입 + fetch/prefill (effect는 $centerId 반응) ──
  $effect(() => {
    form.setEditClientId($page.url.searchParams.get('editClient') ?? '')
  })

  $effect(() => {
    const cid = $centerId$
    if (!form.shouldFetchClientForEdit(cid)) return
    registerService.loadClientForEdit(form.editClientId).then((data) => {
      if (data && data.id) form.setEditClientData(data)
      else snackbarStore.error('내담자 정보를 불러오지 못했어요.')
    })
  })

  $effect(() => {
    if (!form.editClientData) return
    form.applyEditPrefill()
  })

  $effect(() => {
    const cid = $centerId$
    if (!form.shouldFetchGuardiansForEdit(cid)) return
    registerService
      .loadGuardiansForEdit(form.editClientId)
      .then((loaded) => form.setGuardians(loaded))
      .catch((err) => console.error('[register] 보호자 정보 로드 실패:', err))
  })

  // Agent Page Tool 등록 (Agent가 아닌 일반 접근에서는 호출되지 않음)
  onMount(() => {
    registerClientRegisterTools({
      getState: () => ({
        name: form.name,
        birth: form.birth,
        gender: form.gender,
        phone: form.phone,
        email: form.email,
        address: form.address,
        addressDetail: form.addressDetail,
        memo: form.memo
      }),
      setName: (v) => {
        form.name = v
      },
      setBirth: (v) => {
        form.birth = v
      },
      setGender: (v) => {
        form.gender = v
      },
      setPhone: (v) => {
        form.phone = formatPhoneNumber(v) || v
      },
      setEmail: (v) => {
        form.email = v
      },
      setAddress: (v) => {
        form.address = v
      },
      setAddressDetail: (v) => {
        form.addressDetail = v
      },
      setMemo: (v) => {
        form.memo = v
      }
    })
  })

  onDestroy(() => {
    if (browser) pageToolRegistry.unregisterAll()
  })

  function handleClose() {
    history.back()
  }

  async function handleSubmit() {
    if (form.isSubmitting) return
    if (!form.validate()) return

    form.isSubmitting = true
    try {
      const state = form.buildFormState()
      if (form.isEditMode) {
        await registerService.update(form.editClientId, {
          ...state,
          guardians: form.isGuardianEdit ? [] : state.guardians
        })
        return
      }
      await registerService.submit(
        {
          ...state,
          voucherRows: state.voucherRows?.filter(isVoucherRowFilled)
        },
        { returnTo: readReturnTo($page.url) }
      )
    } catch (error) {
      console.error('[register] 저장 실패:', error)
      const mapped = registerService.extractFieldErrors(error)
      if (mapped) {
        form.fieldErrors = mapped
      } else {
        snackbarStore.error(registerService.extractApiError(error))
      }
    } finally {
      form.isSubmitting = false
    }
  }

  // ── 선택 섹션 토글 (보호자·형제·바우처) — 기본 꺼짐 ──
  type OptionalField = 'guardian' | 'sibling' | 'voucher'
  let optionalOn = $state<Record<OptionalField, boolean>>({
    guardian: false,
    sibling: false,
    voucher: false
  })

  // 우측 접수 진행이 켜진 섹션까지 단계로 세도록 토글 상태를 훅에 넘긴다.
  $effect(() => form.setOptionalEnabled({ ...optionalOn }))

  // Switch가 bind로 값을 뒤집은 뒤 호출된다 — 여기선 뒤집힌 값 기준으로 뒷정리만 한다.
  function applyOptionalToggle(field: OptionalField) {
    if (!optionalOn[field]) {
      form.resetOptionalSection(field)
      return
    }
    form.ensureOptionalRow(field)
    activeField = field
    // 펼친 영역이 접힌 자리 그대로면 아래가 잘린다 — 렌더 후 섹션 전체를 화면에 들인다.
    tick().then(() => requestAnimationFrame(() => revealSection(field)))
  }

  // 섹션이 스크롤 영역 안에 '여백까지 포함해' 들어오도록 최소한만 움직인다.
  // scrollIntoView(block:'nearest')는 딱 붙여서 멈춰 추가 버튼이 가장자리에 물린다.
  const REVEAL_PADDING = 24
  // 접힌 행 = 타이틀+토글 한 줄. 이보다 크면 펼쳐진 섹션이라 목표에 끌어들이지 않는다.
  const COLLAPSED_ROW_MAX = 80

  // 펼친 섹션 아래의 '접힌 토글 행'들까지 목표에 포함한다 — 다음에 뭘 켤 수 있는지 보여야 한다.
  function bottomIncludingToggles(el: Element) {
    let bottom = el.getBoundingClientRect().bottom
    let next = el.nextElementSibling
    while (next) {
      const rect = next.getBoundingClientRect()
      if (rect.height > COLLAPSED_ROW_MAX) break
      bottom = rect.bottom
      next = next.nextElementSibling
    }
    return bottom
  }

  function revealSection(field: string) {
    const el = document.querySelector(`[data-field="${field}"]`)
    const scroller = el?.closest('.overflow-y-auto')
    if (!el || !scroller) return
    const view = scroller.getBoundingClientRect()
    const top = el.getBoundingClientRect().top

    // 위가 잘려 있으면 그것부터 — 섹션은 시작부터 읽혀야 한다.
    const topOverflow = view.top + REVEAL_PADDING - top
    if (topOverflow > 0) {
      scroller.scrollBy({ top: -topOverflow, behavior: 'smooth' })
      return
    }

    // 욕심 → 최소 순으로 시도: ① 아래 토글 행까지 ② 섹션까지.
    // 스크롤한 뒤에도 섹션 상단이 화면에 남는 안(案)만 채택한다.
    for (const bottom of [
      bottomIncludingToggles(el),
      el.getBoundingClientRect().bottom
    ]) {
      const delta = bottom + REVEAL_PADDING - view.bottom
      if (delta <= 0) return // 이미 다 보인다
      if (top - delta >= view.top + REVEAL_PADDING) {
        scroller.scrollBy({ top: delta, behavior: 'smooth' })
        return
      }
    }
    // 섹션이 스크롤 영역보다 크면 상단 정렬.
    scroller.scrollBy({
      top: top - view.top - REVEAL_PADDING,
      behavior: 'smooth'
    })
  }

  // 수정 모드에서 저장된 보호자가 실려오면 토글을 켠 상태로 연다(자동으로 끄지는 않는다).
  $effect(() => {
    if (optionalOn.guardian) return
    if (form.guardians.some((g) => g.name.trim() || g.phone.trim())) {
      optionalOn.guardian = true
    }
  })

  let activeField = $state<string | null>('client')
  let flashField = $state<string | null>(null)
  let goToField = $state<((field: string) => void) | undefined>()

  // ?focus=guardian 같은 진입 의도 — "보호자 등록하기"로 들어오면 해당 섹션까지 데려간다.
  // 수정 모드는 프리필이 끝나야 섹션이 그려지므로 그때까지 기다린다.
  let focusApplied = false
  $effect(() => {
    if (!browser || focusApplied) return
    const target = $page.url.searchParams.get('focus')
    if (!target || !goToField) return
    if (form.isEditMode && !form.editClientData) return
    focusApplied = true
    if (target in optionalOn && !optionalOn[target as OptionalField]) {
      optionalOn[target as OptionalField] = true
      form.ensureOptionalRow(target as OptionalField)
    }
    tick().then(() => goToField?.(target))
  })
</script>

<PermissionGuard rule={CLIENT_CREATE_RULE}>
  <ReceiveStepperLayout
    title={form.isEditMode
      ? form.isGuardianEdit
        ? '보호자 수정'
        : '내담자 수정'
      : '내담자 등록'}
    steps={form.steps}
    bind:activeField
    bind:flashField
    bind:goToField
    bind:memo={form.memo}
    memoPlaceholder="해당 내담자에게 필요한 메모나 문의내역을 남겨주세요."
    submitLabel={form.isSubmitting
      ? '처리 중...'
      : form.isEditMode
        ? '수정'
        : '등록'}
    canSubmit={form.canSubmit}
    completeBannerText={form.isEditMode
      ? '수정 준비가 완료됐어요'
      : '등록 준비가 완료됐어요'}
    onSubmit={handleSubmit}
    onCancel={handleClose}
    form={formContent}
  />

  {#snippet fallback()}
    <div
      class="flex h-full items-center justify-center bg-gray-50 text-gray-500"
    >
      <p>내담자 등록 권한이 없습니다.</p>
    </div>
  {/snippet}
</PermissionGuard>

<!-- 좌측 폼 행: 라벨 + 섹션. 포커스 시 하이라이트(flash). -->
{#snippet formContent()}
  <!-- 행 간격은 gap이 소유한다 — 각 행에 상하 패딩을 주면 여백이 두 군데(행·컨테이너)에서
       생겨 바깥 패딩만으로 조절이 안 된다. 여백은 카드 컨테이너 패딩 + 이 gap 둘뿐. -->
  <div class="flex flex-col gap-8">
    {@render formRow(
      'client',
      form.isGuardianEdit ? t('guardian') : t('subject')
    )}
    {#if !form.isGuardianEdit}
      {@render formRow('guardian', t('guardian'))}
      {#if !form.isEditMode}
        {@render formRow('sibling', '형제·자매')}
        {@render formRow('voucher', '바우처')}
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet formRow(field: string, label: string)}
  <!-- 라벨 위 / 입력 아래 세로 배치(전 해상도 동일). 구분선 없이 여백으로 섹션을 나눈다.
       Web_Design §Title system — 타이틀↔서브내용 8, 타이틀(또는 서브내용)↔콘텐츠 16.
       서브내용 한 줄을 가진 섹션(보호자·형제·바우처)은 gap 8, 없는 내담자는 gap 16.
       행 자체 패딩 없음 — 바깥 컨테이너와 gap이 여백을 소유. -->
  <div
    class="flex flex-col {field === 'client'
      ? 'gap-4'
      : 'gap-2'} {flashField === field ? 'field-flash' : ''}"
    data-field={field}
    onfocusin={() => (activeField = field)}
    onclickcapture={() => (activeField = field)}
  >
    <!-- 선택 섹션은 타이틀 우측 토글로 켠다 — 토글 폭도 콘텐츠 폭(772)에 맞춰 우측 끝을 정렬. -->
    <div
      class="flex min-h-6 max-w-[772px] shrink-0 items-center justify-between gap-4"
    >
      <Typography
        variant="title-01-semibold"
        color="text-gray-700"
        className="break-keep"
      >
        {label}{#if field !== 'client'}<span
            class="ml-1 whitespace-nowrap text-body-subtle text-body-03-normal-regular"
            >(선택)</span
          >{/if}
      </Typography>
      {#if field !== 'client'}
        <Switch
          bind:checked={optionalOn[field as OptionalField]}
          ariaLabel="{label} 입력"
          onclick={() => applyOptionalToggle(field as OptionalField)}
        />
      {/if}
    </div>
    <!-- 폭 상한 772 = 접수 계열 공통 콘텐츠 폭. 모든 항목의 우측 끝을 이 선에 맞춘다. -->
    {#if field === 'client' || optionalOn[field as OptionalField]}
      <div class="min-w-0 max-w-[772px] flex-1">
        {#if field === 'client'}
          <ClientInfoSection
            name={form.name}
            birth={form.birth}
            gender={form.gender}
            email={form.email}
            phone={form.phone}
            zipCode={form.zipCode}
            address={form.address}
            addressDetail={form.addressDetail}
            fieldErrors={form.fieldErrors}
            isGuardianEdit={form.isGuardianEdit}
            onUpdate={(patch) => Object.assign(form, patch)}
            onClearFieldError={(key) => {
              if (form.fieldErrors[key])
                form.fieldErrors = { ...form.fieldErrors, [key]: undefined }
            }}
            onAddressSearch={form.openAddressSearch}
          />
          {#if form.duplicateLevel !== 'none' && form.duplicateMatch}
            <div
              class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3"
            >
              <span class="mt-0.5 shrink-0 text-amber-700" aria-hidden="true"
                >!</span
              >
              <Typography
                variant="body-02-normal-regular"
                color="text-amber-700"
              >
                {form.duplicateLevel === 'high'
                  ? '이미 등록된 내담자와 일치할 수 있어요'
                  : '비슷한 내담자가 이미 있어요'} — {form.duplicateMatch
                  .name}{form.duplicateMatch.birth_date
                  ? ` (${form.duplicateMatch.birth_date.slice(0, 10)})`
                  : ''}. 같은 사람이면 중복 등록하지 않도록 확인해 주세요.
              </Typography>
            </div>
          {/if}
        {:else if field === 'guardian'}
          <GuardianSection
            guardians={form.guardians}
            guardianErrors={form.guardianErrors}
            isEditMode={form.isEditMode}
            onAdd={form.addGuardian}
            onRemove={form.removeGuardian}
            onClearError={form.clearGuardianError}
            onUpdateGuardian={form.updateGuardian}
          />
        {:else if field === 'sibling'}
          <SiblingSection
            siblings={form.siblings}
            siblingErrors={form.siblingErrors}
            onAdd={form.addSibling}
            onRemove={form.removeSibling}
            onClearError={form.clearSiblingError}
            onUpdate={form.updateSibling}
          />
        {:else if field === 'voucher'}
          <VoucherSection
            rows={form.voucherRows}
            onAdd={form.addVoucher}
            onRemove={form.removeVoucher}
            onUpdate={form.updateVoucher}
            errors={form.voucherErrors}
          />
        {/if}
      </div>
    {/if}
  </div>
{/snippet}
