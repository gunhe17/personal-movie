import { showSuccessSnackbar, showErrorSnackbar } from '$utils/errorHandler'
import { requireCenterId } from '$lib/stores/center.store'
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import type { QueryClient } from '@tanstack/svelte-query'
import type {
  RoleSummary,
  PermissionSummary
} from '$lib/hooks/actions/role.action'
import {
  deleteRole,
  postBatchAssignRoleMembers,
  postCreateRole,
  putRolePermissions,
  patchUpdateRole
} from '$lib/hooks/actions/role.action'
import RoleUpsertModal from '$lib/components/modal/RoleUpsertModal.svelte'
import RoleMembersAssignModal from '$lib/components/modal/RoleMembersAssignModal.svelte'
import RoleChangeConfirmModal from '$lib/components/modal/RoleChangeConfirmModal.svelte'
import MemberRoleChangeModal from '$lib/components/modal/MemberRoleChangeModal.svelte'
import {
  buildAuthorizationVM,
  computePermissionIds,
  buildCreateRoleCategories,
  getRoleDisplayName,
  type AuthCategoryVM,
  type AssignableMember,
  type RoleChangeItem,
  type MemberRowVM
} from './view-model'
import { ROLE_CODES } from './constants'
import type { Component } from 'svelte'

export interface AuthorizationDeps {
  queryClient: QueryClient
}

