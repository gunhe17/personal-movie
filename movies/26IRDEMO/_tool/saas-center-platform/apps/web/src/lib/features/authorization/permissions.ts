import type { Permission } from '$lib/types/permissions'

export const AUTHORIZATION_PERMISSIONS = {
	access: 'write:role'
} as const satisfies Record<string, Permission>
