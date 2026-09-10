import { t, josa } from '$lib/ontology/terms'
/**
 * 내담자 등록/수정 서비스
 * - 등록: 배치 API(보호자+자녀 동시) 또는 단일 생성 API 호출
 * - 수정: 배치 수정 API(내담자+보호자 동시) 호출
 * - 무효화/스낵바/이동 등 부수효과 캡슐화
 */

import { goto } from '$app/navigation'
import type { QueryClient } from '@tanstack/svelte-query'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import {
  postCreateClient,
  postBatchCreateClients,
  putBatchUpdateClient,
  getClientDetail,
  getClientRelations,
  type BatchCreateClientsRequest,
  type BatchGuardianInput,
  type BatchChildInput,
  type BatchUpdateClientRequest,
  type GuardianUpdateInput
} from '$lib/hooks/actions/client.action'
import { postClientVoucher } from '$lib/hooks/actions/clientVoucher.action'
import { RELATION_DETAIL_MAP } from './constants'
import { isVoucherRowFilled, type VoucherRow } from './voucher-types'
import { mapRelationsToGuardianForms } from './view-model'

export type GuardianFormState = {
  id: string
  name: string
  relation: string
  birth: string
  phone: string
  gender: 'male' | 'female'
  /** 기존 보호자의 client_id (수정 모드에서 사용) */
  clientId?: string | null
}

/** 함께 등록하는 형제(추가 자녀) — 대표 내담자와 보호자·주소를 공유 */
export type SiblingFormState = {
  id: string
  name: string
  birth: string
  gender: 'MALE' | 'FEMALE'
}

export type ClientRegisterFormState = {
  name: string
  birth: string
  gender: 'MALE' | 'FEMALE'
  phone: string
  email: string
  zipCode: string
  address: string
  addressDetail: string
  memo: string
  guardians: GuardianFormState[]
  /** 함께 등록하는 형제(추가 자녀). 등록 모드에서만 사용 — 배치 API가 형제 관계 자동 생성 */
  siblings?: SiblingFormState[]
  /** 발급할 바우처 (등록 모드에서만 사용) */
  voucherRows?: VoucherRow[]
}

function formatBirth(birth: string): string | null {
  if (!birth || birth.length !== 10) return null
  return birth
}

/**
 * 주소 합성/분해 — 서버 `clients.address`가 단일 컬럼(String 500)이라
 * `"{우편번호} {주소}"` + 개행 + `"{상세주소}"` 로 합쳐 저장한다.
 *
 * 개행을 구분자로 쓰는 이유:
 *  - 주소·상세주소 둘 다 공백을 포함할 수 있어 공백으로는 경계를 복원할 수 없다.
 *  - HTML은 개행을 공백으로 접어 렌더하므로 **표시 화면은 그대로**다
 *    (`whitespace-pre-*`를 쓰는 곳이 없어야 한다).
 *  - 개행이 없는 기존 데이터는 전부 주소로 복원돼 동작이 퇴행하지 않는다.
 *
 * ⚠️ 근본 해결은 서버에 상세주소(+우편번호) 필드를 분리하는 것이다. 그때까지의 임시 규약.
 */
export function joinAddress(
  zipCode: string,
  address: string,
  addressDetail: string
): string | null {
  const head = [zipCode.trim(), address.trim()].filter(Boolean).join(' ')
  const detail = addressDetail.trim()
  if (!head && !detail) return null
  return detail ? `${head}\n${detail}` : head
}

/** joinAddress의 역함수 — 복원 불가능한 옛 데이터는 주소 칸으로 모은다 */
export function splitAddress(saved: string | null | undefined): {
  zipCode: string
  address: string
  addressDetail: string
} {
  const raw = (saved ?? '').trim()
  if (!raw) return { zipCode: '', address: '', addressDetail: '' }
  const [head, ...rest] = raw.split('\n')
  const addressDetail = rest.join(' ').trim()
  const zipMatch = head.match(/^(\d{5})\s+(.*)$/)
  return {
    zipCode: zipMatch ? zipMatch[1] : '',
    address: (zipMatch ? zipMatch[2] : head).trim(),
    addressDetail
  }
}

