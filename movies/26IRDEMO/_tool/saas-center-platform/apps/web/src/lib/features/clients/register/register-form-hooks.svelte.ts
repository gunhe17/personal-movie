import { t } from '$lib/ontology/terms'
import { splitAddress } from './register-service'
/**
 * 내담자 등록/수정 폼 훅 (Svelte 5 Runes)
 * - 폼 상태 + 검증 + 스텝 파생 + 수정모드 로드/프리필 캡슐화
 * - 그룹/기관 등록용 hooks.svelte.ts와는 별개 (개인 내담자 도메인)
 */

import { tick } from 'svelte'
import type { StepItem } from '$lib/components/common/ReceiveStepperLayout.svelte'
import type {
  GuardianFormState,
  SiblingFormState,
  ClientRegisterFormState
} from './register-service'
import {
  emptyVoucherRow,
  isVoucherRowFilled,
  isVoucherRowTouched,
  type VoucherRow
} from './voucher-types'
import {
  isValidDate,
  getBirthError,
  fmtClientPreview,
  fmtGuardianPreview,
  fmtVoucherPreview
} from './view-model'
import { formatPhoneNumber } from '$lib/utils/stringConverter'
import { browser } from '$app/environment'
import { requireCenterId } from '$lib/stores/center.store'
import {
  postDuplicateCheck,
  type MatchedClientInfo
} from '$lib/hooks/actions/client.action'

export type GuardianForm = GuardianFormState & { clientId?: string | null }
export type SiblingForm = SiblingFormState
export type SiblingFieldErrors = {
  name?: string
  birth_date?: string
}

export type ClientFieldErrors = {
  name?: string
  birth_date?: string
  phone?: string
  email?: string
}
export type GuardianFieldErrors = {
  name?: string
  relation?: string
  birth_date?: string
  phone?: string
}
export type VoucherRowErrors = {
  centerVoucher?: string
  totalSessions?: string
  totalAmount?: string
  validRange?: string
}

function newGuardian(idSuffix = ''): GuardianForm {
  return {
    id: `${Date.now()}${idSuffix}`,
    name: '',
    relation: '',
    birth: '',
    phone: '',
    gender: 'male',
    clientId: null
  }
}

function newSibling(idSuffix = ''): SiblingForm {
  return {
    id: `${Date.now()}${idSuffix}`,
    name: '',
    birth: '',
    gender: 'MALE'
  }
}