export function createAuthorizationService(deps: AuthorizationDeps) {
  const { queryClient } = deps

  const invalidateRolePermissions = () =>
    queryClient.invalidateQueries({
      queryKey: ['getRolePermissions'],
      exact: false
    })

  const invalidateMembers = () =>
    queryClient.invalidateQueries({
      queryKey: ['getMemberList'],
      exact: false
    })

  const invalidateRoleMembers = () =>
    queryClient.invalidateQueries({
      queryKey: ['getRoleMembers'],
      exact: false
    })

  const invalidateRoles = () =>
    queryClient.invalidateQueries({
      queryKey: ['getCenterRoles'],
      exact: false
    })

  const savePermissions = async (
    roleCode: string,
    categories: AuthCategoryVM[]
  ) => {
    const permissionIds = computePermissionIds(categories)
    try {
      await putRolePermissions().request({
        centerId: requireCenterId(),
        roleCode,
        permission_ids: permissionIds
      })
      showSuccessSnackbar('권한이 저장되었습니다')
      await invalidateRolePermissions()
    } catch (error) {
      showErrorSnackbar(error, '권한 저장에 실패했습니다')
      throw error
    }
  }

  const createRole = async (
    roleName: string,
    categories: AuthCategoryVM[],
    accessLevel: string = 'own'
  ) => {
    const permissionIds = computePermissionIds(categories)
    try {
      await postCreateRole().request({
        centerId: requireCenterId(),
        name: roleName,
        description: null,
        permission_ids: permissionIds,
        access_level: accessLevel
      })
      showSuccessSnackbar(`'${roleName}' 역할이 추가됐어요`)
      await Promise.all([invalidateRoles(), invalidateRolePermissions()])
    } catch (error) {
      showErrorSnackbar(error, '역할 추가에 실패했습니다')
      throw error
    }
  }

  const updateRole = async (
    roleCode: string,
    roleName: string,
    categories: AuthCategoryVM[],
    accessLevel?: string
  ) => {
    const permissionIds = computePermissionIds(categories)
    try {
      await patchUpdateRole().request({
        centerId: requireCenterId(),
        roleCode,
        name: roleName,
        description: null,
        permission_ids: permissionIds,
        access_level: accessLevel
      })
      showSuccessSnackbar(`'${roleName}' 역할이 수정됐어요`)
      await Promise.all([invalidateRoles(), invalidateRolePermissions()])
    } catch (error) {
      showErrorSnackbar(error, '역할 수정에 실패했습니다')
      throw error
    }
  }

  const removeRole = async (roleCode: string, roleName: string) => {
    try {
      await deleteRole().request({
        centerId: requireCenterId(),
        roleCode
      })
      showSuccessSnackbar(`'${roleName}' 역할이 삭제됐어요`)
      await Promise.all([
        invalidateRoles(),
        invalidateRolePermissions(),
        invalidateMembers()
      ])
    } catch (error) {
      showErrorSnackbar(error, '역할 삭제에 실패했습니다')
      throw error
    }
  }

  const assignMembersToRole = async (
    roleCode: string,
    roleName: string,
    members: Array<{ id: string }>
  ) => {
    try {
      await postBatchAssignRoleMembers().request({
        centerId: requireCenterId(),
        roleCode,
        member_ids: members.map((member) => member.id)
      })
      if (members.length === 1) {
        showSuccessSnackbar(`선택한 구성원이 '${roleName}' 역할에 추가됐어요.`)
      } else {
        showSuccessSnackbar(
          `선택한 ${members.length}명의 구성원이 '${roleName}' 역할에 추가됐어요.`
        )
      }
      await Promise.all([
        invalidateMembers(),
        invalidateRoleMembers(),
        invalidateRoles(),
        invalidateRolePermissions()
      ])
    } catch (error) {
      showErrorSnackbar(error, '구성원 역할 변경에 실패했습니다')
      throw error
    }
  }

  // ===== Modal Methods =====

  function openCreateRoleModal(allPermissions: PermissionSummary[]) {
    const baseCategories = buildCreateRoleCategories(
      buildAuthorizationVM(allPermissions, [])
    )

    modalStore.open({
      component: RoleUpsertModal,
      props: {
        mode: 'create',
        roleName: '',
        categories: baseCategories,
        accessLevel: 'own',
        onConfirm: async (payload: {
          roleName: string
          categories: AuthCategoryVM[]
          accessLevel: string
        }) => {
          await createRole(
            payload.roleName,
            payload.categories,
            payload.accessLevel
          )
        }
      },
      options: { size: 'md', desktopOnly: true }
    })
  }

  function openRoleCopyModal(
    selectedRole: RoleSummary,
    localCategories: AuthCategoryVM[]
  ) {
    modalStore.open({
      component: RoleUpsertModal,
      props: {
        mode: 'create',
        roleName: `${selectedRole.name} 복사본`,
        categories: localCategories,
        accessLevel: selectedRole.access_level ?? 'own',
        onConfirm: async (payload: {
          roleName: string
          categories: AuthCategoryVM[]
          accessLevel: string
        }) => {
          await createRole(
            payload.roleName,
            payload.categories,
            payload.accessLevel
          )
        }
      },
      options: { size: 'md', desktopOnly: true }
    })
  }

  function openEditRoleModal(params: {
    selectedRole: RoleSummary
    localCategories: AuthCategoryVM[]
    isOwnRoleLocked: boolean
    onUpdate?: (categories: AuthCategoryVM[]) => void
  }) {
    const { selectedRole, localCategories, isOwnRoleLocked, onUpdate } = params

    if (isOwnRoleLocked) {
      snackbarStore.error('본인이 속한 역할의 권한은 수정할 수 없습니다.')
      return false
    }

    modalStore.open({
      component: RoleUpsertModal,
      props: {
        mode: 'edit',
        roleName: selectedRole.name,
        categories: localCategories,
        accessLevel: selectedRole.access_level ?? 'own',
        onConfirm: async (payload: {
          roleName: string
          categories: AuthCategoryVM[]
          accessLevel: string
        }) => {
          await updateRole(
            selectedRole.code,
            payload.roleName,
            payload.categories,
            payload.accessLevel
          )
          onUpdate?.(payload.categories)
        }
      },
      options: { size: 'md', desktopOnly: true }
    })
    return true
  }

  async function openDeleteRoleModal(params: {
    selectedRole: RoleSummary
    isOwnRoleLocked: boolean
  }) {
    const { selectedRole, isOwnRoleLocked } = params

    if (isOwnRoleLocked) {
      snackbarStore.error('본인이 속한 역할은 삭제할 수 없습니다.')
      return
    }

    if (selectedRole.is_preset) {
      snackbarStore.error('기본 역할은 삭제할 수 없습니다.')
      return
    }

    if ((selectedRole.member_count ?? 0) > 0) {
      snackbarStore.error('구성원을 다른 역할로 이동한 후 삭제해주세요.')
      return
    }

    await removeRole(selectedRole.code, selectedRole.name)
  }

  function openAssignMembersModal(params: {
    selectedRole: RoleSummary
    assignableMembers: AssignableMember[]
    currentMemberId: string | null
  }) {
    const { selectedRole, assignableMembers: members, currentMemberId } = params

    modalStore.open({
      component: RoleMembersAssignModal,
      props: {
        roleName: selectedRole.name,
        members,
        currentMemberId,
        onConfirm: async (
          selectedMembers: AssignableMember[],
          controls: { closeModal: () => void }
        ) => {
          const conflicts = selectedMembers
            .filter((m) => m.roleCode !== selectedRole.code)
            .map(
              (m): RoleChangeItem => ({
                id: m.id,
                name: m.name,
                fromRoleName: m.roleName,
                toRoleName: selectedRole.name
              })
            )

          const executeAssign = async () => {
            await assignMembersToRole(
              selectedRole.code,
              selectedRole.name,
              selectedMembers.map((m) => ({ id: m.id }))
            )
          }

          if (conflicts.length > 0) {
            modalStore.open({
              component: RoleChangeConfirmModal,
              props: {
                items: conflicts,
                onConfirm: async () => {
                  await executeAssign()
                  controls.closeModal()
                }
              },
              options: { customWidth: 420 }
            })
            return false
          }

          await executeAssign()
          return true
        }
      },
      options: { size: 'lg', desktopOnly: true }
    })
  }

  function openMemberRoleChangeModal(params: {
    member: MemberRowVM
    selectedRole: RoleSummary
    roleList: RoleSummary[]
  }) {
    const { member, selectedRole, roleList } = params
    const targetRoles = roleList.filter(
      (r) => r.code !== ROLE_CODES.ADMIN && r.code !== selectedRole.code
    )

    modalStore.open({
      component: MemberRoleChangeModal as Component,
      props: {
        memberName: member.name,
        currentRoleName: getRoleDisplayName(selectedRole),
        roles: targetRoles,
        getRoleDisplayName,
        onConfirm: async (roleCode: string, roleName: string) => {
          await assignMembersToRole(roleCode, roleName, [{ id: member.id }])
        }
      },
      options: { customWidth: 420 }
    })
  }

  return {
    savePermissions,
    invalidateRolePermissions,
    createRole,
    updateRole,
    removeRole,
    assignMembersToRole,
    openCreateRoleModal,
    openRoleCopyModal,
    openEditRoleModal,
    openDeleteRoleModal,
    openAssignMembersModal,
    openMemberRoleChangeModal
  }
}