function buildBatchPayload(
  state: ClientRegisterFormState
): BatchCreateClientsRequest {
  const fullAddress = joinAddress(
    state.zipCode,
    state.address,
    state.addressDetail
  )

  const child: BatchChildInput = {
    name: state.name.trim(),
    birth_date: formatBirth(state.birth)!,
    gender: state.gender === 'MALE' ? 'male' : 'female',
    phone: state.phone.trim() || null,
    email: state.email.trim() || null,
    address: fullAddress,
    memo: state.memo.trim() || null
  }

  // 함께 등록하는 형제 — 이름·생년월일·성별만 입력, 주소는 대표 자녀와 공유.
  // children이 2명 이상이면 배치 API가 형제(SiblingRelation)를 자동 생성한다.
  const siblingChildren: BatchChildInput[] = (state.siblings ?? [])
    .filter((s) => s.name.trim() && formatBirth(s.birth))
    .map((s) => ({
      name: s.name.trim(),
      birth_date: formatBirth(s.birth)!,
      gender: s.gender === 'MALE' ? 'male' : 'female',
      phone: null,
      email: null,
      address: fullAddress,
      memo: null
    }))

  const guardians: BatchGuardianInput[] = state.guardians
    .filter((g) => g.name.trim() && g.relation)
    .map((g, idx) => ({
      name: g.name.trim(),
      birth_date: formatBirth(g.birth),
      gender: g.gender === 'male' ? 'male' : 'female',
      phone: g.phone.trim() || null,
      relation_type: 'parent',
      relation_detail: RELATION_DETAIL_MAP[g.relation] ?? 'caregiver',
      is_primary: idx === 0,
      memo: null
    }))

  return { guardians, children: [child, ...siblingChildren] }
}

function buildBatchUpdatePayload(
  state: ClientRegisterFormState
): BatchUpdateClientRequest {
  const fullAddress = joinAddress(
    state.zipCode,
    state.address,
    state.addressDetail
  )

  const client = {
    name: state.name.trim(),
    birth_date: formatBirth(state.birth),
    gender: (state.gender === 'MALE' ? 'male' : 'female') as 'male' | 'female',
    phone: state.phone.trim() || null,
    // email 누락으로 수정 시 이메일이 저장되지 않았다(생성 payload에는 있었다).
    // 저장이 안 되니 재진입 프리필도 빈칸으로 보였다 — 2026-08-26 수정
    email: state.email.trim() || null,
    address: fullAddress,
    memo: state.memo.trim() || null
  }

  const guardians: GuardianUpdateInput[] = state.guardians
    .filter((g) => g.name.trim() && g.relation)
    .map((g, idx) => ({
      client_id: g.clientId || null,
      name: g.name.trim(),
      birth_date: formatBirth(g.birth),
      gender: g.gender === 'male' ? 'male' : 'female',
      phone: g.phone.trim() || null,
      relation_detail: RELATION_DETAIL_MAP[g.relation] ?? 'caregiver',
      is_primary: idx === 0,
      memo: null
    }))

  return { client, guardians }
}

export interface RegisterServiceDeps {
  queryClient: QueryClient
}

