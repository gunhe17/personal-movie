import { modalUtils } from '$lib/stores/modal'
import type { AuthCategoryVM } from './view-model'

export function useAuthorizationState() {
	let selectedRoleCode = $state<string | null>(null)
	let localCategories = $state<AuthCategoryVM[]>([])
	let isDirty = $state(false)
	let isSaving = $state(false)

	function setCategories(cats: AuthCategoryVM[]) {
		localCategories = cats.map((c) => ({ ...c }))
		isDirty = false
	}

	function toggleView(category: string, checked: boolean) {
		const cat = localCategories.find((c) => c.category === category)
		if (!cat) return
		cat.viewChecked = checked
		if (!checked) {
			cat.modifyChecked = false
		}
		isDirty = true
	}

	function toggleModify(category: string, checked: boolean) {
		const cat = localCategories.find((c) => c.category === category)
		if (!cat) return
		cat.modifyChecked = checked
		if (checked) {
			cat.viewChecked = true
		}
		isDirty = true
	}

	function setBoundary(category: string, boundary: 'all' | 'part') {
		const cat = localCategories.find((c) => c.category === category)
		if (!cat) return
		cat.boundary = boundary
		isDirty = true
	}

	async function selectRole(roleCode: string) {
		if (isDirty) {
			const confirmed = await modalUtils.confirm(
				'저장하지 않은 변경사항이 있습니다. 역할을 변경하시겠습니까?',
				'변경사항 확인', { type: 'warning' })
			if (!confirmed) return
		}
		selectedRoleCode = roleCode
		isDirty = false
	}

	return {
		get selectedRoleCode() {
			return selectedRoleCode
		},
		get localCategories() {
			return localCategories
		},
		get isDirty() {
			return isDirty
		},
		get isSaving() {
			return isSaving
		},
		set isSaving(v: boolean) {
			isSaving = v
		},
		setCategories,
		toggleView,
		toggleModify,
		setBoundary,
		selectRole
	}
}
