import { postRaw } from './instances'

export type UserRole = 'admin' | 'clinician' | 'researcher'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface AuthInstitution {
  id: string
  name: string
}

export interface InstitutionMembership {
  institution_id: string
  institution_name: string
  member_id: string
  name: string
  role: UserRole
}

export interface AuthSuccess {
  access_token: string
  refresh_token: string
  user: AuthUser
  institution: AuthInstitution
  institutions: InstitutionMembership[]
  requires_institution_choice: boolean
}

export interface MessageResponse {
  message: string
}

export async function signup(data: {
  email: string
  password: string
  name: string
  institution_name: string
}): Promise<AuthSuccess> {
  return postRaw<AuthSuccess>('/auth/signup', data)
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return postRaw<MessageResponse>('/auth/forgot-password', { email })
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<MessageResponse> {
  return postRaw<MessageResponse>('/auth/reset-password', {
    token,
    new_password: newPassword
  })
}
