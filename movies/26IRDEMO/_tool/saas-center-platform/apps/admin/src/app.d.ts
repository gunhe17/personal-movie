import type { AdminRole } from '$lib/utils/permissions'

export type { AdminRole }

export interface AdminUser {
	id: string
	email: string
	name: string
	role: AdminRole
}

declare global {
	namespace App {
		interface Locals {
			user: AdminUser | null
			accessToken: string | null
		}
	}
}

export {}