export function createClientRegisterService(deps: RegisterServiceDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['getClientList'], exact: false })

  const invalidateDetail = (clientId: string) =>
    queryClient.invalidateQueries({
      queryKey: ['getClientDetail'],
      exact: false
    })

  /**
   * 등록 실행: 보호자가 1명 이상이면 배치 API, 없으면 단일 생성.
   * 등록 성공 후 voucherRows가 있으면 각 row를 ClientVoucher로 발급.
   */
  async function submit(
    state: ClientRegisterFormState,
    /** 일정 등에서 들어온 경우의 복귀 경로 — URL 해석은 페이지 몫(레이어 유지) */
    options?: { returnTo?: string | null }
  ): Promise<boolean> {
    const centerId = requireCenterId()
    const validGuardians = state.guardians.filter(
      (g) => g.name.trim() && g.relation
    )
    const validSiblings = (state.siblings ?? []).filter(
      (s) => s.name.trim() && s.birth.trim()
    )

    // 배치 API는 보호자 최소 1명을 요구 — 형제만 있으면 422로 실패한다
    if (validSiblings.length >= 1 && validGuardians.length === 0) {
      snackbarStore.error(`${josa(t('sibling'), '을/를')} 함께 등록하려면 ${t('guardian')} 정보가 필요해요.`)
      return false
    }

    let createdClientId: string | null = null

    // 보호자가 있거나 형제를 함께 등록하면 배치 API(자녀 여러 명 + 형제 자동 연결).
    if (validGuardians.length >= 1 || validSiblings.length >= 1) {
      if (!state.birth) {
        snackbarStore.error(`${t('subject')} 생년월일이 필요해요.`)
        return false
      }
      const payload = buildBatchPayload(state)
      const action = postBatchCreateClients()
      const response = await action.request({ centerId, payload })
      // 백엔드 응답이 평평하거나 ApiResponse 래퍼일 수 있어 둘 다 시도
      createdClientId =
        extractBatchChildId(response) ??
        extractBatchChildId((response as any)?.data) ??
        null
    } else {
      const fullAddress = joinAddress(
        state.zipCode,
        state.address,
        state.addressDetail
      )

      const createClient = postCreateClient()
      const response = await createClient.request({
        centerId,
        payload: {
          role: 'client',
          name: state.name.trim(),
          birth_date: formatBirth(state.birth),
          gender: state.gender === 'MALE' ? 'male' : 'female',
          phone: state.phone.trim() || null,
          email: state.email.trim() || null,
          address: fullAddress,
          memo: state.memo.trim() || null
        }
      })
      createdClientId = extractCreatedId(response)
    }

    // 바우처 발급 (등록 성공 후 1건씩 순차 발급)
    const rowsToIssue = (state.voucherRows ?? []).filter(isVoucherRowFilled)

    if (rowsToIssue.length > 0) {
      if (!createdClientId) {
        console.error(
          '[register] createdClientId를 응답에서 찾지 못해 바우처 발급을 건너뜁니다'
        )
        snackbarStore.warning(
          `${josa(t('subject'), '은/는')} 등록됐지만 바우처 발급을 건너뛰었어요 (${t('subject')} ID 확인 실패)`,
          null,
          5000
        )
      } else {
        const issuer = postClientVoucher()
        let failedCount = 0
        for (const row of rowsToIssue) {
          const totalAmount = row.totalAmount.trim()
            ? Number(row.totalAmount)
            : null
          try {
            await issuer.request({
              centerId,
              payload: {
                client_id: createdClientId,
                center_voucher_id: row.centerVoucherId!,
                total_sessions: Number(row.totalSessions),
                total_amount: totalAmount,
                valid_from: row.validFrom || null,
                valid_until: row.validUntil || null
              }
            })
          } catch (err) {
            console.error('[postClientVoucher] failed', err)
            failedCount += 1
          }
        }
        if (failedCount > 0) {
          snackbarStore.warning(
            `${josa(t('subject'), '은/는')} 등록됐지만 일부 바우처 발급에 실패했어요 (${failedCount}건)`,
            null,
            5000
          )
        }
      }
    }

    invalidateList()
    snackbarStore.success(`${josa(t('subject'), '이/가')} 등록되었어요`)
    // 일정에서 들어왔으면 하던 화면으로 복귀한다(returnTo).
    // 그 밖의 진입에서 목록 착지는 상담사(내 담당 스코프)에게 방금 등록한 내담자가 안 보여
    // 등록 실패로 오인된다(스테이징 검증 O5) → 방금 만든 내담자 상세로 착지
    // replaceState — 제출 끝난 폼을 history에서 지워 뒤로가기가 등록 이전 화면(에이전트 등)으로 바로 가게 함
    const landing =
      options?.returnTo ??
      (createdClientId ? `/clients/${createdClientId}` : '/clients')
    goto(landing, { replaceState: true })
    return true
  }

  /** 평평한 응답과 ApiResponse 래퍼 둘 다에서 id 추출 */
  function extractCreatedId(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null
    const direct = (result as { id?: string }).id
    if (direct) return direct
    const nested = (result as { data?: { id?: string } }).data?.id
    return nested ?? null
  }

  /** Batch 응답의 children[0].id 추출 */
  function extractBatchChildId(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null
    const children = (result as { children?: Array<{ id?: string }> }).children
    return children?.[0]?.id ?? null
  }

  async function update(
    clientId: string,
    state: ClientRegisterFormState
  ): Promise<boolean> {
    const centerId = requireCenterId()
    const payload = buildBatchUpdatePayload(state)
    await putBatchUpdateClient().request({
      centerId,
      clientId,
      payload
    })
    invalidateList()
    invalidateDetail(clientId)
    queryClient.invalidateQueries({
      queryKey: ['getClientRelations'],
      exact: false
    })
    snackbarStore.success(`${t('subject')} 정보 수정이 완료되었어요`)
    history.back()
    return true
  }

  /** 수정 모드: 내담자 상세 조회 */
  async function loadClientForEdit(clientId: string) {
    const centerId = requireCenterId()
    return getClientDetail().request({ centerId, clientId })
  }

  /**
   * 수정 모드: 내담자의 보호자 관계 + 각 보호자 상세를 조회해
   * 보호자 폼 상태 배열로 매핑해 반환. (보호자 없으면 빈 배열)
   */
  async function loadGuardiansForEdit(
    clientId: string
  ): Promise<GuardianFormState[]> {
    const centerId = requireCenterId()
    const relations = await getClientRelations().request({
      centerId,
      clientId,
      relationCategory: 'guardian'
    })
    const guardianRelations = relations.filter(
      (r) => r.relation_type === 'guardian'
    )
    if (guardianRelations.length === 0) return []

    const items = await Promise.all(
      guardianRelations.map(async (relation) => {
        const detail = await getClientDetail().request({
          centerId,
          clientId: relation.related_client_id
        })
        return { relation, detail }
      })
    )
    return mapRelationsToGuardianForms(items)
  }

  return {
    submit,
    update,
    invalidateList,
    loadClientForEdit,
    loadGuardiansForEdit,
    extractFieldErrors,
    extractApiError
  }
}

