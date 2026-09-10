/**
 * Signup Service
 * 회원가입 비즈니스 로직 (API 호출 + 에러 처리 + 인증 저장 + 리다이렉트)
 */

import { goto } from '$app/navigation'
import { auth } from '$lib/stores/auth'
import { snackbarStore } from '$lib/stores/snackbar'
import { postSignup, type SignupRequest } from '$lib/hooks/actions/auth.action'

// ============================================================
// 타입
// ============================================================

export type FieldErrors = Partial<
	Record<
		'name' | 'gender' | 'birth' | 'email' | 'phone' | 'password' | 'passwordConfirm' | 'terms',
		string
	>
>

export interface SignupResult {
	success: boolean
	error?: string
	fieldErrors?: FieldErrors
}

export interface SignupParams {
	email: string
	password: string
	name: string
	phone: string
	birth?: string
	gender?: string
}

// ============================================================
// 유효성 검증 (필드별)
// ============================================================

export function validateSignupFields(params: {
	name: string
	gender: string
	birthDigits: string
	email: string
	phone: string
	password: string
	passwordConfirm: string
	agreeTerms: boolean
	agreePrivacy: boolean
}): FieldErrors {
	const errors: FieldErrors = {}

	if (!params.name.trim()) {
		errors.name = '이름을 입력해 주세요.'
	}

	if (!params.gender) {
		errors.gender = '성별을 선택해 주세요.'
	}

	if (params.birthDigits.length === 0) {
		errors.birth = '생년월일을 입력해 주세요.'
	} else if (params.birthDigits.length !== 8) {
		errors.birth = '생년월일 8자리를 입력해 주세요.'
	} else {
		const y = parseInt(params.birthDigits.slice(0, 4))
		const m = parseInt(params.birthDigits.slice(4, 6))
		const d = parseInt(params.birthDigits.slice(6, 8))
		const date = new Date(y, m - 1, d)
		if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
			errors.birth = '유효하지 않은 날짜입니다.'
		} else if (date > new Date()) {
			errors.birth = '생년월일은 미래 날짜일 수 없습니다.'
		}
	}

	if (!params.email.trim()) {
		errors.email = '이메일을 입력해 주세요.'
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)) {
		errors.email = '올바른 이메일 형식을 입력해 주세요.'
	}

	if (!params.phone) {
		errors.phone = '휴대폰 번호를 입력해 주세요.'
	}

	if (!params.password) {
		errors.password = '비밀번호를 입력해 주세요.'
	} else if (params.password.length < 8) {
		errors.password = '비밀번호는 8자 이상이어야 합니다.'
	}

	if (params.password && params.password !== params.passwordConfirm) {
		errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
	}

	if (!params.agreeTerms || !params.agreePrivacy) {
		errors.terms = '필수 약관에 동의해 주세요.'
	}

	return errors
}

/** 백엔드 필드명 → 프론트엔드 필드명 매핑 */
const BACKEND_FIELD_MAP: Record<string, keyof FieldErrors> = {
	email: 'email',
	password: 'password',
	name: 'name',
	phone: 'phone',
	birth: 'birth',
	gender: 'gender'
}

/** 서버 message에서 관련 필드를 추론하여 fieldErrors로 매핑 */
const MESSAGE_FIELD_PATTERNS: { pattern: RegExp; field: keyof FieldErrors }[] = [
	{ pattern: /이메일/i, field: 'email' },
	{ pattern: /비밀번호/i, field: 'password' },
	{ pattern: /이름/i, field: 'name' },
	{ pattern: /휴대폰|전화/i, field: 'phone' },
	{ pattern: /생년월일/i, field: 'birth' },
	{ pattern: /성별/i, field: 'gender' }
]

function inferFieldErrorFromMessage(message: string): FieldErrors {
	for (const { pattern, field } of MESSAGE_FIELD_PATTERNS) {
		if (pattern.test(message)) {
			return { [field]: message }
		}
	}
	return {}
}

// ============================================================
// 회원가입 API
// ============================================================

export async function signup(
	params: SignupParams,
	redirectTo: string
): Promise<SignupResult> {
	try {
		const payload: SignupRequest = {
			email: params.email,
			password: params.password,
			person: {
				name: params.name,
				phone: params.phone,
				...(params.birth && { birth: params.birth }),
				...(params.gender && { gender: params.gender })
			}
		}

		const data = await postSignup().request(payload)

		if (!data.success) {
			const message = data.message || '회원가입에 실패했습니다.'
			const result: SignupResult = {
				success: false,
				error: message
			}
			// 서버에서 fieldErrors를 내려준 경우 매핑
			const serverFieldErrors = (data as unknown as Record<string, unknown>).fieldErrors as
				| Record<string, string>
				| undefined
			if (serverFieldErrors) {
				const mapped: FieldErrors = {}
				for (const [key, msg] of Object.entries(serverFieldErrors)) {
					const frontKey = BACKEND_FIELD_MAP[key]
					if (frontKey) mapped[frontKey] = msg
				}
				result.fieldErrors = mapped
			} else {
				// fieldErrors가 없으면 message에서 관련 필드 추론
				const inferred = inferFieldErrorFromMessage(message)
				if (Object.keys(inferred).length > 0) {
					result.fieldErrors = inferred
				}
			}
			return result
		}

		if (data.user) auth.login(data.user)
		snackbarStore.success('회원가입이 완료되었습니다.')

		const isInvitationFlow = redirectTo.startsWith('/accept-invitation')
		await goto(isInvitationFlow ? redirectTo : '/signup/success')

		return { success: true }
	} catch (err: unknown) {
		console.error(err)

		if (err && typeof err === 'object' && 'response' in err) {
			const axiosErr = err as {
				response?: { status?: number; data?: { message?: string; fieldErrors?: Record<string, string> } }
			}
			const message = axiosErr.response?.data?.message || '회원가입에 실패했습니다.'
			const result: SignupResult = {
				success: false,
				error: message
			}
			// axios 에러에서도 fieldErrors 파싱
			const serverFieldErrors = axiosErr.response?.data?.fieldErrors
			if (serverFieldErrors) {
				const mapped: FieldErrors = {}
				for (const [key, msg] of Object.entries(serverFieldErrors)) {
					const frontKey = BACKEND_FIELD_MAP[key]
					if (frontKey) mapped[frontKey] = msg
				}
				result.fieldErrors = mapped
			} else {
				const inferred = inferFieldErrorFromMessage(message)
				if (Object.keys(inferred).length > 0) {
					result.fieldErrors = inferred
				}
			}
			return result
		}

		return { success: false, error: '서버 연결에 실패했습니다.' }
	}
}