function scrollToField(selector: string) {
  document
    .querySelector(selector)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function useClientRegisterForm() {
  // ── 수정 모드 식별 (페이지가 URL에서 주입) ──
  let editClientId = $state('')
  let editClientData = $state<any>(null)
  // 비반응 dedupe 플래그 (effect 루프 방지 — $state 아님)
  let fetchAttemptedFor: string | null = null
  let guardiansFetchedFor: string | null = null
  let editPreFilled = false

  const isEditMode = $derived(!!editClientId)
  const editClientRole = $derived<string>(editClientData?.role ?? '')
  // 보호자 '전용' 레코드 수정 모드 — both는 대상자 폼으로 다룬다 (D3: role은 요약 캐시, 여기선 저장값 정확 비교가 의도)
  const isGuardianEdit = $derived(editClientRole === 'guardian')

  // ── 내담자 폼 필드 ──
  let name = $state('')
  let birth = $state('')
  let gender = $state<'MALE' | 'FEMALE'>('MALE')
  let email = $state('')
  let phone = $state('')
  let zipCode = $state('')
  let address = $state('')
  let addressDetail = $state('')
  let isAddressSearching = $state(false)
  let memo = $state('')

  let fieldErrors = $state<ClientFieldErrors>({})

  // ── 보호자 (빈 행 1개 기본) ──
  let guardians = $state<GuardianForm[]>([newGuardian()])
  let guardianErrors = $state<Record<string, GuardianFieldErrors>>({})

  // ── 형제(추가 자녀) — 기본 없음, "형제 추가"로만 생성 (등록 모드 전용) ──
  let siblings = $state<SiblingForm[]>([])
  let siblingErrors = $state<Record<string, SiblingFieldErrors>>({})

  // ── 바우처 (빈 행 1개 기본, 등록 모드 전용) ──
  let voucherRows = $state<VoucherRow[]>([emptyVoucherRow()])
  let voucherErrors = $state<Record<string, VoucherRowErrors>>({})

  // 선택 섹션 토글 상태(페이지 소유) — 진행 단계 집계에 쓴다.
  let optionalEnabled = $state<
    Record<'guardian' | 'sibling' | 'voucher', boolean>
  >({ guardian: false, sibling: false, voucher: false })
  function setOptionalEnabled(
    next: Record<'guardian' | 'sibling' | 'voucher', boolean>
  ) {
    optionalEnabled = { ...next }
  }

  let isSubmitting = $state(false)

  // ── 중복 후보 (등록 모드 전용, 이름+생년월일 입력 시 디바운스 조회) ──
  let duplicateLevel = $state<'high' | 'low' | 'none'>('none')
  let duplicateMatch = $state<MatchedClientInfo | null>(null)
  let dupTimer: ReturnType<typeof setTimeout> | null = null

  // ── 파생 ──
  const birthRealtimeError = $derived(getBirthError(birth))
  const showBirthError = $derived(birthRealtimeError !== '')

  // 이름+유효 생년월일이 채워지면 500ms 디바운스로 중복 후보 확인 (비차단 경고)
  $effect(() => {
    const n = name.trim()
    const b = birth
    if (isEditMode || !browser || !n || b.length !== 10 || !isValidDate(b)) {
      duplicateLevel = 'none'
      duplicateMatch = null
      return
    }
    if (dupTimer) clearTimeout(dupTimer)
    dupTimer = setTimeout(async () => {
      try {
        const res = (await postDuplicateCheck().request({
          centerId: requireCenterId(),
          clients: [{ name: n, birth_date: b }]
        })) as any
        // 런타임은 flat({results}) 또는 래퍼({data:{results}}) 둘 다 대응
        const body = res?.results ? res : res?.data
        const r = body?.results?.[0]
        if (r && r.duplicate_level !== 'none') {
          duplicateLevel = r.duplicate_level
          duplicateMatch = r.matched_client
        } else {
          duplicateLevel = 'none'
          duplicateMatch = null
        }
      } catch {
        duplicateLevel = 'none'
        duplicateMatch = null
      }
    }, 500)
  })

  const isFormValid = $derived(
    name.trim().length > 0 &&
      birth.length === 10 &&
      isValidDate(birth) &&
      new Date(birth) <= new Date() &&
      !birthRealtimeError
  )

  const filledGuardians = $derived(
    guardians.filter(
      (g) => g.name.trim() || g.relation || g.phone.trim() || g.birth.trim()
    )
  )
  // 보호자는 이름+관계+연락처 필수(백엔드도 birth_date nullable). 생년월일은 넣었을 때만 형식 검증.
  const validGuardians = $derived(
    filledGuardians.filter(
      (g) =>
        g.name.trim() &&
        g.relation &&
        g.phone.trim() &&
        (g.birth.trim() === '' ||
          (g.birth.length === 10 &&
            isValidDate(g.birth) &&
            new Date(g.birth) <= new Date()))
    )
  )
  const guardianPartial = $derived(
    filledGuardians.length > 0 &&
      validGuardians.length !== filledGuardians.length
  )

  const filledSiblings = $derived(
    siblings.filter((s) => s.name.trim() || s.birth.trim())
  )
  const validSiblings = $derived(
    filledSiblings.filter(
      (s) =>
        s.name.trim() &&
        s.birth.length === 10 &&
        isValidDate(s.birth) &&
        new Date(s.birth) <= new Date()
    )
  )
  const siblingPartial = $derived(
    filledSiblings.length > 0 && validSiblings.length !== filledSiblings.length
  )

  const filledVouchers = $derived(voucherRows.filter(isVoucherRowFilled))
  const touchedVouchers = $derived(voucherRows.filter(isVoucherRowTouched))
  const voucherPartial = $derived(
    touchedVouchers.length > 0 &&
      filledVouchers.length !== touchedVouchers.length
  )

  const steps = $derived<StepItem[]>([
    {
      key: 'client',
      field: 'client',
      label: isGuardianEdit ? t('guardian') : t('subject'),
      done: isFormValid,
      warning: null,
      preview: fmtClientPreview(name, gender, birth)
    },
    ...(isGuardianEdit
      ? []
      : [
          {
            key: 'guardian',
            field: 'guardian',
            label: t('guardian'),
            optional: true,
            active: optionalEnabled.guardian,
            done:
              filledGuardians.length > 0 &&
              validGuardians.length === filledGuardians.length,
            warning: guardianPartial ? '입력이 완성되지 않았어요' : null,
            preview:
              optionalEnabled.guardian && filledGuardians.length === 0
                ? `${t('guardian')} 정보를 입력해주세요`
                : fmtGuardianPreview(filledGuardians)
          }
        ]),
    ...(!isEditMode && !isGuardianEdit
      ? [
          {
            key: 'sibling',
            field: 'sibling',
            label: '형제·자매',
            optional: true,
            active: optionalEnabled.sibling,
            done:
              filledSiblings.length > 0 &&
              validSiblings.length === filledSiblings.length,
            warning: siblingPartial ? '입력이 완성되지 않았어요' : null,
            preview:
              filledSiblings.length > 0
                ? `자녀 ${filledSiblings.length + 1}명 (형제 연결)`
                : optionalEnabled.sibling
                  ? '형제·자매 정보를 입력해주세요'
                  : '선택 안 함'
          }
        ]
      : []),
    ...(!isEditMode && !isGuardianEdit
      ? [
          {
            key: 'voucher',
            field: 'voucher',
            label: '바우처',
            optional: true,
            active: optionalEnabled.voucher,
            done:
              touchedVouchers.length > 0 &&
              filledVouchers.length === touchedVouchers.length,
            warning: voucherPartial ? '입력이 완성되지 않았어요' : null,
            preview:
              optionalEnabled.voucher && touchedVouchers.length === 0
                ? '바우처 정보를 입력해주세요'
                : fmtVoucherPreview(
                    filledVouchers.length,
                    touchedVouchers.length
                  )
          }
        ]
      : [])
  ])

  // 제출 가능: 필수(내담자) 완료 + 선택 스텝 미완성 없음
  const canSubmit = $derived(
    isFormValid && !guardianPartial && !siblingPartial && !voucherPartial
  )

  // ── 수정 모드 로드/프리필 ──
  function setEditClientId(id: string) {
    editClientId = id
    if (!id) {
      editClientData = null
      fetchAttemptedFor = null
    }
  }
  function shouldFetchClientForEdit(centerId: string | null): boolean {
    if (!editClientId || !centerId) return false
    if (fetchAttemptedFor === editClientId) return false
    fetchAttemptedFor = editClientId
    return true
  }
  function shouldFetchGuardiansForEdit(centerId: string | null): boolean {
    if (!editClientId || !centerId) return false
    if (guardiansFetchedFor === editClientId) return false
    guardiansFetchedFor = editClientId
    return true
  }
  function setEditClientData(data: any) {
    editClientData = data
  }
  function setGuardians(loaded: GuardianForm[]) {
    if (loaded.length > 0) guardians = loaded
  }
  /** editClientData가 도착하면 1회 폼 프리필 */
  function applyEditPrefill() {
    if (!editClientData || editPreFilled) return
    name = editClientData.name || ''
    birth = editClientData.birth_date
      ? editClientData.birth_date.slice(0, 10)
      : ''
    gender =
      editClientData.gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE'
    email = editClientData.email || ''
    phone = formatPhoneNumber(editClientData.phone || '') || ''
    // 주소 복원 — 저장 규약(joinAddress)의 역함수. 우편번호/주소/상세주소로 되돌린다.
    // 개행 구분자가 없는 옛 데이터는 전부 주소 칸으로 모인다(동작 퇴행 없음).
    const parsedAddress = splitAddress(editClientData.address)
    zipCode = parsedAddress.zipCode
    address = parsedAddress.address
    addressDetail = parsedAddress.addressDetail
    memo = editClientData.memo || ''
    editPreFilled = true
  }

  // ── 보호자 핸들러 ──
  function clearGuardianError(id: string, field: keyof GuardianFieldErrors) {
    const current = guardianErrors[id]
    if (!current?.[field]) return
    guardianErrors = {
      ...guardianErrors,
      [id]: { ...current, [field]: undefined }
    }
  }
  function updateGuardian(id: string, patch: Partial<GuardianForm>) {
    guardians = guardians.map((g) => (g.id === id ? { ...g, ...patch } : g))
  }
  function removeGuardian(id: string) {
    guardians = guardians.filter((g) => g.id !== id)
  }
  async function addGuardian() {
    const g = newGuardian('-ggg')
    guardians = [...guardians, g]
    await tick()
    scrollToField(`[data-guardian-id="${g.id}"]`)
  }

  // ── 형제(추가 자녀) 핸들러 ──
  function clearSiblingError(id: string, field: keyof SiblingFieldErrors) {
    const current = siblingErrors[id]
    if (!current?.[field]) return
    siblingErrors = {
      ...siblingErrors,
      [id]: { ...current, [field]: undefined }
    }
  }
  function updateSibling(id: string, patch: Partial<SiblingForm>) {
    siblings = siblings.map((s) => (s.id === id ? { ...s, ...patch } : s))
  }
  function removeSibling(id: string) {
    siblings = siblings.filter((s) => s.id !== id)
    if (siblingErrors[id]) {
      const { [id]: _, ...rest } = siblingErrors
      siblingErrors = rest
    }
  }
  async function addSibling() {
    const s = newSibling('-sib')
    siblings = [...siblings, s]
    await tick()
    scrollToField(`[data-sibling-id="${s.id}"]`)
  }

  // ── 선택 섹션 토글 (보호자·형제·바우처) ──
  // 토글 off = 입력 폐기. 숨긴 채로 값이 남아 있으면 사용자가 보지 못한 데이터가 저장된다.
  function resetOptionalSection(section: 'guardian' | 'sibling' | 'voucher') {
    if (section === 'guardian') {
      guardians = [newGuardian()]
      guardianErrors = {}
      return
    }
    if (section === 'sibling') {
      siblings = []
      siblingErrors = {}
      return
    }
    voucherRows = [emptyVoucherRow()]
    voucherErrors = {}
  }

  // 토글 on 직후 입력 영역이 비어 보이지 않도록 빈 행 1개를 보장한다(스크롤 없음).
  function ensureOptionalRow(section: 'guardian' | 'sibling' | 'voucher') {
    if (section === 'guardian') {
      if (guardians.length === 0) guardians = [newGuardian()]
      return
    }
    if (section === 'sibling') {
      if (siblings.length === 0) siblings = [newSibling('-sib')]
      return
    }
    if (voucherRows.length === 0) voucherRows = [emptyVoucherRow()]
  }

  // ── 바우처 핸들러 ──
  function addVoucher() {
    voucherRows = [...voucherRows, emptyVoucherRow()]
  }
  function removeVoucher(id: string) {
    // 마지막 1개는 삭제 대신 비우기(최소 1개 유지)
    voucherRows =
      voucherRows.length <= 1
        ? [emptyVoucherRow()]
        : voucherRows.filter((r) => r.id !== id)
    if (voucherErrors[id]) {
      const { [id]: _, ...rest } = voucherErrors
      voucherErrors = rest
    }
  }
  function updateVoucher(id: string, patch: Partial<VoucherRow>) {
    voucherRows = voucherRows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    if (voucherErrors[id]) {
      const { [id]: _, ...rest } = voucherErrors
      voucherErrors = rest
    }
  }

  // ── 주소 검색 (클라이언트 전용, onclick에서만 호출) ──
  function openAddressSearch() {
    if (isAddressSearching) return
    const { kakao } = window as any
    if (!kakao?.Postcode) return
    isAddressSearching = true
    new kakao.Postcode({
      oncomplete: (data: any) => {
        zipCode = data.zonecode || ''
        address = data.address || data.roadAddress || data.jibunAddress || ''
        isAddressSearching = false
      },
      onclose: () => {
        isAddressSearching = false
      }
    }).open()
  }

  // ── 검증 (에러 설정 + 첫 에러 스크롤 + boolean 반환) ──
  function validate(): boolean {
    fieldErrors = {}
    guardianErrors = {}
    siblingErrors = {}

    // 1) 내담자 필드
    const errors: ClientFieldErrors = {}
    if (!name.trim()) errors.name = '이름을 입력해주세요.'
    if (birth.length !== 10) {
      errors.birth_date = '생년월일을 입력해주세요.'
    } else if (!isValidDate(birth)) {
      errors.birth_date = '올바르지 않은 날짜입니다.'
    } else if (new Date(birth) > new Date()) {
      errors.birth_date = '생년월일은 미래 날짜일 수 없습니다.'
    }
    if (phone.trim() && !/^[\d-]+$/.test(phone)) {
      errors.phone = '전화번호는 숫자와 하이픈(-)만 포함해야 합니다.'
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = '이메일을 확인해주세요'
    }
    if (Object.keys(errors).length > 0) {
      fieldErrors = errors
      const firstKey = Object.keys(errors)[0]
      tick().then(() =>
        scrollToField(
          `[data-field="${firstKey === 'birth_date' ? 'birth' : firstKey}"]`
        )
      )
      return false
    }

    // 2) 보호자 필드 (입력된 행만)
    const nextGuardianErrors: Record<string, GuardianFieldErrors> = {}
    let hasGuardianError = false
    for (const guardian of guardians) {
      const hasInput =
        !!guardian.name.trim() ||
        !!guardian.relation ||
        !!guardian.phone.trim() ||
        !!guardian.birth.trim()
      if (!hasInput) continue

      const gErrors: GuardianFieldErrors = {}
      if (!guardian.name.trim())
        gErrors.name = `${t('guardian')} 이름을 입력해주세요.`
      if (!guardian.relation) gErrors.relation = '관계를 선택해주세요.'
      // 생년월일은 선택 — 입력했을 때만 형식 검증
      if (guardian.birth.trim()) {
        if (guardian.birth.length !== 10 || !isValidDate(guardian.birth)) {
          gErrors.birth_date = '올바르지 않은 날짜입니다.'
        } else if (new Date(guardian.birth) > new Date()) {
          gErrors.birth_date = '생년월일은 미래 날짜일 수 없습니다.'
        }
      }
      if (!guardian.phone.trim()) {
        gErrors.phone = `${t('guardian')} 연락처를 입력해주세요.`
      } else if (!/^[\d-]+$/.test(guardian.phone)) {
        gErrors.phone = '전화번호는 숫자와 하이픈(-)만 포함해야 합니다.'
      }
      if (Object.keys(gErrors).length > 0) {
        nextGuardianErrors[guardian.id] = gErrors
        hasGuardianError = true
      }
    }
    if (hasGuardianError) {
      guardianErrors = nextGuardianErrors
      tick().then(() => scrollToField('[data-field="guardian"]'))
      return false
    }

    // 3) 형제 필드 (등록 모드 전용, 입력된 행만 — 이름+생년월일 필수)
    if (!isEditMode) {
      const nextSiblingErrors: Record<string, SiblingFieldErrors> = {}
      let hasSiblingError = false
      for (const sib of siblings) {
        const hasInput = !!sib.name.trim() || !!sib.birth.trim()
        if (!hasInput) continue
        const sErr: SiblingFieldErrors = {}
        if (!sib.name.trim()) sErr.name = '자녀 이름을 입력해주세요.'
        if (sib.birth.length !== 10) {
          sErr.birth_date = '생년월일을 입력해주세요.'
        } else if (!isValidDate(sib.birth)) {
          sErr.birth_date = '올바르지 않은 날짜입니다.'
        } else if (new Date(sib.birth) > new Date()) {
          sErr.birth_date = '생년월일은 미래 날짜일 수 없습니다.'
        }
        if (Object.keys(sErr).length > 0) {
          nextSiblingErrors[sib.id] = sErr
          hasSiblingError = true
        }
      }
      if (hasSiblingError) {
        siblingErrors = nextSiblingErrors
        tick().then(() => scrollToField('[data-field="sibling"]'))
        return false
      }
    }

    // 4) 바우처 필드 (등록 모드 전용, 입력된 행만)
    if (!isEditMode) {
      const nextVoucherErrors: Record<string, VoucherRowErrors> = {}
      let hasVoucherError = false
      for (const row of voucherRows) {
        if (!isVoucherRowTouched(row)) continue
        const vErr: VoucherRowErrors = {}
        if (!row.centerVoucherId)
          vErr.centerVoucher = '바우처 사업을 선택해주세요'
        const sessions = Number(row.totalSessions)
        if (!row.totalSessions.trim()) {
          vErr.totalSessions = '총 회기를 입력해주세요'
        } else if (!Number.isFinite(sessions) || sessions < 1) {
          vErr.totalSessions = '1 이상의 숫자를 입력해주세요'
        }
        if (row.totalAmount.trim()) {
          const amount = Number(row.totalAmount)
          if (!Number.isFinite(amount) || amount < 0) {
            vErr.totalAmount = '0 이상의 숫자를 입력해주세요'
          }
        }
        if (row.validFrom && row.validUntil && row.validFrom > row.validUntil) {
          vErr.validRange = '유효기간 시작일이 종료일보다 이후일 수 없어요'
        }
        if (Object.keys(vErr).length > 0) {
          nextVoucherErrors[row.id] = vErr
          hasVoucherError = true
        }
      }
      if (hasVoucherError) {
        voucherErrors = nextVoucherErrors
        tick().then(() => scrollToField('[data-field="voucher"]'))
        return false
      }
    }

    return true
  }

  /** 서비스 submit/update에 넘길 폼 상태 (분기는 페이지가 담당) */
  function buildFormState(): ClientRegisterFormState {
    return {
      name,
      birth,
      gender,
      email,
      phone,
      zipCode,
      address,
      addressDetail,
      memo,
      guardians,
      siblings,
      voucherRows
    }
  }

  return {
    // 내담자 필드 (getter/setter)
    get name() {
      return name
    },
    set name(v) {
      name = v
    },
    get birth() {
      return birth
    },
    set birth(v) {
      birth = v
    },
    get gender() {
      return gender
    },
    set gender(v) {
      gender = v
    },
    get email() {
      return email
    },
    set email(v) {
      email = v
    },
    get phone() {
      return phone
    },
    set phone(v) {
      phone = v
    },
    get zipCode() {
      return zipCode
    },
    set zipCode(v) {
      zipCode = v
    },
    get address() {
      return address
    },
    set address(v) {
      address = v
    },
    get addressDetail() {
      return addressDetail
    },
    set addressDetail(v) {
      addressDetail = v
    },
    get memo() {
      return memo
    },
    set memo(v) {
      memo = v
    },
    get isAddressSearching() {
      return isAddressSearching
    },

    // 에러 상태
    get fieldErrors() {
      return fieldErrors
    },
    set fieldErrors(v) {
      fieldErrors = v
    },
    get guardianErrors() {
      return guardianErrors
    },
    get siblingErrors() {
      return siblingErrors
    },
    get voucherErrors() {
      return voucherErrors
    },

    // 배열 상태
    get guardians() {
      return guardians
    },
    set guardians(v) {
      guardians = v
    },
    get siblings() {
      return siblings
    },
    set siblings(v) {
      siblings = v
    },
    get voucherRows() {
      return voucherRows
    },

    get isSubmitting() {
      return isSubmitting
    },
    set isSubmitting(v) {
      isSubmitting = v
    },

    // 파생
    get isEditMode() {
      return isEditMode
    },
    get editClientId() {
      return editClientId
    },
    get isGuardianEdit() {
      return isGuardianEdit
    },
    get editClientData() {
      return editClientData
    },
    get birthRealtimeError() {
      return birthRealtimeError
    },
    get showBirthError() {
      return showBirthError
    },
    get duplicateLevel() {
      return duplicateLevel
    },
    get duplicateMatch() {
      return duplicateMatch
    },
    get isFormValid() {
      return isFormValid
    },
    get canSubmit() {
      return canSubmit
    },
    get filledGuardians() {
      return filledGuardians
    },
    get steps() {
      return steps
    },

    // 수정 모드
    setEditClientId,
    shouldFetchClientForEdit,
    shouldFetchGuardiansForEdit,
    setEditClientData,
    setGuardians,
    setOptionalEnabled,
    applyEditPrefill,

    // 핸들러
    validate,
    buildFormState,
    clearGuardianError,
    updateGuardian,
    removeGuardian,
    addGuardian,
    clearSiblingError,
    updateSibling,
    removeSibling,
    addSibling,
    resetOptionalSection,
    ensureOptionalRow,
    addVoucher,
    removeVoucher,
    updateVoucher,
    openAddressSearch
  }
}