// ── 백엔드(Pydantic) 에러 → 필드 에러 매핑 ──

export type ClientFieldKey = 'name' | 'birth_date' | 'phone'
export type ClientFieldErrors = Partial<Record<ClientFieldKey, string>>

const PYDANTIC_ERROR_MESSAGES: Record<string, string> = {
  int_parsing_size: '입력한 값이 너무 큽니다.',
  int_parsing: '숫자만 입력 가능합니다.',
  greater_than_equal: '값이 너무 작습니다.',
  less_than_equal: '값이 너무 큽니다.',
  string_too_short: '값이 너무 짧습니다.',
  string_too_long: '값이 너무 깁니다.',
  missing: '필수 항목입니다.',
  value_error: '유효하지 않은 값입니다.',
  date_from_datetime_parsing: '올바르지 않은 날짜입니다.',
  date_parsing: '올바르지 않은 날짜입니다.',
  date_from_datetime_inexact: '올바르지 않은 날짜입니다.',
  date_type: '올바르지 않은 날짜입니다.',
  date_future: '생년월일은 미래 날짜일 수 없습니다.',
  date_past: '올바른 날짜를 입력해주세요.',
  string_pattern_mismatch: '올바른 형식이 아닙니다.'
}

const BACKEND_FIELD_MAP: Record<string, ClientFieldKey> = {
  name: 'name',
  birth_date: 'birth_date',
  phone: 'phone'
}

/** 백엔드 응답에서 필드별 에러 메시지 추출 (없으면 null) */
export function extractFieldErrors(error: unknown): ClientFieldErrors | null {
  const details =
    (error as any)?.response?.data?.detail ??
    (error as any)?.detail ??
    (error as any)?.response?.data?.errors
  if (!Array.isArray(details)) return null
  const next: ClientFieldErrors = {}
  for (const item of details) {
    const loc = Array.isArray(item?.loc) ? item.loc : []
    const field = loc[loc.length - 1]
    const key = BACKEND_FIELD_MAP[field]
    if (!key) continue
    next[key] = PYDANTIC_ERROR_MESSAGES[item.type] || '유효하지 않은 값입니다.'
  }
  return Object.keys(next).length > 0 ? next : null
}

/** 백엔드 응답에서 사용자용 에러 메시지 추출 */
export function extractApiError(error: unknown): string {
  const res = (error as any)?.response
  const detail = res?.data?.detail
  if (typeof detail === 'string') return detail
  const message = res?.data?.message ?? (error as any)?.message
  if (typeof message === 'string') return message
  return '저장에 실패했습니다.'
}
