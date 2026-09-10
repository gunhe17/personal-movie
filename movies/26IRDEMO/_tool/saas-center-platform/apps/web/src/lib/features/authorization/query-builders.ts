export function buildRolesQueryInput(centerId: string) {
	return { centerId }
}

export function buildRolePermissionsQueryInput(centerId: string, roleCode: string) {
	return { centerId, roleCode }
}
