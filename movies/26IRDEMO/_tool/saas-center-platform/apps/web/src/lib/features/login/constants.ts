/**
 * Login Feature Constants
 * 로그인 관련 상수 및 타입 정의
 */

import type { Permission } from '$lib/types/permissions'

export interface LoginUser {
  id: string
  email: string
  name: string
  role: string
  permissions?: Permission[]
}

export interface MockAccount {
  email: string
  password: string
  user: LoginUser
}

/** 개발용 Mock 계정 목록 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    email: 'test@example.com',
    password: 'test123',
    user: {
      id: 'test-user-001',
      email: 'test@example.com',
      name: '테스트 상담사',
      role: 'counselor'
    }
  },
  {
    email: 'admin@example.com',
    password: 'test123',
    user: {
      id: 'admin-user-001',
      email: 'admin@example.com',
      name: '개발용 관리자',
      role: 'super_admin',
      permissions: [
        'write:member',
        'write:center',
        'write:role'
      ] as Permission[]
    }
  }
]
